"""AXIS — FastAPI backend"""

import os
from dotenv import load_dotenv
# Loads .env from the working dir if present (local dev). In cloud deploys there
# is no .env — secrets come from the host's environment, so this is a safe no-op.
load_dotenv()

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from typing import Optional

from query import ask
from contribute import submit_context, get_doc_count
from sync import sync_jira, sync_confluence, sync_slack, sync_notion, sync_gdrive, sync_all
from scheduler import start as start_scheduler, status as scheduler_status, stop as stop_scheduler, get_events_since
import secrets
from datetime import datetime, timedelta, timezone

from db import (
    init_db, create_organization, get_organization, set_org_onboarded,
    list_connections, get_connection_config, upsert_connection, delete_connection,
    create_conversation, list_conversations, add_message,
    get_conversation_messages, delete_conversation, conversation_belongs_to,
    upsert_pending_signup, get_pending_signup, bump_pending_attempts,
    delete_pending_signup, email_exists,
)
from auth import (
    create_user, authenticate, create_token, get_current_user, get_optional_user,
    hash_password, create_user_prehashed, decode_token, get_user_by_id,
)
import connections as conn_helpers
import mailer
import oauth

app = FastAPI(title="AXIS API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _ensure_seeded():
    """Re-ingest seed docs if the vector store is empty (e.g. fresh/ephemeral deploy)."""
    try:
        import chromadb
        from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction
        client = chromadb.PersistentClient(path="axis_db")
        col = client.get_collection(
            "axis_context",
            embedding_function=SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2"),
        )
        if col.count() > 0:
            return  # already has data — don't wipe
    except Exception:
        pass
    try:
        import ingest
        ingest.ingest()
    except Exception as e:
        print(f"Seed ingest skipped: {e}", flush=True)


@app.on_event("startup")
async def on_startup():
    init_db()
    _ensure_seeded()
    start_scheduler()


# ── Models ────────────────────────────────────────────────────────────────────

class AskRequest(BaseModel):
    question: str
    team_filter: Optional[str] = None
    history: list = []
    conversation_id: Optional[int] = None


class ContributeRequest(BaseModel):
    team: str
    title: str
    content: str
    author: Optional[str] = ""
    tags: list[str] = []


class SyncRequest(BaseModel):
    target: str = "both"  # "jira" | "confluence" | "both"


class RegisterRequest(BaseModel):
    email: str
    name: str
    password: str
    password_confirm: Optional[str] = None
    org_name: Optional[str] = ""


class VerifyOtpRequest(BaseModel):
    email: str
    code: str


class ResendOtpRequest(BaseModel):
    email: str


class LoginRequest(BaseModel):
    email: str
    password: str


class FeedbackRequest(BaseModel):
    message_key: str
    question: str = ""
    answer: str = ""
    sources: list = []
    vote: int  # 1 = up, -1 = down, 0 = clear


class ConnectionRequest(BaseModel):
    provider: str
    config: dict = {}


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok"}


# ── Auth ──────────────────────────────────────────────────────────────────────

def _org_payload(org_id) -> dict:
    org = get_organization(org_id) if org_id else None
    return org or {"id": None, "name": "", "onboarded": True}


def _auth_response(user: dict) -> dict:
    token = create_token(user["id"], user["email"])
    return {"token": token, "user": user, "org": _org_payload(user.get("org_id"))}


OTP_TTL_MINUTES = 10
OTP_MAX_ATTEMPTS = 5


def _start_verification(email, name, org_name, password_hash):
    """Generate + store an OTP and email it. Returns dev_code (only when not emailed)."""
    code = f"{secrets.randbelow(1_000_000):06d}"
    expires = (datetime.now(timezone.utc) + timedelta(minutes=OTP_TTL_MINUTES)).isoformat()
    upsert_pending_signup(email, name, org_name, password_hash, code, expires)
    sent = mailer.send_otp_email(email, code)
    return None if sent else code  # dev mode: surface the code so the flow is testable


@app.post("/api/auth/register")
def register(req: RegisterRequest):
    email = req.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="A valid email is required.")
    if not req.name.strip():
        raise HTTPException(status_code=400, detail="Name is required.")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
    if req.password_confirm is not None and req.password != req.password_confirm:
        raise HTTPException(status_code=400, detail="Passwords do not match.")
    if email_exists(email):
        raise HTTPException(status_code=409, detail="An account with that email already exists.")

    org_name = req.org_name or f"{req.name.strip()}'s workspace"
    dev_code = _start_verification(email, req.name, org_name, hash_password(req.password))
    return {"pending": True, "email": email, "dev_code": dev_code}


