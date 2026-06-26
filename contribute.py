"""
AXIS — Contribution Engine
Lets employees submit new context entries that are immediately searchable.
"""

import json
import os
import re
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

    new_doc = {
        "id": new_id,
        "team": team,
        "title": title,
        "content": content,
        "tags": tags,
        **({"author": author} if author else {}),
    }

    docs.append(new_doc)

    with open(file_path, "w") as f:
        json.dump(docs, f, indent=2)

    # Live-add to ChromaDB (no full re-ingest needed)
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
        }],
    )

    # Refresh BM25 index so new doc is immediately searchable
    try:
        from query import get_bm25_index
        get_bm25_index().refresh()
    except Exception:
        pass

    return new_id


def get_doc_count() -> dict[str, int]:
    """Return per-team doc counts from the JSON files."""
    counts = {}
    for team, filename in TEAM_FILE_MAP.items():
        path = DATA_DIR / filename
        with open(path, "r") as f:
            counts[team] = len(json.load(f))
    return counts
