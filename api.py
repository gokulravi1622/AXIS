"""AXIS — FastAPI backend"""

import os
from dotenv import load_dotenv
# Loads .env from the working dir if present (local dev). In cloud deploys there
# is no .env — secrets come from the host's environment, so this is a safe no-op.
load_dotenv()

import json as _json
import asyncio
import uuid
import logging
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.logging import LoggingIntegration
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, HTMLResponse, StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional

# ── Structured logging ────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='{"time":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","msg":%(message)s}',
)
logger = logging.getLogger("axis.api")

# ── Sentry (opt-in via SENTRY_DSN env var) ────────────────────────────────────
_sentry_dsn = os.environ.get("SENTRY_DSN", "")
if _sentry_dsn:
    sentry_sdk.init(
        dsn=_sentry_dsn,
        integrations=[
            FastApiIntegration(),
            LoggingIntegration(level=logging.INFO, event_level=logging.ERROR),
        ],
        traces_sample_rate=0.2,
        environment=os.environ.get("AXIS_ENV", "production"),
    )
    logger.info('"Sentry initialised"')

# ── Background sync job registry ─────────────────────────────────────────────
_sync_jobs: dict[str, dict] = {}   # job_id → {status, log, result, error, started_at, finished_at}

from query import ask, build_ask_messages, stream_answer, NO_CONTEXT_THRESHOLD
from contribute import submit_context, get_doc_count, extract_text
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
    create_context_request, get_context_request, list_context_requests_for_user,
    approve_context_request, reject_context_request, revoke_context_request,
    get_active_grants_for_email, create_notification, list_notifications,
    mark_notifications_read, create_direct_share,
)
from auth import (
    create_user, authenticate, create_token, get_current_user, get_optional_user,
    hash_password, create_user_prehashed, decode_token, get_user_by_id, get_user_by_email,
)
import connections as conn_helpers
import mailer
from mcp_server import router as mcp_router
import oauth
from email_service import (
    send_context_request_email, send_request_approved_email,
    send_request_rejected_email, send_access_revoked_email,
)

