"""
AXIS — BM25 keyword search index
Builds a BM25 index over all data/*.json files for hybrid retrieval.
"""

import json
from pathlib import Path
from typing import Optional

from rank_bm25 import BM25Okapi

DATA_DIR = Path("data")

DATA_FILES = [
    "engineering_docs.json",
    "data_team_docs.json",
    "crm_docs.json",
    "client_success_docs.json",
    "product_team_docs.json",
]


class BM25Index:
    def __init__(self):
        self._docs: list[dict] = []
        self._bm25: Optional[BM25Okapi] = None
        self._build()

    def _load_docs(self) -> list[dict]:
        docs = []
        for filename in DATA_FILES:
            path = DATA_DIR / filename
            if not path.exists():
                continue
            with open(path, "r") as f:
                try:
                    file_docs = json.load(f)
                    docs.extend(file_docs)
                except json.JSONDecodeError:
                    pass
        return docs

    def _build(self):
        self._docs = self._load_docs()
        if not self._docs:
            self._bm25 = None
            return
        tokenized = [self._tokenize(d.get("content", "")) for d in self._docs]
        self._bm25 = BM25Okapi(tokenized)

    def _tokenize(self, text: str) -> list[str]:
        return text.lower().split()

    def refresh(self):
        """Rebuild the index (call after sync or contribute)."""
        self._build()

    def search(self, query: str, team_filter: Optional[str] = None, top_k: int = 8) -> list[dict]:
        """Return top_k matching chunks with content, team, title, tags, relevance keys."""
        if self._bm25 is None or not self._docs:
            return []

        tokenized_query = self._tokenize(query)
        scores = self._bm25.get_scores(tokenized_query)

        # Pair scores with docs, apply optional team filter
        scored = []
        for score, doc in zip(scores, self._docs):
            if team_filter and doc.get("team") != team_filter:
                continue
            scored.append((score, doc))

        # Sort descending by score
        scored.sort(key=lambda x: x[0], reverse=True)
        top = scored[:top_k]

        results = []
        for score, doc in top:
            tags = doc.get("tags", [])
            if isinstance(tags, list):
                tags_str = ", ".join(tags)
            else:
                tags_str = str(tags)
            results.append({
                "content": doc.get("content", ""),
                "team": doc.get("team", ""),
                "title": doc.get("title", ""),
                "tags": tags_str,
                "url": doc.get("url", ""),
                "source": doc.get("source", ""),
                "relevance": round(float(score), 1),
            })

        return results
