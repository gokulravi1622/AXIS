"""
AXIS — Ingest Pipeline
Reads all team docs, embeds them, and stores in local ChromaDB vector store.
Run once before starting the app: python ingest.py
"""

import json
import os
from pathlib import Path

import chromadb
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

# ── Config ────────────────────────────────────────────────────────────────────
DATA_DIR = Path("data")
DB_DIR = Path("axis_db")
COLLECTION_NAME = "axis_context"
EMBED_MODEL = "all-MiniLM-L6-v2"  # fast, good quality, runs locally

DOC_FILES = [
    "engineering_docs.json",
    "data_team_docs.json",
    "crm_docs.json",
    "client_success_docs.json",
    "product_team_docs.json",
]

TEAM_COLORS = {
    "Engineering":      "🔧",
    "Data":             "📊",
    "CRM":              "🗂️",
    "Client Success":   "🤝",
    "Product":          "🧭",
}

# ── Load docs ─────────────────────────────────────────────────────────────────
def load_all_docs() -> list[dict]:
    all_docs = []
    for filename in DOC_FILES:
        path = DATA_DIR / filename
        with open(path, "r") as f:
            docs = json.load(f)
            all_docs.extend(docs)
    return all_docs


# ── Build text chunks ─────────────────────────────────────────────────────────
def build_chunk(doc: dict) -> str:
    """Combine title + content into a single embeddable chunk."""
    return f"Team: {doc['team']}\nTitle: {doc['title']}\n\n{doc['content']}"


# ── Main ingest ───────────────────────────────────────────────────────────────
def ingest():
    print("AXIS — Ingest Pipeline")
    print("=" * 50)

    # Load docs
    docs = load_all_docs()
    print(f"✅ Loaded {len(docs)} documents from {len(DOC_FILES)} teams")

    # Init ChromaDB
    client = chromadb.PersistentClient(path=str(DB_DIR))
    embed_fn = SentenceTransformerEmbeddingFunction(model_name=EMBED_MODEL)

    # Drop and recreate collection for a clean ingest
    try:
        client.delete_collection(COLLECTION_NAME)
    except Exception:
        pass
    collection = client.create_collection(
        name=COLLECTION_NAME,
        embedding_function=embed_fn,
        metadata={"hnsw:space": "cosine"},
    )

    # Prepare data for ChromaDB
    ids, documents, metadatas = [], [], []
    for doc in docs:
        chunk = build_chunk(doc)
        ids.append(doc["id"])
        documents.append(chunk)
        metadatas.append({
            "team": doc["team"],
            "title": doc["title"],
            "tags": ", ".join(doc.get("tags", [])),
            "url": doc.get("url", ""),
            "source": doc.get("source", "contributed"),
        })

    # Insert in one batch
    collection.add(ids=ids, documents=documents, metadatas=metadatas)

    print(f"✅ Embedded and stored {len(ids)} chunks into ChromaDB")
    print(f"📁 Vector store saved to: {DB_DIR.resolve()}")
    print()

    # Summary by team
    print("Documents by team:")
    team_counts = {}
    for doc in docs:
        team_counts[doc["team"]] = team_counts.get(doc["team"], 0) + 1
    for team, count in team_counts.items():
        icon = TEAM_COLORS.get(team, "📄")
        print(f"  {icon} {team}: {count} docs")

    print()
    print("✅ Ingest complete. Run `streamlit run app.py` to start AXIS.")


if __name__ == "__main__":
    ingest()