app = FastAPI(title="AXIS API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(mcp_router)


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
    try:
        init_db()
    except Exception as e:
        logger.error(f'"DB init failed at startup" error="{e}"')
    try:
        _ensure_seeded()
    except Exception as e:
        logger.error(f'"Seed ingest failed at startup" error="{e}"')
    try:
        start_scheduler()
    except Exception as e:
        logger.error(f'"Scheduler start failed" error="{e}"')


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


class ContextRequestCreate(BaseModel):
    approver_email: str = Field(..., max_length=254)
    topic: str = Field(..., max_length=500)


class ApproveBody(BaseModel):
    duration_type: str  # "24h" or "session"


class ContributionUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    content: Optional[str] = Field(None, max_length=50_000)
    tags: Optional[list[str]] = None


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/mcp/install-claude-code")
def install_mcp_claude_code(user: dict = Depends(get_current_user)):
    """Write the AXIS MCP entry directly into ~/.claude/settings.json."""
    import json as _json_mod
    from pathlib import Path

    settings_path = Path.home() / ".claude" / "settings.json"
    settings_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        with open(settings_path) as f:
            settings = _json_mod.load(f)
    except (FileNotFoundError, ValueError):
        settings = {}

    fresh_token = create_token(user["id"], user["email"])

    settings.setdefault("mcpServers", {})["axis"] = {
        "type": "http",
        "url": "http://localhost:8000/mcp",
        "headers": {"Authorization": f"Bearer {fresh_token}"},
    }

    tmp = settings_path.with_suffix(".tmp")
    with open(tmp, "w") as f:
        _json_mod.dump(settings, f, indent=2)
    tmp.replace(settings_path)

    return {"status": "ok", "path": str(settings_path)}


@app.post("/api/mcp/install-claude-desktop")
def install_mcp_claude_desktop(user: dict = Depends(get_current_user)):
    """Write a stdio bridge script + update Claude Desktop config.

    Claude Desktop only supports stdio MCP servers (command+args), not HTTP URLs.
    We write a tiny Python bridge that forwards stdin JSON-RPC to localhost:8000/mcp.
    """
    import json as _json_mod
    from pathlib import Path
    import platform
    import stat

    fresh_token = create_token(user["id"], user["email"])

    # ── Write the bridge script ───────────────────────────────────────────────
    bridge_path = Path.home() / ".axis_mcp_bridge.py"
    bridge_script = (
        '#!/usr/bin/env python3\n'
        '"""AXIS MCP stdio bridge — forwards JSON-RPC from stdin to the AXIS HTTP MCP server."""\n'
        'import sys, json, urllib.request\n\n'
        f'URL = "http://localhost:8000/mcp"\n'
        f'TOKEN = {repr(fresh_token)}\n\n'
        'for line in sys.stdin:\n'
        '    line = line.strip()\n'
        '    if not line:\n'
        '        continue\n'
        '    try:\n'
        '        msg = json.loads(line)\n'
        '    except json.JSONDecodeError:\n'
        '        continue\n'
        '    req = urllib.request.Request(\n'
        '        URL,\n'
        '        data=json.dumps(msg).encode(),\n'
        '        headers={"Content-Type": "application/json", "Authorization": f"Bearer {TOKEN}"},\n'
        '        method="POST",\n'
        '    )\n'
        '    try:\n'
        '        with urllib.request.urlopen(req, timeout=30) as resp:\n'
        '            body = resp.read()\n'
        '            if body.strip():\n'
        '                result = json.loads(body)\n'
        '                if result:\n'
        '                    print(json.dumps(result), flush=True)\n'
        '    except Exception as e:\n'
        '        err = {"jsonrpc": "2.0", "id": msg.get("id"), "error": {"code": -32603, "message": str(e)}}\n'
        '        print(json.dumps(err), flush=True)\n'
    )
    bridge_path.write_text(bridge_script)
    bridge_path.chmod(0o700)  # owner-only: token is embedded in plaintext

    # ── Update Claude Desktop config ─────────────────────────────────────────
    if platform.system() == "Darwin":
        config_path = Path.home() / "Library" / "Application Support" / "Claude" / "claude_desktop_config.json"
    elif platform.system() == "Windows":
        config_path = Path(os.environ.get("APPDATA", "")) / "Claude" / "claude_desktop_config.json"
    else:
        config_path = Path.home() / ".config" / "Claude" / "claude_desktop_config.json"

    config_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        with open(config_path) as f:
            config = _json_mod.load(f)
    except (FileNotFoundError, ValueError):
        config = {}

    config.setdefault("mcpServers", {})["axis"] = {
        "command": "python3",
        "args": [str(bridge_path)],
    }

    tmp = config_path.with_suffix(".tmp")
    with open(tmp, "w") as f:
        _json_mod.dump(config, f, indent=2)
    tmp.replace(config_path)

    return {"status": "ok", "path": str(config_path), "bridge": str(bridge_path)}


@app.get("/api/mcp/bridge-script")
def download_bridge_script(request: Request, user: dict = Depends(get_current_user)):
    """Return a personalised stdio bridge script for Claude Desktop (hosted deployments)."""
    from fastapi.responses import Response as _Response

    fresh_token = create_token(user["id"], user["email"])
    mcp_url = str(request.base_url).rstrip("/") + "/mcp"

    bridge = (
        '#!/usr/bin/env python3\n'
        '"""AXIS MCP stdio bridge — forwards JSON-RPC from stdin to the AXIS HTTP MCP server."""\n'
        'import sys, json, urllib.request\n\n'
        f'URL = {repr(mcp_url)}\n'
        f'TOKEN = {repr(fresh_token)}\n\n'
        'for line in sys.stdin:\n'
        '    line = line.strip()\n'
        '    if not line:\n'
        '        continue\n'
        '    try:\n'
        '        msg = json.loads(line)\n'
        '    except json.JSONDecodeError:\n'
        '        continue\n'
        '    req = urllib.request.Request(\n'
        '        URL,\n'
        '        data=json.dumps(msg).encode(),\n'
        '        headers={"Content-Type": "application/json", "Authorization": f"Bearer {TOKEN}"},\n'
        '        method="POST",\n'
        '    )\n'
        '    try:\n'
        '        with urllib.request.urlopen(req, timeout=30) as resp:\n'
        '            body = resp.read()\n'
        '            if body.strip():\n'
        '                result = json.loads(body)\n'
        '                if result:\n'
        '                    print(json.dumps(result), flush=True)\n'
        '    except urllib.error.HTTPError as e:\n'
        '        body = e.read().decode(errors="replace")\n'
        '        err = {"jsonrpc": "2.0", "id": msg.get("id"), "error": {"code": -32603, "message": f"{e} — {body[:200]}"}}\n'
        '        print(json.dumps(err), flush=True)\n'
        '    except Exception as e:\n'
        '        err = {"jsonrpc": "2.0", "id": msg.get("id"), "error": {"code": -32603, "message": str(e)}}\n'
        '        print(json.dumps(err), flush=True)\n'
    )
    return _Response(
        content=bridge,
        media_type="text/plain",
        headers={"Content-Disposition": 'attachment; filename="axis_mcp_bridge.py"'},
    )


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

@app.get("/api/connect/{provider}/start")
def oauth_start(provider: str, token: str):
    # Browser navigation (no auth header) → identity comes via the ?token query param.
    payload = decode_token(token)
    user = get_user_by_id(int(payload["sub"])) if payload else None
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated.")
    if not oauth.configured(provider):
        raise HTTPException(status_code=400, detail=f"{provider} OAuth is not configured on the server.")
    state = oauth.make_state(user["id"], user["org_id"], provider)
    return RedirectResponse(oauth.authorize_url(provider, state))


@app.get("/api/connect/{provider}/callback")
def oauth_callback(provider: str, code: Optional[str] = None, state: Optional[str] = None,
                   error: Optional[str] = None):
    # No OAuth params → this is a provider validating the redirect URL (Slack fetches
    # it). Respond 200 WITHOUT a cross-domain redirect, or Slack rejects the URL.
    if not code and not state and not error:
        return HTMLResponse("<!doctype html><title>AXIS</title><p>AXIS connection endpoint.</p>")
    st = oauth.read_state(state) if state else None
    if error or not code or not st:
        return RedirectResponse(f"{oauth.FRONTEND_URL}/?connect_error={provider}")
    # jira/confluence share the atlassian callback — the real target is carried in state
    target = st.get("prov", provider)
    try:
        config = oauth.exchange(target, code)
        upsert_connection(st["org"], target, config, connected=True)
    except Exception:
        return RedirectResponse(f"{oauth.FRONTEND_URL}/?connect_error={target}")
    return RedirectResponse(f"{oauth.FRONTEND_URL}/?connected={target}")


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


def _merge_shared_context(base_sources: list[dict], user: Optional[dict]) -> list[dict]:
    """
    For each active context grant the user has, retrieve additional chunks for the
    grant topic and merge them into the sources list (deduplicated by title).
    Shared sources are annotated with shared=True and shared_from=approver_email.
    """
    if not user:
        return base_sources
    try:
        from query import hybrid_retrieve
        grants = get_active_grants_for_email(user["email"], org_id=user.get("org_id"))
        seen_titles = {s["title"] for s in base_sources}
        extra = []
        for grant in grants:
            shared_chunks = hybrid_retrieve(grant["topic"])
            for c in shared_chunks[:3]:
                if c["title"] not in seen_titles:
                    seen_titles.add(c["title"])
                    extra.append({
                        "team": c["team"],
                        "title": c["title"],
                        "relevance": c["relevance"],
                        "url": c.get("url", ""),
                        "source": c.get("source", ""),
                        "content": c.get("content", ""),
                        "shared": True,
                        "shared_from": grant["approver_email"],
                    })
        return base_sources + extra
    except Exception as e:
        logger.warning(f'"shared context merge failed" error="{e}"')
        return base_sources


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
                "content": s.get("content", ""),
                **({"enriched": s["enriched"]} if s.get("enriched") else {}),
            }
            for s in sources
        ]

        # Inject shared context from active grants
        clean_sources = _merge_shared_context(clean_sources, user)

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
        logger.error(f'"ask failed" question="{req.question[:80]}" error="{e}"')
        if _sentry_dsn:
            sentry_sdk.capture_exception(e)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ask/stream")
