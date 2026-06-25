"""
AXIS — Query Engine
Retrieves relevant context chunks from ChromaDB and calls Claude with them.
"""

import os
from pathlib import Path
from typing import Optional

import anthropic
import chromadb
import requests
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction
from sentence_transformers import CrossEncoder

# ── Config ────────────────────────────────────────────────────────────────────
DB_DIR = Path("axis_db")
COLLECTION_NAME = "axis_context"
EMBED_MODEL = "all-MiniLM-L6-v2"
CLAUDE_MODEL = "claude-sonnet-4-6"
TOP_K = 8  # retrieve more, then re-rank down to RERANK_TOP_K
RERANK_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"
RERANK_TOP_K = 3  # keep best 3 after re-ranking
HISTORY_WINDOW = 6  # last 6 turns = 3 exchanges

# ── Answer-generation backend ───────────────────────────────────────────────
# "ollama" (default) runs a local model — free, no API key. "anthropic" calls
# the Claude API (needs ANTHROPIC_API_KEY with credits).
LLM_BACKEND = os.environ.get("AXIS_LLM_BACKEND", "ollama").lower()
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434").rstrip("/")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.2")

# Feedback loop: each net up/down vote nudges a doc's rank by FEEDBACK_WEIGHT,
# capped at ±FEEDBACK_CAP votes so feedback refines but never overrides relevance.
FEEDBACK_WEIGHT = 0.5
FEEDBACK_CAP = 5

TEAM_ICONS = {
    "Engineering":      "🔧",
    "Data":             "📊",
    "CRM":              "🗂️",
    "Client Success":   "🤝",
    "Product":          "🧭",
}

SYSTEM_PROMPT = """You are AXIS, a centralized knowledge assistant for TechCorp.
You have access to internal documentation from five teams: Engineering, Data, CRM, Client Success, and Product.

Your job is to give accurate, grounded answers based ONLY on the context provided.
If the context does not contain enough information to answer, say so clearly — do not guess or hallucinate.

When answering follow-up questions, use the conversation history to understand context (e.g. 'it', 'that feature', 'the issue above' refer to earlier messages).

How to write your answers:
- Write like a helpful human colleague explaining something over chat — casual, clear, direct
- NEVER use markdown: no ## headers, no ** bold, no bullet dashes, no ---, no > blockquotes, no backticks
- For steps, just write "1. ... 2. ... 3. ..." on separate lines — no other formatting
- Explain any technical term in plain words the first time you use it
- Keep it short — most answers should be under 150 words
- End with a single plain sentence saying which team and document the answer came from
"""


# ── Init clients (cached) ─────────────────────────────────────────────────────
_collection = None
_anthropic = None
_cross_encoder = None
_bm25_index = None
_doc_scores = None


def get_collection():
    global _collection
    if _collection is None:
        if not DB_DIR.exists():
            raise RuntimeError(
                "Vector store not found. Run `python ingest.py` first."
            )
        client = chromadb.PersistentClient(path=str(DB_DIR))
        embed_fn = SentenceTransformerEmbeddingFunction(model_name=EMBED_MODEL)
        _collection = client.get_collection(
            name=COLLECTION_NAME, embedding_function=embed_fn
        )
    return _collection


def get_anthropic():
    global _anthropic
    if _anthropic is None:
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY environment variable not set.")
        _anthropic = anthropic.Anthropic(api_key=api_key)
    return _anthropic


def get_cross_encoder():
    global _cross_encoder
    if _cross_encoder is None:
        _cross_encoder = CrossEncoder(RERANK_MODEL)
    return _cross_encoder


def get_bm25_index():
    global _bm25_index
    if _bm25_index is None:
        from bm25_index import BM25Index
        _bm25_index = BM25Index()
    return _bm25_index


def get_doc_scores() -> dict[str, int]:
    """Cached map of {doc_key: feedback score}. Refreshed when a vote is recorded."""
    global _doc_scores
    if _doc_scores is None:
        from db import get_all_doc_scores
        _doc_scores = get_all_doc_scores()
    return _doc_scores


def refresh_doc_scores():
    """Drop the cache so the next query re-reads scores from the DB."""
    global _doc_scores
    _doc_scores = None


# ── Retrieve ──────────────────────────────────────────────────────────────────
def retrieve(query: str, team_filter: Optional[str] = None) -> list[dict]:
    """Retrieve top-K relevant chunks, optionally filtered by team."""
    collection = get_collection()

    where = {"team": team_filter} if team_filter else None

    results = collection.query(
        query_texts=[query],
        n_results=TOP_K,
        where=where,
        include=["documents", "metadatas", "distances"],
    )

    chunks = []
    for doc, meta, dist in zip(
        results["documents"][0],
        results["metadatas"][0],
        results["distances"][0],
    ):
        chunks.append({
            "content": doc,
            "team": meta["team"],
            "title": meta["title"],
            "tags": meta.get("tags", ""),
            "url": meta.get("url", ""),
            "source": meta.get("source", ""),
            "relevance": round((1 - dist) * 100, 1),  # cosine → % relevance
        })

    return chunks