@app.post("/api/auth/verify-otp")
def verify_otp(req: VerifyOtpRequest):
    email = req.email.strip().lower()
    pending = get_pending_signup(email)
    if not pending:
        raise HTTPException(status_code=400, detail="No pending verification for this email. Please sign up again.")
    if pending["expires_at"] < datetime.now(timezone.utc).isoformat():
        delete_pending_signup(email)
        raise HTTPException(status_code=400, detail="Code expired. Please request a new one.")
    if pending["attempts"] >= OTP_MAX_ATTEMPTS:
        delete_pending_signup(email)
        raise HTTPException(status_code=429, detail="Too many attempts. Please sign up again.")
    if req.code.strip() != pending["code"]:
        bump_pending_attempts(email)
        raise HTTPException(status_code=400, detail="Incorrect code. Please try again.")

    # Verified — create the org + user now.
    org_id = create_organization(pending["org_name"] or f"{pending['name']}'s workspace")
    user = create_user_prehashed(email, pending["name"], pending["password_hash"], org_id)
    delete_pending_signup(email)
    return _auth_response(user)


@app.post("/api/auth/resend-otp")
def resend_otp(req: ResendOtpRequest):
    email = req.email.strip().lower()
    pending = get_pending_signup(email)
    if not pending:
        raise HTTPException(status_code=400, detail="No pending verification for this email.")
    dev_code = _start_verification(email, pending["name"], pending["org_name"], pending["password_hash"])
    return {"pending": True, "email": email, "dev_code": dev_code}


@app.post("/api/auth/login")
def login(req: LoginRequest):
    user = authenticate(req.email, req.password)
    return _auth_response(user)


@app.get("/api/auth/me")
def me(user: dict = Depends(get_current_user)):
    return {"user": user, "org": _org_payload(user.get("org_id"))}


# ── Onboarding / connections ──────────────────────────────────────────────────

@app.get("/api/connections")
def get_connections(user: dict = Depends(get_current_user)):
    conns = list_connections(user["org_id"])
    # annotate each connection with the team(s) its docs are filed under (not secret)
    for c in conns:
        cfg = get_connection_config(user["org_id"], c["provider"]) or {}
        c["teams"] = conn_helpers.connection_teams(c["provider"], cfg)
    return {
        "providers": conn_helpers.PROVIDERS,
        "connections": conns,
        "oauth": oauth.oauth_providers(),  # providers offering one-click Connect
    }


# ── OAuth "Connect" flows ─────────────────────────────────────────────────────

@app.get("/api/connect/notion/start")
def notion_oauth_start(token: str):
    # Browser navigation (no auth header) → identity comes via the ?token query param.
    payload = decode_token(token)
    user = get_user_by_id(int(payload["sub"])) if payload else None
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated.")
    if not oauth.configured("notion"):
        raise HTTPException(status_code=400, detail="Notion OAuth is not configured on the server.")
    state = oauth.make_state(user["id"], user["org_id"])
    return RedirectResponse(oauth.notion_authorize_url(state))


@app.get("/api/connect/notion/callback")
def notion_oauth_callback(code: Optional[str] = None, state: Optional[str] = None,
                          error: Optional[str] = None):
    st = oauth.read_state(state) if state else None
    if error or not code or not st:
        return RedirectResponse(f"{oauth.FRONTEND_URL}/?connect_error=notion")
    try:
        config = oauth.notion_exchange(code)
        upsert_connection(st["org"], "notion", config, connected=True)
    except Exception:
        return RedirectResponse(f"{oauth.FRONTEND_URL}/?connect_error=notion")
    return RedirectResponse(f"{oauth.FRONTEND_URL}/?connected=notion")


@app.post("/api/connections/test")
def test_connection(req: ConnectionRequest, user: dict = Depends(get_current_user)):
    if req.provider not in conn_helpers.PROVIDERS:
        raise HTTPException(status_code=400, detail="Unknown provider.")
    ok, message = conn_helpers.test_connection(req.provider, req.config)
    return {"ok": ok, "message": message}


@app.put("/api/connections")
def save_connection(req: ConnectionRequest, user: dict = Depends(get_current_user)):
    if req.provider not in conn_helpers.PROVIDERS:
        raise HTTPException(status_code=400, detail="Unknown provider.")
    ok, message = conn_helpers.test_connection(req.provider, req.config)
    upsert_connection(user["org_id"], req.provider, req.config, connected=ok)
    return {"connected": ok, "message": message}


@app.delete("/api/connections/{provider}")
def remove_connection(provider: str, user: dict = Depends(get_current_user)):
    delete_connection(user["org_id"], provider)
    return {"ok": True}


@app.post("/api/onboarding/complete")
def complete_onboarding(user: dict = Depends(get_current_user)):
    set_org_onboarded(user["org_id"], True)
    return {"onboarded": True}


# ── Feedback ──────────────────────────────────────────────────────────────────