async def ask_stream(req: AskRequest, user: Optional[dict] = Depends(get_optional_user)):
    """Server-Sent Events streaming endpoint. Yields sources first, then tokens."""
    def _sse(obj: dict) -> str:
        return f"data: {_json.dumps(obj)}\n\n"

    def event_generator():
        try:
            messages, chunks = build_ask_messages(
                req.question,
                chat_history=req.history[-6:] if req.history else None,
                team_filter=req.team_filter,
            )

            # No relevant context in own search — check shared context grants first
            if messages is None:
                shared_chunks = []
                if user:
                    try:
                        from query import hybrid_retrieve, build_messages_from_chunks
                        grants = get_active_grants_for_email(user["email"], org_id=user.get("org_id"))
                        seen_titles: set = set()
                        for grant in grants:
                            for c in hybrid_retrieve(grant["topic"])[:3]:
                                if c["title"] not in seen_titles and c["relevance"] >= 10:
                                    seen_titles.add(c["title"])
                                    shared_chunks.append({
                                        **{k: c[k] for k in ("team","title","relevance","url","source","content") if k in c},
                                        "shared": True,
                                        "shared_from": grant["approver_email"],
                                    })
                    except Exception as _e:
                        logger.warning(f'"shared context fallback failed" error="{_e}"')

                if not shared_chunks:
                    yield _sse({"type": "sources", "sources": []})
                    yield _sse({"type": "token", "text": "AXIS does not have this information in its knowledge base.\n\nTry asking a teammate who may have documented it, or contribute the answer yourself so others can find it later."})
                    yield _sse({"type": "done", "no_context": True})
                    return

                # Rebuild messages from shared chunks
                from query import build_messages_from_chunks
                messages = build_messages_from_chunks(
                    req.question,
                    shared_chunks,
                    chat_history=req.history[-6:] if req.history else None,
                )
                clean_sources = shared_chunks
            else:
                clean_sources = [
                    {
                        "team": c["team"],
                        "title": c["title"],
                        "relevance": c["relevance"],
                        "url": c.get("url", ""),
                        "source": c.get("source", ""),
                        "content": c.get("content", ""),
                        "contributed_by": c.get("contributed_by", ""),
                        **({"enriched": c["enriched"]} if c.get("enriched") else {}),
                    }
                    for c in chunks
                ]

                # Filter out private contributed docs the user has no grant for
                if user:
                    try:
                        active_grant_emails = {g["approver_email"] for g in get_active_grants_for_email(user["email"], org_id=user.get("org_id"))}
                        active_grant_emails.add(user["email"])  # own contributions always visible
                    except Exception:
                        active_grant_emails = {user["email"]}
                    clean_sources = [
                        s for s in clean_sources
                        if not s.get("contributed_by") or s["contributed_by"] in active_grant_emails
                    ]

                # If filtering removed all meaningful context, return no-context
                if not clean_sources or max((s["relevance"] for s in clean_sources), default=0) < NO_CONTEXT_THRESHOLD:
                    yield _sse({"type": "sources", "sources": []})
                    yield _sse({"type": "token", "text": "AXIS does not have this information in its knowledge base.\n\nTry asking a teammate who may have documented it, or contribute the answer yourself so others can find it later."})
                    yield _sse({"type": "done", "no_context": True})
                    return

                # Strip contributed_by before sending to frontend
                clean_sources = [{k: v for k, v in s.items() if k != "contributed_by"} for s in clean_sources]

                # Inject shared context from active grants
                clean_sources = _merge_shared_context(clean_sources, user)

            yield _sse({"type": "sources", "sources": clean_sources})

            from query import _REFUSAL_PREFIX, _clean_answer
            full_answer = []
            refusal_done = False
            for token in stream_answer(messages):
                full_answer.append(token)
                so_far = "".join(full_answer)
                # Once we have the full refusal prefix, emit it once then stop streaming
                if not refusal_done and so_far.lstrip().startswith(_REFUSAL_PREFIX):
                    refusal_done = True
                    yield _sse({"type": "token", "text": _REFUSAL_PREFIX})
                elif not refusal_done and not _REFUSAL_PREFIX.startswith(so_far.lstrip()):
                    yield _sse({"type": "token", "text": token})

            answer = _clean_answer("".join(full_answer))
            yield _sse({"type": "done"})

            # Persist for logged-in users
            if user:
                conversation_id = req.conversation_id
                if conversation_id and not conversation_belongs_to(user["id"], conversation_id):
                    conversation_id = None
                if not conversation_id:
                    conversation_id = create_conversation(user["id"], req.question.strip()[:48] or "New chat")
                add_message(conversation_id, user["id"], "user", req.question)
                add_message(conversation_id, user["id"], "axis", answer, clean_sources)
                yield _sse({"type": "conversation_id", "id": conversation_id})

        except Exception as e:
            yield _sse({"type": "error", "message": str(e)})

    return StreamingResponse(event_generator(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


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
            # so the OAuth token-refresh can persist a rotated refresh token
            if provider == "jira" and cfg.get("refresh_token"):
                os.environ["JIRA_OAUTH_ORG_ID"] = str(org_id)
            if provider == "confluence" and cfg.get("refresh_token"):
                os.environ["CONFLUENCE_OAUTH_ORG_ID"] = str(org_id)


def _run_sync_blocking(target: str, log: list, org_id=None) -> dict:
    """Blocking sync — called inside asyncio.to_thread so it doesn't block the event loop."""
    if org_id:
        _apply_org_connections(org_id, target)
    if target == "jira":
        res = sync_jira(progress_cb=log.append)
        return {"jira": res.get("synced", 0)}
    elif target == "confluence":
        res = sync_confluence(progress_cb=log.append)
        return {"confluence": res.get("synced", 0)}
    elif target == "slack":
        res = sync_slack(progress_cb=log.append)
        return {"slack": res.get("synced", 0)}
    elif target == "notion":
        res = sync_notion(progress_cb=log.append)
        return {"notion": res.get("synced", 0)}
    elif target == "gdrive":
        res = sync_gdrive(progress_cb=log.append)
        return {"gdrive": res.get("synced", 0)}
    else:
        res = sync_all(progress_cb=log.append)
        return {
            "jira": res["jira"].get("synced") if res.get("jira") else None,
            "confluence": res["confluence"].get("synced") if res.get("confluence") else None,
            "slack": res["slack"].get("synced") if res.get("slack") else None,
            "gdrive": res["gdrive"].get("synced") if res.get("gdrive") else None,
            "errors": res.get("errors", []),
        }


async def _run_sync_job(job_id: str, target: str, org_id=None):
    job = _sync_jobs[job_id]
    job["status"] = "running"
    logger.info(f'"Sync job {job_id} started" target="{target}"')
    try:
        result = await asyncio.to_thread(_run_sync_blocking, target, job["log"], org_id)
        job.update({"status": "done", "result": result,
                    "finished_at": datetime.utcnow().isoformat() + "Z"})
        logger.info(f'"Sync job {job_id} done" result="{result}"')
    except Exception as e:
        job.update({"status": "error", "error": str(e),
                    "finished_at": datetime.utcnow().isoformat() + "Z"})
        logger.error(f'"Sync job {job_id} failed" error="{e}"')
        if _sentry_dsn:
            sentry_sdk.capture_exception(e)


@app.post("/api/sync")
async def do_sync(req: SyncRequest, user: Optional[dict] = Depends(get_optional_user)):
    """Start a background sync job; returns job_id immediately."""
    org_id = user.get("org_id") if user else None

    # Require authentication — anonymous callers can't have connections
    if not org_id:
        raise HTTPException(status_code=401, detail="Sign in to sync your connected tools.")

    # Check that the org has at least one active connection
    conns = list_connections(org_id)
    active = [c for c in conns if c.get("connected")]
    if not active:
        raise HTTPException(
            status_code=400,
            detail="No tools connected. Open Settings → Connections to add Jira, Confluence, Slack, Notion, or Drive.",
        )

    job_id = str(uuid.uuid4())[:8]
    _sync_jobs[job_id] = {
        "id": job_id, "target": req.target, "status": "queued",
        "log": [], "result": None, "error": None,
        "started_at": datetime.utcnow().isoformat() + "Z", "finished_at": None,
    }
    asyncio.create_task(_run_sync_job(job_id, req.target, org_id))
    return {"job_id": job_id, "status": "queued"}


@app.get("/api/sync/job/{job_id}")
def sync_job_status(job_id: str):
    job = _sync_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@app.get("/api/scheduler")
def get_scheduler_status():
    return scheduler_status()


@app.get("/api/sync-events")
def sync_events(since: Optional[str] = None):
    """Poll for sync events newer than `since` (ISO timestamp)."""
    return {"events": get_events_since(since)}


@app.post("/api/contribute")
def contribute(req: ContributeRequest, user: dict = Depends(get_current_user)):
    try:
        new_id = submit_context(
            team=req.team,
            title=req.title,
            content=req.content,
            author=req.author,
            tags=req.tags,
            contributed_by=user["email"],
        )
        return {"id": new_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/contributions")
def get_contributions(user: dict = Depends(get_current_user)):
    from contribute import list_contributions
    return {"contributions": list_contributions(user["email"])}


@app.patch("/api/contributions/{doc_id}")
def edit_contribution(doc_id: str, req: ContributionUpdate, user: dict = Depends(get_current_user)):
    from contribute import update_contribution
    updates = req.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update.")
    updated = update_contribution(doc_id, user["email"], updates)
    if not updated:
        raise HTTPException(status_code=404, detail="Not found or not owned by you.")
    return {"ok": True}


@app.delete("/api/contributions/{doc_id}")
def remove_contribution(doc_id: str, user: dict = Depends(get_current_user)):
    from contribute import delete_contribution
    deleted = delete_contribution(doc_id, user["email"])
    if not deleted:
        raise HTTPException(status_code=404, detail="Not found or not owned by you.")
    return {"ok": True}


class ShareContributionRequest(BaseModel):
    recipient_email: str


@app.post("/api/contributions/{doc_id}/share")
def share_contribution(doc_id: str, body: ShareContributionRequest, user: dict = Depends(get_current_user)):
    from contribute import get_contribution_by_id
    doc = get_contribution_by_id(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Contribution not found.")
    if doc.get("contributed_by") != user["email"]:
        raise HTTPException(status_code=403, detail="You can only share your own contributions.")
    recipient_email = body.recipient_email.strip().lower()
    if not recipient_email or "@" not in recipient_email:
        raise HTTPException(status_code=400, detail="A valid email address is required.")
    if recipient_email == user["email"].lower():
        raise HTTPException(status_code=400, detail="You cannot share a contribution with yourself.")
    recipient = get_user_by_email(recipient_email)
    if not recipient:
        raise HTTPException(status_code=404, detail="No AXIS account found for that email address.")
    try:
        create_direct_share(
            org_id=user.get("org_id") or 0,
            sharer_email=user["email"],
            sharer_name=user["name"],
            recipient_user_id=recipient["id"],
            recipient_email=recipient_email,
            doc_id=doc_id,
            title=doc.get("title", "Untitled"),
            content_preview=doc.get("content", ""),
        )
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return {"ok": True, "recipient": recipient_email}


@app.post("/api/contribute/file")
async def contribute_file(
    team: str = Form(...),
    title: str = Form(""),
    author: str = Form(""),
    tags: str = Form(""),
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large. Max 10 MB.")
    try:
        content = extract_text(file.filename, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not content:
        raise HTTPException(status_code=400, detail="Could not extract any text from the file.")
    doc_title = title.strip() or Path(file.filename).stem
    tag_list = [t.strip() for t in tags.split(",") if t.strip()]
    try:
        new_id = submit_context(team=team, title=doc_title, content=content, author=author, tags=tag_list, contributed_by=user["email"])
        return {"id": new_id, "title": doc_title, "chars": len(content)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Context Share Requests ────────────────────────────────────────────────────

@app.post("/api/context-requests")
def create_ctx_request(req: ContextRequestCreate, user: dict = Depends(get_current_user)):
    approver_email = req.approver_email.strip().lower()
    if not approver_email or "@" not in approver_email:
        raise HTTPException(status_code=400, detail="A valid approver email is required.")
    if not req.topic.strip():
        raise HTTPException(status_code=400, detail="A topic is required.")
    if approver_email == user["email"].lower():
        raise HTTPException(status_code=400, detail="You cannot request context from yourself.")

    try:
        request_id = create_context_request(
            org_id=user.get("org_id", 0),
            requester_user_id=user["id"],
            requester_email=user["email"],
            requester_name=user["name"],
            approver_email=approver_email,
            topic=req.topic,
        )
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    # Send email to approver
    try:
        send_context_request_email(
            to=approver_email,
            requester_name=user["name"],
            requester_email=user["email"],
            topic=req.topic,
            request_id=request_id,
        )
    except Exception as e:
        logger.warning(f'"context request email failed" error="{e}"')

    # Create in-app notification for approver
    try:
        create_notification(
            user_email=approver_email,
            ntype="context_request",
            payload={
                "request_id": request_id,
                "requester_name": user["name"],
                "requester_email": user["email"],
                "topic": req.topic,
            },
        )
    except Exception as e:
        logger.warning(f'"context request notification failed" error="{e}"')

    return get_context_request(request_id)


@app.get("/api/context-requests")
def list_ctx_requests(user: dict = Depends(get_current_user)):
    return list_context_requests_for_user(user["email"])


@app.patch("/api/context-requests/{request_id}/approve")
def approve_ctx_request(request_id: int, body: ApproveBody, user: dict = Depends(get_current_user)):
    if body.duration_type not in ("24h", "session"):
        raise HTTPException(status_code=400, detail="duration_type must be '24h' or 'session'.")

    ctx_req = get_context_request(request_id)
    if not ctx_req:
        raise HTTPException(status_code=404, detail="Request not found.")
    if ctx_req["approver_email"].lower() != user["email"].lower():
        raise HTTPException(status_code=403, detail="You are not the approver for this request.")
    if ctx_req["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Request is already {ctx_req['status']}.")

    approve_context_request(request_id, body.duration_type)

    duration_label = "24 hours" if body.duration_type == "24h" else "8-hour session"

    # Email the requester
    try:
        send_request_approved_email(
            to=ctx_req["requester_email"],
            approver_name=user["name"],
            topic=ctx_req["topic"],
            duration_label=duration_label,
        )
    except Exception as e:
        logger.warning(f'"approve email failed" error="{e}"')

    # In-app notification for requester
    try:
        create_notification(
            user_email=ctx_req["requester_email"],
            ntype="request_approved",
            payload={
                "request_id": request_id,
                "approver_name": user["name"],
                "approver_email": user["email"],
                "topic": ctx_req["topic"],
                "duration_label": duration_label,
            },
        )
    except Exception as e:
        logger.warning(f'"approve notification failed" error="{e}"')

    return get_context_request(request_id)


@app.patch("/api/context-requests/{request_id}/reject")
def reject_ctx_request(request_id: int, user: dict = Depends(get_current_user)):
    ctx_req = get_context_request(request_id)
    if not ctx_req:
        raise HTTPException(status_code=404, detail="Request not found.")
    if ctx_req["approver_email"].lower() != user["email"].lower():
        raise HTTPException(status_code=403, detail="You are not the approver for this request.")
    if ctx_req["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Request is already {ctx_req['status']}.")

    reject_context_request(request_id)

    # Email the requester
    try:
        send_request_rejected_email(
            to=ctx_req["requester_email"],
            approver_name=user["name"],
            topic=ctx_req["topic"],
        )
    except Exception as e:
        logger.warning(f'"reject email failed" error="{e}"')

    # In-app notification for requester
    try:
        create_notification(
            user_email=ctx_req["requester_email"],
            ntype="request_rejected",
            payload={
                "request_id": request_id,
                "approver_name": user["name"],
                "approver_email": user["email"],
                "topic": ctx_req["topic"],
            },
        )
    except Exception as e:
        logger.warning(f'"reject notification failed" error="{e}"')

    return get_context_request(request_id)


@app.patch("/api/context-requests/{request_id}/revoke")
def revoke_ctx_request(request_id: int, user: dict = Depends(get_current_user)):
    ctx_req = get_context_request(request_id)
    if not ctx_req:
        raise HTTPException(status_code=404, detail="Request not found.")

    is_approver = ctx_req["approver_email"].lower() == user["email"].lower()
    is_requester = ctx_req["requester_email"].lower() == user["email"].lower()
    if not is_approver and not is_requester:
        raise HTTPException(status_code=403, detail="You are not a party to this request.")
    if ctx_req["status"] not in ("approved", "pending"):
        raise HTTPException(status_code=400, detail=f"Cannot revoke a request with status '{ctx_req['status']}'.")

    revoke_context_request(request_id)

    # Notify the other party
    try:
        if is_approver:
            # Approver revoked — notify the requester
            send_access_revoked_email(
                to=ctx_req["requester_email"],
                approver_name=user["name"],
                topic=ctx_req["topic"],
            )
            create_notification(
                user_email=ctx_req["requester_email"],
                ntype="access_revoked",
                payload={
                    "request_id": request_id,
                    "approver_name": user["name"],
                    "approver_email": user["email"],
                    "topic": ctx_req["topic"],
                },
            )
        else:
            # Requester revoked their own request — notify the approver
            create_notification(
                user_email=ctx_req["approver_email"],
                ntype="request_cancelled",
                payload={
                    "request_id": request_id,
                    "requester_name": user["name"],
                    "requester_email": user["email"],
                    "topic": ctx_req["topic"],
                },
            )
    except Exception as e:
        logger.warning(f'"revoke notification failed" error="{e}"')

    return get_context_request(request_id)


# ── Notifications ─────────────────────────────────────────────────────────────

@app.get("/api/notifications")
def get_notifications(user: dict = Depends(get_current_user)):
    return {"notifications": list_notifications(user["email"])}


@app.patch("/api/notifications/read")
def mark_notifs_read(user: dict = Depends(get_current_user)):
    mark_notifications_read(user["email"])
    return {"ok": True}
