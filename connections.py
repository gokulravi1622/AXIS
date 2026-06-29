"""
AXIS — per-organization connection helpers.

Each org stores its own provider credentials (encrypted, in the DB). This module:
  - test_connection(): live-validates a provider's credentials
  - apply_env():       maps a stored config onto the env vars sync.py reads,
                       so the existing sync functions work unchanged
"""

import os
import json
import hashlib
import tempfile
from pathlib import Path

# Provider -> the config fields the onboarding form collects.
PROVIDER_FIELDS = {
    "jira":       ["base_url", "email", "api_token", "projects"],
    "confluence": ["base_url", "email", "api_token", "spaces"],
    "slack":      ["bot_token", "channels"],
    "notion":     ["token", "team"],
    "gdrive":     ["service_account_json", "team", "folder_id"],
}
PROVIDERS = list(PROVIDER_FIELDS.keys())


def _write_service_account(json_text: str) -> str:
    """Persist a GDrive service-account JSON to a stable temp file; return its path."""
    digest = hashlib.md5(json_text.encode()).hexdigest()[:10]
    path = Path(tempfile.gettempdir()) / f"axis_gdrive_{digest}.json"
    if not path.exists():
        path.write_text(json_text)
    return str(path)


def apply_env(provider: str, config: dict) -> None:
    """Set the env vars sync.py expects from a stored connection config."""
    if provider in ("jira", "confluence"):
        if config.get("refresh_token"):
            # OAuth (Atlassian) mode — separate env per product so they don't collide
            if config.get("site_url"):
                os.environ["JIRA_BASE_URL"] = config["site_url"]
            if provider == "jira":
                os.environ["JIRA_OAUTH_REFRESH_TOKEN"] = config["refresh_token"]
                os.environ["JIRA_OAUTH_CLOUD_ID"] = config.get("cloud_id", "")
                os.environ["JIRA_OAUTH_TEAM"] = config.get("team", "Engineering")
            else:
                os.environ["CONFLUENCE_OAUTH_REFRESH_TOKEN"] = config["refresh_token"]
                os.environ["CONFLUENCE_OAUTH_CLOUD_ID"] = config.get("cloud_id", "")
                os.environ["CONFLUENCE_OAUTH_TEAM"] = config.get("team", "Engineering")
                os.environ["CONFLUENCE_OAUTH_GRANTED_SCOPES"] = " ".join(config.get("granted_scopes", []))
                if config.get("site_url"):
                    os.environ["CONFLUENCE_SITE_URL"] = config["site_url"]
        else:
            # Manual API-token mode (clear any stale OAuth discriminator first)
            os.environ.pop("JIRA_OAUTH_REFRESH_TOKEN" if provider == "jira"
                           else "CONFLUENCE_OAUTH_REFRESH_TOKEN", None)
            os.environ["JIRA_BASE_URL"] = config.get("base_url", "")
            os.environ["JIRA_EMAIL"] = config.get("email", "")
            os.environ["JIRA_API_TOKEN"] = config.get("api_token", "")
            if provider == "jira":
                os.environ["JIRA_PROJECTS"] = config.get("projects", "")
            else:
                os.environ["CONFLUENCE_SPACES"] = config.get("spaces", "")
    elif provider == "slack":
        os.environ["SLACK_BOT_TOKEN"] = config.get("bot_token", "")
        os.environ["SLACK_CHANNELS"] = config.get("channels", "")
        # When channels aren't listed (OAuth flow), sync auto-discovers the bot's
        # channels and files them under this team.
        os.environ["SLACK_AUTO_TEAM"] = config.get("team", "Engineering")
    elif provider == "notion":
        os.environ["NOTION_TOKEN"] = config.get("token", "")
        os.environ["NOTION_TEAM"] = config.get("team", "Product")
    elif provider == "gdrive":
        if config.get("refresh_token"):
            os.environ["GDRIVE_OAUTH_REFRESH_TOKEN"] = config["refresh_token"]
            os.environ["GDRIVE_OAUTH_TEAM"] = config.get("team", "Data")
            os.environ.pop("GOOGLE_SERVICE_ACCOUNT_FILE", None)
        else:
            os.environ.pop("GDRIVE_OAUTH_REFRESH_TOKEN", None)
            os.environ["GOOGLE_SERVICE_ACCOUNT_FILE"] = _write_service_account(
                config.get("service_account_json", "")
            )
            os.environ["GDRIVE_TEAM"] = config.get("team", "Data")
            os.environ["GDRIVE_FOLDER_ID"] = config.get("folder_id", "")


