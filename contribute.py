"""
AXIS — Contribution Engine
Lets employees submit new context entries that are immediately searchable.
"""

import io
import json
import os
import re
import requests as _req
from datetime import datetime, timezone
from pathlib import Path

import chromadb
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

DATA_DIR = Path(os.environ.get("AXIS_DATA_DIR", str(Path(__file__).parent / "data")))
DB_DIR = Path(os.environ.get("AXIS_DB_DIR", str(Path(__file__).parent / "axis_db")))
COLLECTION_NAME = "axis_context"
EMBED_MODEL = "all-MiniLM-L6-v2"

TEAM_FILE_MAP = {
    "Engineering":    "engineering_docs.json",
    "Data":           "data_team_docs.json",
    "CRM":            "crm_docs.json",
    "Client Success": "client_success_docs.json",
    "Product":        "product_team_docs.json",
}

TEAM_ID_PREFIX = {
    "Engineering":    "eng",
    "Data":           "data",
    "CRM":            "crm",
    "Client Success": "cs",
    "Product":        "prod",
}


_ENRICH_PROMPT = """\
Analyze this internal knowledge base entry. Return ONLY a valid JSON object — no explanation, no markdown fences.

Title: {title}
Team: {team}
Content: {content}

JSON structure to return:
{{
  "type": "<one of: Fix, Decision, Architecture, Process, Learning, Incident>",
  "summary": "<one sentence, max 15 words, capturing the core insight>",
  "flow": {{
    "problem": "<what situation, issue, or question prompted this — 1-2 sentences>",
    "action": "<what was done, decided, or built — 1-2 sentences>",
    "outcome": "<what changed, what to know, or what to do next — 1-2 sentences>"
  }},
  "scope": ["<proper noun: service, system, tool, component name — max 6 items>"]
}}

Rules:
- Use only information from the content above
- scope items must be proper nouns (e.g. AuthService, Redis, Jira — not "authentication" or "database")
- Return ONLY the JSON object, nothing else"""


def enrich_content(title: str, content: str, team: str) -> dict | None:
    """
    Call Groq to extract structured intelligence from a context entry.
    Returns {type, summary, flow, scope} or None if extraction fails.
    """
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        return None
    prompt = _ENRICH_PROMPT.format(title=title, team=team, content=content[:2000])
    try:
        resp = _req.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": os.environ.get("GROQ_MODEL", "llama-3.1-8b-instant"),
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 400,
                "temperature": 0.1,
            },
            timeout=15,
        )
        resp.raise_for_status()
        text = resp.json()["choices"][0]["message"]["content"].strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:].strip()
        return json.loads(text)
    except Exception:
        return None


def _next_id(team: str, existing_docs: list[dict]) -> str:
    prefix = TEAM_ID_PREFIX[team]
    pattern = re.compile(rf"^{prefix}_(\d+)$")
    nums = [int(m.group(1)) for d in existing_docs if (m := pattern.match(d["id"]))]
    next_num = max(nums, default=0) + 1
    return f"{prefix}_{next_num:03d}"


def submit_context(
    team: str,
    title: str,
    content: str,
    author: str = "",
    tags: list[str] | None = None,
    contributed_by: str = "",
) -> str:
    """
    Save a new doc entry to the team's JSON file and add it to ChromaDB live.
    Returns the new doc id.
    """
    if team not in TEAM_FILE_MAP:
        raise ValueError(f"Unknown team: {team}")

    tags = tags or []
    file_path = DATA_DIR / TEAM_FILE_MAP[team]

    # Load existing docs
    with open(file_path, "r") as f:
        docs = json.load(f)

    new_id = _next_id(team, docs)

    enriched = enrich_content(title, content, team)
    contributed_at = datetime.now(timezone.utc).isoformat()

    new_doc = {
        "id": new_id,
        "team": team,
        "title": title,
        "content": content,
        "tags": tags,
        "contributed_at": contributed_at,
        **({"author": author} if author else {}),
        **({"contributed_by": contributed_by} if contributed_by else {}),
        **({"enriched": enriched} if enriched else {}),
    }

    docs.append(new_doc)

    with open(file_path, "w") as f:
        json.dump(docs, f, indent=2)

    # Live-add to ChromaDB; roll back the JSON write if ChromaDB fails
    try:
        client = chromadb.PersistentClient(path=str(DB_DIR))
        embed_fn = SentenceTransformerEmbeddingFunction(model_name=EMBED_MODEL)
        collection = client.get_collection(name=COLLECTION_NAME, embedding_function=embed_fn)

        chunk_text = f"Team: {team}\nTitle: {title}\n\n{content}"
        collection.add(
            ids=[new_id],
            documents=[chunk_text],
            metadatas=[{
                "team": team,
                "title": title,
                "tags": ", ".join(tags),
                "url": "",
                "source": "contributed",
                "contributed_by": contributed_by,
            }],
        )
    except Exception as chroma_err:
        # Rollback: remove the doc we just appended to JSON
        docs = [d for d in docs if d["id"] != new_id]
        with open(file_path, "w") as f:
            json.dump(docs, f, indent=2)
        raise RuntimeError(f"Failed to index contribution; changes rolled back: {chroma_err}") from chroma_err

    # Refresh BM25 and enriched indices so new doc is immediately searchable
    try:
        from query import get_bm25_index, refresh_enriched_index
        get_bm25_index().refresh()
        refresh_enriched_index()
    except Exception:
        pass

    return new_id