@app.post("/api/feedback")
def feedback(req: FeedbackRequest, user: dict = Depends(get_current_user)):
    if req.vote not in (-1, 0, 1):
        raise HTTPException(status_code=400, detail="vote must be -1, 0, or 1.")
    from db import record_feedback
    from query import refresh_doc_scores
    res = record_feedback(
        user_id=user["id"],
        message_key=req.message_key,
        question=req.question,
        answer=req.answer,
        sources=req.sources,
        vote=req.vote,
    )
    refresh_doc_scores()  # next query picks up the new scores
    return res


@app.get("/api/feedback/summary")
def feedback_stats():
    from db import feedback_summary
    return feedback_summary()


@app.get("/api/stats")
def stats():
    counts = get_doc_count()
    return {
        "total": sum(counts.values()),
        "teams": 5,
        "byTeam": counts,
    }


@app.post("/api/ask")
def ask_axis(req: AskRequest, user: Optional[dict] = Depends(get_optional_user)):
    try:
        answer, sources = ask(
            req.question,
            chat_history=req.history or None,
            team_filter=req.team_filter,
        )
        clean_sources = [
            {
                "team": s["team"],
                "title": s["title"],
                "relevance": s["relevance"],
                "url": s.get("url", ""),
                "source": s.get("source", ""),
            }
            for s in sources
        ]

        # Persist the exchange for logged-in users (anonymous callers aren't saved).
        conversation_id, title = req.conversation_id, None
        if user:
            # Never write into a conversation the caller doesn't own — start fresh instead.
            if conversation_id and not conversation_belongs_to(user["id"], conversation_id):
                conversation_id = None
            if not conversation_id:
                title = req.question.strip()[:48] or "New chat"
                conversation_id = create_conversation(user["id"], title)
            add_message(conversation_id, user["id"], "user", req.question)
            add_message(conversation_id, user["id"], "axis", answer, clean_sources)

        return {
            "answer": answer,
            "sources": clean_sources,
            "conversation_id": conversation_id,
            "title": title,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Conversations ─────────────────────────────────────────────────────────────

@app.get("/api/conversations")
def get_conversations(user: dict = Depends(get_current_user)):
    return {"conversations": list_conversations(user["id"])}


@app.get("/api/conversations/{conversation_id}")
def get_conversation(conversation_id: int, user: dict = Depends(get_current_user)):
    msgs = get_conversation_messages(user["id"], conversation_id)
    if msgs is None:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    return {"messages": msgs}


@app.delete("/api/conversations/{conversation_id}")
def remove_conversation(conversation_id: int, user: dict = Depends(get_current_user)):
    delete_conversation(user["id"], conversation_id)
    return {"ok": True}


def _apply_org_connections(org_id, target):
    """Load the org's stored connection configs and set the env vars sync reads."""
    if not org_id:
        return
    providers = conn_helpers.PROVIDERS if target == "both" else [target]
    for provider in providers:
        cfg = get_connection_config(org_id, provider)
        if cfg:
            conn_helpers.apply_env(provider, cfg)


@app.post("/api/sync")
def do_sync(req: SyncRequest, user: Optional[dict] = Depends(get_optional_user)):
    log = []
    try:
        # If the caller is logged in, drive sync from their org's stored connections;
        # otherwise fall back to whatever is configured in the environment (.env).
        if user:
            _apply_org_connections(user.get("org_id"), req.target)
        if req.target == "jira":
            res = sync_jira(progress_cb=log.append)
            return {"jira": res["synced"], "confluence": None, "slack": None, "log": log}
        elif req.target == "confluence":
            res = sync_confluence(progress_cb=log.append)
            return {"jira": None, "confluence": res["synced"], "slack": None, "log": log}
        elif req.target == "slack":
            res = sync_slack(progress_cb=log.append)
            return {"slack": res["synced"], "log": log}
        elif req.target == "notion":
            res = sync_notion(progress_cb=log.append)
            return {"notion": res["synced"], "log": log}
        elif req.target == "gdrive":
            res = sync_gdrive(progress_cb=log.append)
            return {"gdrive": res["synced"], "log": log}
        else:
            res = sync_all(progress_cb=log.append)
            return {
                "jira": res["jira"]["synced"] if res["jira"] else None,
                "confluence": res["confluence"]["synced"] if res["confluence"] else None,
                "slack": res["slack"]["synced"] if res["slack"] else None,
                "notion": res["notion"]["synced"] if res["notion"] else None,
                "gdrive": res["gdrive"]["synced"] if res["gdrive"] else None,
                "errors": res.get("errors", []),
                "log": log,
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/scheduler")
def get_scheduler_status():
    return scheduler_status()


@app.get("/api/sync-events")
def sync_events(since: Optional[str] = None):
    """Poll for sync events newer than `since` (ISO timestamp)."""
    return {"events": get_events_since(since)}


@app.post("/api/contribute")
def contribute(req: ContributeRequest):
    try:
        new_id = submit_context(
            team=req.team,
            title=req.title,
            content=req.content,
            author=req.author,
            tags=req.tags,
        )
        return {"id": new_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
