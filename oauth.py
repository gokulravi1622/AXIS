"""
AXIS — OAuth "Connect" flows for friendly, token-free connections.
Currently: Notion. Each provider exposes an authorize URL + a code exchange.

The OAuth callback is a browser redirect (no auth header), so we carry the
logged-in user/org in a short-lived signed `state` token.
"""

import os
import time
import base64
from urllib.parse import urlencode

import requests
import jwt as pyjwt

from auth import JWT_SECRET, JWT_ALGO

# Where to send the browser back after a connection completes (the frontend).
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000").rstrip("/")

# ── Notion ────────────────────────────────────────────────────────────────────
NOTION_CLIENT_ID = os.environ.get("NOTION_OAUTH_CLIENT_ID")
NOTION_CLIENT_SECRET = os.environ.get("NOTION_OAUTH_CLIENT_SECRET")
NOTION_REDIRECT_URI = os.environ.get(
    "NOTION_REDIRECT_URI", "http://localhost:8000/api/connect/notion/callback"
)
NOTION_TEAM_DEFAULT = os.environ.get("NOTION_TEAM", "Product")


def configured(provider: str) -> bool:
    if provider == "notion":
        return bool(NOTION_CLIENT_ID and NOTION_CLIENT_SECRET)
    return False


def oauth_providers() -> list[str]:
    return [p for p in ("notion",) if configured(p)]


# ── signed state (CSRF + carries user/org through the redirect) ────────────────
def make_state(user_id: int, org_id: int) -> str:
    return pyjwt.encode(
        {"sub": str(user_id), "org": org_id, "typ": "oauth", "exp": int(time.time()) + 600},
        JWT_SECRET, algorithm=JWT_ALGO,
    )


def read_state(state: str) -> dict | None:
    try:
        d = pyjwt.decode(state, JWT_SECRET, algorithms=[JWT_ALGO])
        return d if d.get("typ") == "oauth" else None
    except Exception:
        return None


# ── Notion authorize + exchange ───────────────────────────────────────────────
def notion_authorize_url(state: str) -> str:
    q = urlencode({
        "client_id": NOTION_CLIENT_ID,
        "response_type": "code",
        "owner": "user",
        "redirect_uri": NOTION_REDIRECT_URI,
        "state": state,
    })
    return f"https://api.notion.com/v1/oauth/authorize?{q}"


def notion_exchange(code: str) -> dict:
    """Exchange an auth code for an access token. Returns the connection config."""
    basic = base64.b64encode(f"{NOTION_CLIENT_ID}:{NOTION_CLIENT_SECRET}".encode()).decode()
    r = requests.post(
        "https://api.notion.com/v1/oauth/token",
        headers={"Authorization": f"Basic {basic}", "Content-Type": "application/json"},
        json={"grant_type": "authorization_code", "code": code, "redirect_uri": NOTION_REDIRECT_URI},
        timeout=15,
    )
    r.raise_for_status()
    data = r.json()
    return {"token": data["access_token"], "team": NOTION_TEAM_DEFAULT}