# ── Re-rank ───────────────────────────────────────────────────────────────────
def rerank(query: str, chunks: list[dict]) -> list[dict]:
    """
    Re-rank chunks by cross-encoder relevance, then nudge by accumulated user
    feedback, and keep the best RERANK_TOP_K.
    """
    from db import doc_key

    ce = get_cross_encoder()
    pairs = [(query, c["content"]) for c in chunks]
    scores = ce.predict(pairs)
    doc_scores = get_doc_scores()

    ranked = []
    for ce_score, chunk in zip(scores, chunks):
        fb = doc_scores.get(doc_key(chunk["team"], chunk["title"]), 0)
        fb = max(-FEEDBACK_CAP, min(FEEDBACK_CAP, fb))   # clamp influence
        adjusted = float(ce_score) + FEEDBACK_WEIGHT * fb
        ranked.append((adjusted, float(ce_score), chunk))

    ranked.sort(key=lambda x: x[0], reverse=True)

    result = []
    for _adjusted, ce_score, chunk in ranked[:RERANK_TOP_K]:
        # relevance shown to the user stays the semantic match score
        chunk["relevance"] = round(ce_score * 100, 1)
        result.append(chunk)
    return result


# ── Hybrid Retrieve ───────────────────────────────────────────────────────────
def hybrid_retrieve(query: str, team_filter: Optional[str] = None) -> list[dict]:
    """Merge vector search and BM25 results, deduplicated by (team, title)."""
    vector_chunks = retrieve(query, team_filter=team_filter)
    bm25_chunks = get_bm25_index().search(query, team_filter=team_filter, top_k=8)

    # Merge by title+team dedup, vector takes priority for same doc
    seen = {}
    for c in vector_chunks:
        key = (c["team"], c["title"])
        seen[key] = c
    for c in bm25_chunks:
        key = (c["team"], c["title"])
        if key not in seen:
            seen[key] = c

    return list(seen.values())


# ── Build context block ───────────────────────────────────────────────────────
def build_context_block(chunks: list[dict]) -> str:
    lines = ["Below is the relevant internal documentation context:\n"]
    for i, chunk in enumerate(chunks, 1):
        icon = TEAM_ICONS.get(chunk["team"], "📄")
        lines.append(
            f"--- Source {i}: {icon} {chunk['team']} | {chunk['title']} "
            f"(relevance: {chunk['relevance']}%) ---"
        )
        lines.append(chunk["content"])
        lines.append("")
    return "\n".join(lines)


# ── Answer generation backends ───────────────────────────────────────────────
def _generate_anthropic(messages: list[dict]) -> str:
    response = get_anthropic().messages.create(
        model=CLAUDE_MODEL,
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=messages,
    )
    return response.content[0].text


def _generate_ollama(messages: list[dict]) -> str:
    """Call a locally-running Ollama model. System prompt goes in as message 0."""
    payload = {
        "model": OLLAMA_MODEL,
        "messages": [{"role": "system", "content": SYSTEM_PROMPT}, *messages],
        "stream": False,
    }
    resp = requests.post(f"{OLLAMA_URL}/api/chat", json=payload, timeout=180)
    resp.raise_for_status()
    return resp.json()["message"]["content"]


def generate_answer(messages: list[dict]) -> str:
    """Dispatch to the configured backend."""
    if LLM_BACKEND == "anthropic":
        return _generate_anthropic(messages)
    return _generate_ollama(messages)


# ── Ask ───────────────────────────────────────────────────────────────────────
def ask(
    question: str,
    chat_history: Optional[list[dict]] = None,
    team_filter: Optional[str] = None,
) -> tuple[str, list[dict]]:
    """
    Ask AXIS a question.
    Returns: (answer_text, source_chunks_used)
    """
    # Sliding window: keep only recent history
    if chat_history:
        chat_history = chat_history[-HISTORY_WINDOW:]

    # Build retrieval query with recent user context for better recall
    retrieval_query = question
    if chat_history:
        last_msgs = [m["content"] for m in chat_history[-4:] if m["role"] == "user"]
        if last_msgs:
            retrieval_query = " | ".join(last_msgs[-2:]) + " | " + question

    chunks = hybrid_retrieve(retrieval_query, team_filter=team_filter)
    chunks = rerank(question, chunks)
    context = build_context_block(chunks)

    # Build messages
    messages = []

    # Inject past conversation if provided
    if chat_history:
        messages.extend(chat_history)

    # Add current question with context
    messages.append({
        "role": "user",
        "content": f"{context}\n\nQuestion: {question}",
    })

    try:
        answer = generate_answer(messages)
    except Exception:
        # Graceful degradation: if the model is unavailable (Ollama not running,
        # or the Anthropic key is out of credits) still return the retrieved
        # sources so the UI — including the feedback buttons — keeps working.
        titles = "\n".join(f"{i}. {c['title']}" for i, c in enumerate(chunks, 1))
        backend_hint = (
            "the local model isn't reachable — is Ollama running? (`ollama serve`)"
            if LLM_BACKEND == "ollama"
            else "the Anthropic API is unavailable (out of credits?)"
        )
        answer = (
            f"I couldn't generate a written answer just now — {backend_hint} "
            "But here are the most relevant sources I found:\n\n"
            f"{titles}\n\n"
            "You can open the sources below and rate this result with 👍 / 👎."
        )

    return answer, chunks


# ── CLI mode ──────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("AXIS Query Engine — CLI Mode")
    print("Type your question. Ctrl+C to exit.\n")

    history = []
    while True:
        try:
            q = input("You: ").strip()
            if not q:
                continue
            answer, sources = ask(q, chat_history=history)
            print(f"\nAXIS: {answer}\n")
            print("Sources used:")
            for s in sources:
                icon = TEAM_ICONS.get(s["team"], "📄")
                print(f"  {icon} [{s['team']}] {s['title']} ({s['relevance']}%)")
            print()

            # Maintain history (without the context injection, just Q&A)
            history.append({"role": "user", "content": q})
            history.append({"role": "assistant", "content": answer})

        except KeyboardInterrupt:
            print("\nExiting AXIS.")
            break
