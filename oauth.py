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

# ── Slack ─────────────────────────────────────────────────────────────────────
SLACK_CLIENT_ID = os.environ.get("SLACK_OAUTH_CLIENT_ID")
SLACK_CLIENT_SECRET = os.environ.get("SLACK_OAUTH_CLIENT_SECRET")
SLACK_REDIRECT_URI = os.environ.get(
    "SLACK_REDIRECT_URI", "http://localhost:8000/api/connect/slack/callback"
)
SLACK_DEFAULT_TEAM = os.environ.get("SLACK_DEFAULT_TEAM", "Engineering")
SLACK_SCOPES = "channels:history,channels:read,groups:history,groups:read,users:read"


# ── Atlassian (Jira + Confluence) ─────────────────────────────────────────────
ATLASSIAN_CLIENT_ID = os.environ.get("ATLASSIAN_OAUTH_CLIENT_ID")
ATLASSIAN_CLIENT_SECRET = os.environ.get("ATLASSIAN_OAUTH_CLIENT_SECRET")
ATLASSIAN_REDIRECT_URI = os.environ.get(
    "ATLASSIAN_REDIRECT_URI", "http://localhost:8000/api/connect/atlassian/callback"
)
ATLASSIAN_DEFAULT_TEAM = os.environ.get("ATLASSIAN_DEFAULT_TEAM", "Engineering")
# Confluence uses granular scopes — the classic scope (read:confluence-content.all)
# is rejected by the Confluence REST API v2 gateway.
# read:page:confluence  → GET /wiki/api/v2/pages (page metadata + body)
# read:content:confluence → additional content access (kept for compatibility)
# Jira keeps classic scopes as they still work fine.
ATLASSIAN_SCOPES = ("read:jira-work read:jira-user "
                    "read:page:confluence read:content:confluence "
                    "offline_access")


# ── Google Drive ──────────────────────────────────────────────────────────────
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_OAUTH_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET")
GDRIVE_REDIRECT_URI = os.environ.get(
    "GDRIVE_REDIRECT_URI", "http://localhost:8000/api/connect/gdrive/callback"
)
GDRIVE_OAUTH_TEAM = os.environ.get("GDRIVE_DEFAULT_TEAM", "Data")
GDRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly"


def configured(provider: str) -> bool:
    if provider == "notion":
        return bool(NOTION_CLIENT_ID and NOTION_CLIENT_SECRET)
    if provider == "slack":
        return bool(SLACK_CLIENT_ID and SLACK_CLIENT_SECRET)
    # Jira and Confluence are both backed by one Atlassian OAuth app.
    if provider in ("jira", "confluence"):
        return bool(ATLASSIAN_CLIENT_ID and ATLASSIAN_CLIENT_SECRET)
    if provider == "gdrive":
        return bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)
    return False


def oauth_providers() -> list[str]:
    return [p for p in ("notion", "slack", "jira", "confluence", "gdrive") if configured(p)]


# ── Generic dispatch (used by the /api/connect/{provider}/* endpoints) ─────────
def authorize_url(provider: str, state: str) -> str:
    if provider == "notion":
        return notion_authorize_url(state)
    if provider == "slack":
        return slack_authorize_url(state)
    if provider in ("jira", "confluence"):
        return atlassian_authorize_url(state)
    if provider == "gdrive":
        return gdrive_authorize_url(state)
    raise ValueError(f"No OAuth for provider: {provider}")


def exchange(provider: str, code: str) -> dict:
    if provider == "notion":
        return notion_exchange(code)
    if provider == "slack":
        return slack_exchange(code)
    if provider in ("jira", "confluence"):
        return atlassian_exchange(code, provider)
    if provider == "gdrive":
        return gdrive_exchange(code)
    raise ValueError(f"No OAuth for provider: {provider}")


# ── signed state (CSRF + carries user/org through the redirect) ────────────────
def make_state(user_id: int, org_id: int, prov: str | None = None) -> str:
    payload = {"sub": str(user_id), "org": org_id, "typ": "oauth", "exp": int(time.time()) + 600}
    if prov:
        payload["prov"] = prov  # which connection to store under (jira/confluence share the atlassian callback)
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


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