def connection_teams(provider: str, config: dict) -> list[str]:
    """Which AXIS team(s) a connection's docs are filed under (for the workspace filter)."""
    def _split(val):
        return [x.strip() for x in (val or "").split(",") if x.strip()]

    if provider == "notion":
        return [config.get("team", "Product")]
    if provider == "gdrive":
        return [config.get("team", "Data")]
    if provider == "slack":
        teams = [e.split("=", 1)[1].strip() for e in _split(config.get("channels", "")) if "=" in e]
        return list(dict.fromkeys(teams)) or [config.get("team", "Engineering")]
    if provider in ("jira", "confluence"):
        if config.get("refresh_token"):  # OAuth mode
            return [config.get("team", "Engineering")]
        from sync import PROJECT_TO_TEAM, SPACE_TO_TEAM
        mapping = PROJECT_TO_TEAM if provider == "jira" else SPACE_TO_TEAM
        key = "projects" if provider == "jira" else "spaces"
        return list(dict.fromkeys(
            mapping.get(k.upper(), k.title()) for k in _split(config.get(key, ""))
        ))
    return []


def test_connection(provider: str, config: dict) -> tuple[bool, str]:
    """Live-validate credentials. Returns (ok, human-readable message)."""
    try:
        if provider in ("jira", "confluence"):
            import requests
            from requests.auth import HTTPBasicAuth
            base = config.get("base_url", "").rstrip("/")
            if not base:
                return False, "Base URL is required."
            r = requests.get(f"{base}/rest/api/3/myself",
                             auth=HTTPBasicAuth(config.get("email", ""), config.get("api_token", "")),
                             timeout=10)
            if r.status_code == 200:
                return True, f"Connected as {r.json().get('displayName', 'your account')}"
            return False, f"Authentication failed (HTTP {r.status_code}). Check email + API token."

        if provider == "slack":
            import requests
            r = requests.get("https://slack.com/api/auth.test",
                            headers={"Authorization": f"Bearer {config.get('bot_token', '')}"},
                            timeout=10).json()
            return (True, f"Connected to workspace '{r.get('team')}'") if r.get("ok") \
                else (False, f"Slack error: {r.get('error', 'invalid token')}")

        if provider == "notion":
            import requests
            r = requests.post("https://api.notion.com/v1/search",
                             headers={"Authorization": f"Bearer {config.get('token', '')}",
                                      "Notion-Version": "2022-06-28",
                                      "Content-Type": "application/json"},
                             json={"page_size": 1}, timeout=10)
            if r.status_code == 200:
                n = len(r.json().get("results", []))
                return True, f"Token valid — {n}+ page(s) shared with the integration."
            return False, f"Notion error: {r.json().get('message', 'invalid token')[:120]}"

        if provider == "gdrive":
            from google.oauth2 import service_account
            from googleapiclient.discovery import build
            info = json.loads(config.get("service_account_json", "") or "{}")
            creds = service_account.Credentials.from_service_account_info(
                info, scopes=["https://www.googleapis.com/auth/drive.readonly"])
            svc = build("drive", "v3", credentials=creds, cache_discovery=False)
            files = svc.files().list(
                q="mimeType='application/vnd.google-apps.document' and trashed=false",
                fields="files(id)", pageSize=5).execute().get("files", [])
            return True, f"Service account valid — {len(files)} Google Doc(s) shared with {info.get('client_email','it')}"
    except Exception as e:
        return False, str(e)[:200]
    return False, f"Unknown provider: {provider}"
