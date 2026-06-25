"""
AXIS — SQLite database layer
Stores users (for auth) and per-user chat messages (for personalized history).
Local-first: a single file `axis.db` sits next to the vector store. No server needed.
"""

import json
import sqlite3
from pathlib import Path
from datetime import datetime, timezone

DB_PATH = Path("axis.db")

# Documents are identified everywhere by team + title. This packs them into one
# stable key for the feedback score table (the \x1f unit-separator can't appear
# in a normal title).
def doc_key(team: str, title: str) -> str:
    return f"{team}\x1f{title}"


def get_conn() -> sqlite3.Connection:
    """Open a new connection. One per request keeps things thread-safe under FastAPI."""
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def init_db() -> None:
    """Create tables if they don't exist. Safe to call on every startup."""
    conn = get_conn()
    try:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                email         TEXT UNIQUE NOT NULL,
                name          TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                created_at    TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS messages (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id    INTEGER NOT NULL,
                role       TEXT NOT NULL,          -- 'user' | 'axis'
                content    TEXT NOT NULL,
                sources    TEXT,                   -- JSON array, for axis messages
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id, id);

            CREATE TABLE IF NOT EXISTS feedback (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id     INTEGER NOT NULL,
                message_key TEXT NOT NULL,        -- client-side id of the answer
                question    TEXT,
                answer      TEXT,
                sources     TEXT,                 -- JSON array of {team,title,...}
                vote        INTEGER NOT NULL,     -- 1 = up, -1 = down
                created_at  TEXT NOT NULL,
                UNIQUE (user_id, message_key),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS doc_scores (
                doc_key    TEXT PRIMARY KEY,       -- team\x1ftitle
                score      INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL
            );
            """
        )
        conn.commit()
    finally:
        conn.close()


# ── Feedback ──────────────────────────────────────────────────────────────────

def record_feedback(
    user_id: int,
    message_key: str,
    question: str,
    answer: str,
    sources: list[dict],
    vote: int,
) -> dict:
    """
    Record (or change / clear) a user's vote on one answer, and adjust the running
    score of every source doc that answer used.

    vote: 1 = up, -1 = down, 0 = clear the vote.
    Uses a delta so flipping a vote (e.g. +1 -> -1) corrects doc scores exactly.
    """
    conn = get_conn()
    try:
        prev = conn.execute(
            "SELECT vote FROM feedback WHERE user_id = ? AND message_key = ?",
            (user_id, message_key),
        ).fetchone()
        old_vote = prev["vote"] if prev else 0
        delta = vote - old_vote

        if vote == 0:
            conn.execute(
                "DELETE FROM feedback WHERE user_id = ? AND message_key = ?",
                (user_id, message_key),
            )
        else:
            conn.execute(
                """
                INSERT INTO feedback (user_id, message_key, question, answer, sources, vote, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id, message_key) DO UPDATE SET
                    vote = excluded.vote,
                    question = excluded.question,
                    answer = excluded.answer,
                    sources = excluded.sources,
                    created_at = excluded.created_at
                """,
                (user_id, message_key, question, answer, json.dumps(sources), vote, now_iso()),
            )

        if delta != 0:
            for s in sources:
                key = doc_key(s.get("team", ""), s.get("title", ""))
                conn.execute(
                    """
                    INSERT INTO doc_scores (doc_key, score, updated_at)
                    VALUES (?, ?, ?)
                    ON CONFLICT(doc_key) DO UPDATE SET
                        score = score + excluded.score,
                        updated_at = excluded.updated_at
                    """,
                    (key, delta, now_iso()),
                )

        conn.commit()
        return {"vote": vote}
    finally:
        conn.close()


def get_all_doc_scores() -> dict[str, int]:
    """Return {doc_key: score} for every doc that has received feedback."""
    conn = get_conn()
    try:
        rows = conn.execute("SELECT doc_key, score FROM doc_scores").fetchall()
    finally:
        conn.close()
    return {r["doc_key"]: r["score"] for r in rows}


def feedback_summary() -> dict:
    """Aggregate counts, handy for showing 'the loop is learning' in the UI."""
    conn = get_conn()
    try:
        up = conn.execute("SELECT COUNT(*) c FROM feedback WHERE vote = 1").fetchone()["c"]
        down = conn.execute("SELECT COUNT(*) c FROM feedback WHERE vote = -1").fetchone()["c"]
        boosted = conn.execute("SELECT COUNT(*) c FROM doc_scores WHERE score != 0").fetchone()["c"]
    finally:
        conn.close()
    return {"up": up, "down": down, "docs_adjusted": boosted}
