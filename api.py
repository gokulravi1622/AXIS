"""AXIS — FastAPI backend"""

import os
from dotenv import load_dotenv
load_dotenv('/Users/gokulravi/Desktop/AXIS/.env')

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from query import ask
from contribute import submit_context, get_doc_count
from sync import sync_jira, sync_confluence, sync_slack, sync_notion, sync_gdrive, sync_all
from scheduler import start as start_scheduler, status as scheduler_status, stop as stop_scheduler, get_events_since
from db import init_db
from auth import create_user, authenticate, create_token, get_current_user, get_optional_user

app = FastAPI(title="AXIS API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    init_db()
    start_scheduler()


# ── Models ────────────────────────────────────────────────────────────────────

class AskRequest(BaseModel):
    question: str
    team_filter: Optional[str] = None
    history: list = []


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


class LoginRequest(BaseModel):
    email: str
    password: str


class FeedbackRequest(BaseModel):
    message_key: str
    question: str = ""
    answer: str = ""
    sources: list = []
    vote: int  # 1 = up, -1 = down, 0 = clear


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok"}


# ── Auth ──────────────────────────────────────────────────────────────────────

def _auth_response(user: dict) -> dict:
    token = create_token(user["id"], user["email"])
    return {"token": token, "user": user}


@app.post("/api/auth/register")
def register(req: RegisterRequest):
    if not req.email.strip() or "@" not in req.email:
        raise HTTPException(status_code=400, detail="A valid email is required.")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
    if not req.name.strip():
        raise HTTPException(status_code=400, detail="Name is required.")
    user = create_user(req.email, req.name, req.password)
    return _auth_response(user)


@app.post("/api/auth/login")
def login(req: LoginRequest):
    user = authenticate(req.email, req.password)
    return _auth_response(user)


@app.get("/api/auth/me")
def me(user: dict = Depends(get_current_user)):
    return {"user": user}


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
        # `user` is None for anonymous callers; the personalized-history feature
        # will use this to persist the exchange to the logged-in user's account.
        return {
            "answer": answer,
            "sources": [
                {
                    "team": s["team"],
                    "title": s["title"],
                    "relevance": s["relevance"],
                    "url": s.get("url", ""),
                    "source": s.get("source", ""),
                }
                for s in sources
            ],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/sync")
def do_sync(req: SyncRequest):
    log = []
    try:
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
