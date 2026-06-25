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

            CREATE TABLE IF NOT EXISTS organizations (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                name       TEXT NOT NULL,
                onboarded  INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS connections (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                org_id     INTEGER NOT NULL,
                provider   TEXT NOT NULL,           -- jira | confluence | slack | notion | gdrive
                config     TEXT NOT NULL,           -- Fernet-encrypted JSON
                connected  INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL,
                UNIQUE (org_id, provider),
                FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS conversations (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id    INTEGER NOT NULL,
                title      TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id, updated_at);
            """
        )
        # Migration: add org_id to users if the table predates organizations.
        cols = [r["name"] for r in conn.execute("PRAGMA table_info(users)").fetchall()]
        if "org_id" not in cols:
            conn.execute("ALTER TABLE users ADD COLUMN org_id INTEGER")
        # Migration: add conversation_id to messages if it predates conversations.
        mcols = [r["name"] for r in conn.execute("PRAGMA table_info(messages)").fetchall()]
        if "conversation_id" not in mcols:
            conn.execute("ALTER TABLE messages ADD COLUMN conversation_id INTEGER")
        conn.commit()
    finally:
        conn.close()


# ── Secret encryption (for stored 3rd-party connection configs) ───────────────
import os
from functools import lru_cache

_KEY_FILE = Path(".axis_key")


@lru_cache(maxsize=1)
def _fernet():
    from cryptography.fernet import Fernet
    key = os.environ.get("AXIS_ENCRYPTION_KEY")
    if key:
        key = key.encode()
    elif _KEY_FILE.exists():
        key = _KEY_FILE.read_bytes()
    else:
        key = Fernet.generate_key()
        _KEY_FILE.write_bytes(key)  # gitignored; stable across restarts
    return Fernet(key)


def _encrypt(text: str) -> str:
    return _fernet().encrypt(text.encode()).decode()


def _decrypt(token: str) -> str:
    return _fernet().decrypt(token.encode()).decode()


# ── Organizations ─────────────────────────────────────────────────────────────

def create_organization(name: str) -> int:
    conn = get_conn()
    try:
        cur = conn.execute(
            "INSERT INTO organizations (name, onboarded, created_at) VALUES (?, 0, ?)",
            (name.strip() or "My Organization", now_iso()),
        )
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()


def get_organization(org_id: int) -> dict | None:
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT id, name, onboarded FROM organizations WHERE id = ?", (org_id,)
        ).fetchone()
    finally:
        conn.close()
    if not row:
        return None
    return {"id": row["id"], "name": row["name"], "onboarded": bool(row["onboarded"])}


def set_org_onboarded(org_id: int, value: bool = True) -> None:
    conn = get_conn()
    try:
        conn.execute("UPDATE organizations SET onboarded = ? WHERE id = ?",
                     (1 if value else 0, org_id))
        conn.commit()
    finally:
        conn.close()


# ── Connections (per-org 3rd-party credentials) ───────────────────────────────

def upsert_connection(org_id: int, provider: str, config: dict, connected: bool) -> None:
    conn = get_conn()
    try:
        conn.execute(
            """
            INSERT INTO connections (org_id, provider, config, connected, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(org_id, provider) DO UPDATE SET
                config = excluded.config,
                connected = excluded.connected,
                updated_at = excluded.updated_at
            """,
            (org_id, provider, _encrypt(json.dumps(config)), 1 if connected else 0, now_iso()),
        )
        conn.commit()
    finally:
        conn.close()


def list_connections(org_id: int) -> list[dict]:
    """Provider + status only — never returns the secret config."""
    conn = get_conn()
    try:
        rows = conn.execute(
            "SELECT provider, connected, updated_at FROM connections WHERE org_id = ?",
            (org_id,),
        ).fetchall()
    finally:
        conn.close()
    return [{"provider": r["provider"], "connected": bool(r["connected"]),
             "updated_at": r["updated_at"]} for r in rows]


def get_connection_config(org_id: int, provider: str) -> dict | None:
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT config FROM connections WHERE org_id = ? AND provider = ?",
            (org_id, provider),
        ).fetchone()
    finally:
        conn.close()
    if not row:
        return None
    return json.loads(_decrypt(row["config"]))


def delete_connection(org_id: int, provider: str) -> None:
    conn = get_conn()
    try:
        conn.execute("DELETE FROM connections WHERE org_id = ? AND provider = ?",
                     (org_id, provider))
        conn.commit()
    finally:
        conn.close()


# ── Conversations (multi-chat history) ────────────────────────────────────────

def create_conversation(user_id: int, title: str) -> int:
    conn = get_conn()
    try:
        ts = now_iso()
        cur = conn.execute(
            "INSERT INTO conversations (user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
            (user_id, title[:80] or "New chat", ts, ts),
        )
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()


def list_conversations(user_id: int) -> list[dict]:
    conn = get_conn()
    try:
        rows = conn.execute(
            "SELECT id, title, updated_at FROM conversations WHERE user_id = ? ORDER BY updated_at DESC",
            (user_id,),
        ).fetchall()
    finally:
        conn.close()
    return [{"id": r["id"], "title": r["title"], "updated_at": r["updated_at"]} for r in rows]


def add_message(conversation_id: int, user_id: int, role: str, content: str,
                sources: list | None = None) -> None:
    conn = get_conn()
    try:
        conn.execute(
            "INSERT INTO messages (user_id, conversation_id, role, content, sources, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (user_id, conversation_id, role, content,
             json.dumps(sources) if sources is not None else None, now_iso()),
        )
        conn.execute("UPDATE conversations SET updated_at = ? WHERE id = ?",
                     (now_iso(), conversation_id))
        conn.commit()
    finally:
        conn.close()


def get_conversation_messages(user_id: int, conversation_id: int) -> list[dict] | None:
    conn = get_conn()
    try:
        owner = conn.execute(
            "SELECT 1 FROM conversations WHERE id = ? AND user_id = ?",
            (conversation_id, user_id),
        ).fetchone()
        if not owner:
            return None
        rows = conn.execute(
            "SELECT role, content, sources FROM messages WHERE conversation_id = ? ORDER BY id",
            (conversation_id,),
        ).fetchall()
    finally:
        conn.close()
    return [{"role": r["role"], "content": r["content"],
             "sources": json.loads(r["sources"]) if r["sources"] else []} for r in rows]


def delete_conversation(user_id: int, conversation_id: int) -> None:
    conn = get_conn()
    try:
        conn.execute("DELETE FROM messages WHERE conversation_id = ? AND user_id = ?",
                     (conversation_id, user_id))
        conn.execute("DELETE FROM conversations WHERE id = ? AND user_id = ?",
                     (conversation_id, user_id))
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