def extract_text(filename: str, data: bytes) -> str:
    """Extract plain text from PDF, DOCX, TXT, or MD file bytes."""
    ext = Path(filename).suffix.lower()
    if ext == ".pdf":
        try:
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(data))
            return "\n".join(p.extract_text() or "" for p in reader.pages).strip()
        except Exception as e:
            raise ValueError(f"Could not read PDF: {e}")
    if ext in (".docx",):
        try:
            from docx import Document
            doc = Document(io.BytesIO(data))
            return "\n".join(p.text for p in doc.paragraphs if p.text).strip()
        except Exception as e:
            raise ValueError(f"Could not read DOCX: {e}")
    if ext in (".txt", ".md", ".csv"):
        return data.decode("utf-8", errors="replace").strip()
    raise ValueError(f"Unsupported file type: {ext}. Supported: PDF, DOCX, TXT, MD, CSV")


def update_contribution(doc_id: str, email: str, updates: dict) -> bool:
    """
    Update title, content, and/or tags of a contributed doc.
    Only allowed if contributed_by matches email.
    Re-indexes the doc in ChromaDB with new content.
    Returns True if updated, False if not found or not owned.
    """
    for team, filename in TEAM_FILE_MAP.items():
        path = DATA_DIR / TEAM_FILE_MAP[team]
        try:
            with open(path, "r") as f:
                docs = json.load(f)
            for doc in docs:
                if doc["id"] == doc_id:
                    if doc.get("contributed_by") != email:
                        return False
                    if "title" in updates:
                        doc["title"] = updates["title"]
                    if "content" in updates:
                        doc["content"] = updates["content"]
                    if "tags" in updates:
                        doc["tags"] = updates["tags"]
                    with open(path, "w") as f:
                        json.dump(docs, f, indent=2)
                    # Re-index in ChromaDB
                    try:
                        client = chromadb.PersistentClient(path=str(DB_DIR))
                        embed_fn = SentenceTransformerEmbeddingFunction(model_name=EMBED_MODEL)
                        collection = client.get_collection(name=COLLECTION_NAME, embedding_function=embed_fn)
                        chunk_text = f"Team: {team}\nTitle: {doc['title']}\n\n{doc['content']}"
                        collection.update(
                            ids=[doc_id],
                            documents=[chunk_text],
                            metadatas=[{
                                "team": team,
                                "title": doc["title"],
                                "tags": ", ".join(doc.get("tags", [])),
                                "url": "",
                                "source": "contributed",
                                "contributed_by": doc.get("contributed_by", ""),
                            }],
                        )
                    except Exception:
                        pass
                    try:
                        from query import get_bm25_index
                        get_bm25_index().refresh()
                    except Exception:
                        pass
                    return True
        except Exception:
            pass
    return False


def list_contributions(email: str) -> list[dict]:
    """Return all docs contributed by the given email, across all teams."""
    results = []
    for team, filename in TEAM_FILE_MAP.items():
        path = DATA_DIR / filename
        try:
            with open(path, "r") as f:
                docs = json.load(f)
            for doc in docs:
                if doc.get("contributed_by") == email:
                    results.append({
                        "id": doc["id"],
                        "team": team,
                        "title": doc.get("title", ""),
                        "content": doc.get("content", ""),
                        "tags": doc.get("tags", []),
                        "author": doc.get("author", ""),
                        "contributed_at": doc.get("contributed_at", ""),
                        **({"enriched": doc["enriched"]} if doc.get("enriched") else {}),
                    })
        except Exception:
            pass
    results.sort(key=lambda d: d.get("contributed_at") or "", reverse=True)
    return results


def delete_contribution(doc_id: str, email: str) -> bool:
    """
    Delete a contributed doc by ID. Only allowed if contributed_by matches email.
    Removes from both the JSON file and ChromaDB.
    Returns True if deleted, False if not found or not owned.
    """
    for team, filename in TEAM_FILE_MAP.items():
        path = DATA_DIR / filename
        try:
            with open(path, "r") as f:
                docs = json.load(f)
            for doc in docs:
                if doc["id"] == doc_id:
                    if doc.get("contributed_by") != email:
                        return False  # not owned by this user
                    docs.remove(doc)
                    with open(path, "w") as f:
                        json.dump(docs, f, indent=2)
                    # Remove from ChromaDB
                    try:
                        client = chromadb.PersistentClient(path=str(DB_DIR))
                        embed_fn = SentenceTransformerEmbeddingFunction(model_name=EMBED_MODEL)
                        collection = client.get_collection(name=COLLECTION_NAME, embedding_function=embed_fn)
                        collection.delete(ids=[doc_id])
                    except Exception:
                        pass
                    # Refresh BM25
                    try:
                        from query import get_bm25_index
                        get_bm25_index().refresh()
                    except Exception:
                        pass
                    return True
        except Exception:
            pass
    return False


def get_contribution_by_id(doc_id: str) -> dict | None:
    """Return a single contributed doc by its ID, or None if not found."""
    for team, filename in TEAM_FILE_MAP.items():
        path = DATA_DIR / filename
        try:
            with open(path, "r") as f:
                docs = json.load(f)
            for doc in docs:
                if doc["id"] == doc_id:
                    return {**doc, "team": team}
        except Exception:
            pass
    return None


def get_doc_count() -> dict[str, int]:
    """Return per-team doc counts from the JSON files."""
    counts = {}
    for team, filename in TEAM_FILE_MAP.items():
        path = DATA_DIR / filename
        with open(path, "r") as f:
            counts[team] = len(json.load(f))
    return counts