# ── Slack authorize + exchange ────────────────────────────────────────────────
def slack_authorize_url(state: str) -> str:
    q = urlencode({
        "client_id": SLACK_CLIENT_ID,
        "scope": SLACK_SCOPES,
        "redirect_uri": SLACK_REDIRECT_URI,
        "state": state,
    })
    return f"https://slack.com/oauth/v2/authorize?{q}"


def slack_exchange(code: str) -> dict:
    """Exchange the code for a bot token. Channels are auto-discovered at sync time."""
    r = requests.post(
        "https://slack.com/api/oauth.v2.access",
        data={"client_id": SLACK_CLIENT_ID, "client_secret": SLACK_CLIENT_SECRET,
              "code": code, "redirect_uri": SLACK_REDIRECT_URI},
        timeout=15,
    )
    r.raise_for_status()
    data = r.json()
    if not data.get("ok"):
        raise RuntimeError(f"Slack OAuth error: {data.get('error')}")
    return {"bot_token": data["access_token"], "team": SLACK_DEFAULT_TEAM, "channels": ""}


# ── Atlassian authorize + exchange ────────────────────────────────────────────
def atlassian_authorize_url(state: str) -> str:
    q = urlencode({
        "audience": "api.atlassian.com",
        "client_id": ATLASSIAN_CLIENT_ID,
        "scope": ATLASSIAN_SCOPES,
        "redirect_uri": ATLASSIAN_REDIRECT_URI,
        "state": state,
        "response_type": "code",
        "prompt": "consent",
    })
    return f"https://auth.atlassian.com/authorize?{q}"


def atlassian_exchange(code: str, provider: str = "jira") -> dict:
    """Exchange code → tokens, then resolve the correct cloudId for the target product.

    accessible-resources can return separate entries for Jira and Confluence even on
    the same Atlassian site — each with a different cloud ID. We must pick the entry
    whose scopes match the target product, otherwise API calls return 401 scope mismatch.
    """
    r = requests.post(
        "https://auth.atlassian.com/oauth/token",
        json={"grant_type": "authorization_code", "client_id": ATLASSIAN_CLIENT_ID,
              "client_secret": ATLASSIAN_CLIENT_SECRET, "code": code,
              "redirect_uri": ATLASSIAN_REDIRECT_URI},
        timeout=15,
    )
    r.raise_for_status()
    tok = r.json()
    res = requests.get(
        "https://api.atlassian.com/oauth/token/accessible-resources",
        headers={"Authorization": f"Bearer {tok['access_token']}", "Accept": "application/json"},
        timeout=15,
    )
    res.raise_for_status()
    sites = res.json()
    if not sites:
        raise RuntimeError("No Atlassian sites accessible for this account.")
    # Pick the resource whose scopes match the target product — Atlassian can return
    # separate entries for Jira and Confluence with different cloud IDs.
    required = "read:confluence-content.all" if provider == "confluence" else "read:jira-work"
    site = next((s for s in sites if required in s.get("scopes", [])), sites[0])
    granted_scopes = set(site.get("scopes", []))
    return {
        "refresh_token": tok["refresh_token"],
        "cloud_id": site["id"],
        "site_url": site.get("url", ""),
        "team": ATLASSIAN_DEFAULT_TEAM,
        "granted_scopes": list(granted_scopes),
    }


# ── Google Drive authorize + exchange ─────────────────────────────────────────
def gdrive_authorize_url(state: str) -> str:
    q = urlencode({
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GDRIVE_REDIRECT_URI,
        "response_type": "code",
        "scope": GDRIVE_SCOPE,
        "access_type": "offline",   # so we get a refresh token
        "prompt": "consent",
        "state": state,
    })
    return f"https://accounts.google.com/o/oauth2/v2/auth?{q}"


def gdrive_exchange(code: str) -> dict:
    r = requests.post(
        "https://oauth2.googleapis.com/token",
        data={"code": code, "client_id": GOOGLE_CLIENT_ID, "client_secret": GOOGLE_CLIENT_SECRET,
              "redirect_uri": GDRIVE_REDIRECT_URI, "grant_type": "authorization_code"},
        timeout=15,
    )
    r.raise_for_status()
    tok = r.json()
    if not tok.get("refresh_token"):
        raise RuntimeError("Google did not return a refresh token (need access_type=offline + prompt=consent).")
    return {"refresh_token": tok["refresh_token"], "team": GDRIVE_OAUTH_TEAM}
