"""
AXIS — Jira + Confluence Sync Engine
Pulls tickets and pages directly into ChromaDB. No manual entry needed.

Required env vars:
    JIRA_BASE_URL       e.g. https://yourorg.atlassian.net
    JIRA_EMAIL          your Atlassian account email
    JIRA_API_TOKEN      API token from id.atlassian.com/manage-profile/security/api-tokens
    JIRA_PROJECTS       comma-separated project keys e.g. ENG,DATA,PROD
    CONFLUENCE_SPACES   comma-separated space keys e.g. ENG,DATA,PROD (leave blank to skip)

Confluence uses the same base URL, email, and API token as Jira.
"""

import os
import hashlib
import re
import html
from pathlib import Path
from typing import Generator

import requests
from requests.auth import HTTPBasicAuth
import chromadb
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

DB_DIR = Path("axis_db")
COLLECTION_NAME = "axis_context"
EMBED_MODEL = "all-MiniLM-L6-v2"

# Map Jira project keys → AXIS team names
PROJECT_TO_TEAM = {
    "ENG":   "Engineering",
    "DATA":  "Data",
    "CRM":   "CRM",
    "CS":    "Client Success",
    "PROD":  "Product",
    "SCRUM": "Engineering",  # default; label-based mapping overrides below
}

LABEL_TO_TEAM = {
    "Engineering":    "Engineering",
    "Data":           "Data",
    "CRM":            "CRM",
    "Client_Success": "Client Success",
    "Product":        "Product",
}

# Map Confluence space keys → AXIS team names (falls back to space key if not listed)
SPACE_TO_TEAM = {
    "ENG":  "Engineering",
    "DATA": "Data",
    "CRM":  "CRM",
    "CS":   "Client Success",
    "PROD": "Product",
}

BATCH_SIZE = 100  # ChromaDB upsert batch size


# ── Helpers ───────────────────────────────────────────────────────────────────

def _strip_html(text: str) -> str:
    """Remove HTML tags and decode entities."""
    text = re.sub(r"<[^>]+>", " ", text or "")
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def _strip_adf(node: dict | None) -> str:
    """Recursively extract plain text from Atlassian Document Format (ADF)."""
    if not node:
        return ""
    if node.get("type") == "text":
        return node.get("text", "")
    parts = [_strip_adf(child) for child in node.get("content", [])]
    return " ".join(p for p in parts if p)


def _doc_id(prefix: str, key: str) -> str:
    """Stable, safe ChromaDB id."""
    slug = re.sub(r"[^a-zA-Z0-9_-]", "_", key)[:60]
    return f"{prefix}_{slug}"


def _base_url() -> str:
    """Atlassian base URL (used to build clickable source links)."""
    return os.environ.get("JIRA_BASE_URL", "").rstrip("/")


def _get_collection():
    client = chromadb.PersistentClient(path=str(DB_DIR))
    embed_fn = SentenceTransformerEmbeddingFunction(model_name=EMBED_MODEL)
    return client.get_or_create_collection(
        name=COLLECTION_NAME,
        embedding_function=embed_fn,
        metadata={"hnsw:space": "cosine"},
    )


def _upsert_batch(collection, ids, documents, metadatas):
    """Upsert in safe batches."""
    for i in range(0, len(ids), BATCH_SIZE):
        collection.upsert(
            ids=ids[i:i + BATCH_SIZE],
            documents=documents[i:i + BATCH_SIZE],
            metadatas=metadatas[i:i + BATCH_SIZE],
        )


# ── Jira ──────────────────────────────────────────────────────────────────────

def _jira_auth() -> tuple[str, HTTPBasicAuth]:
    base = os.environ.get("JIRA_BASE_URL", "").rstrip("/")
    email = os.environ.get("JIRA_EMAIL", "")
    token = os.environ.get("JIRA_API_TOKEN", "")
    if not (base and email and token):
        raise RuntimeError(
            "Missing Jira credentials. Set JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN."
        )
    return base, HTTPBasicAuth(email, token)


def _fetch_jira_tickets(project_key: str) -> Generator[dict, None, None]:
    base, auth = _jira_auth()
    url = f"{base}/rest/api/3/search/jql"
    start = 0
    page_size = 50

    while True:
        resp = requests.get(
            url,
            auth=auth,
            params={
                "jql": f"project = {project_key} ORDER BY updated DESC",
                "startAt": start,
                "maxResults": page_size,
                "fields": "summary,description,status,assignee,priority,labels,comment,updated",
            },
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        issues = data.get("issues", [])
        if not issues:
            break
        yield from issues
        start += len(issues)
        if start >= data.get("total", 0):
            break


def _ticket_to_doc(issue: dict, project_key: str) -> dict:
    fields = issue["fields"]
    key = issue["key"]
    summary = fields.get("summary", "")
    status = fields.get("status", {}).get("name", "")
    assignee = (fields.get("assignee") or {}).get("displayName", "Unassigned")
    priority = (fields.get("priority") or {}).get("name", "")
    labels = ", ".join(fields.get("labels", []))

    # Description: ADF (cloud) or plain text (server)
    desc_raw = fields.get("description")
    if isinstance(desc_raw, dict):
        description = _strip_adf(desc_raw)
    else:
        description = _strip_html(desc_raw or "")

    # Top 3 comments
    comments = []
    for c in (fields.get("comment") or {}).get("comments", [])[-3:]:
        body = c.get("body")
        if isinstance(body, dict):
            text = _strip_adf(body)
        else:
            text = _strip_html(body or "")
        author = (c.get("author") or {}).get("displayName", "")
        if text:
            comments.append(f"{author}: {text}")

    content_parts = [
        f"Ticket: {key}",
        f"Status: {status}",
        f"Priority: {priority}",
        f"Assignee: {assignee}",
    ]
    if labels:
        content_parts.append(f"Labels: {labels}")
    if description:
        content_parts.append(f"\nDescription:\n{description}")
    if comments:
        content_parts.append(f"\nRecent comments:\n" + "\n".join(comments))

    labels = fields.get("labels", [])
    team = next((LABEL_TO_TEAM[l] for l in labels if l in LABEL_TO_TEAM),
                PROJECT_TO_TEAM.get(project_key.upper(), project_key))

    base = _base_url()
    url = f"{base}/browse/{key}" if base else ""

    return {
        "id": _doc_id("jira", key),
        "team": team,
        "title": f"[{key}] {summary}",
        "content": "\n".join(content_parts),
        "tags": ["jira", project_key.lower(), status.lower().replace(" ", "-")],
        "url": url,
    }


def sync_jira(progress_cb=None) -> dict:
    """
    Sync all configured Jira projects into ChromaDB.
    progress_cb(message: str) is called for status updates.
    Returns {"synced": int, "projects": list}
    """
    raw = os.environ.get("JIRA_PROJECTS", "")
    projects = [p.strip().upper() for p in raw.split(",") if p.strip()]
    if not projects:
        raise RuntimeError("JIRA_PROJECTS env var not set. e.g. ENG,DATA,PROD")

    collection = _get_collection()
    total = 0

    for project in projects:
        if progress_cb:
            progress_cb(f"Fetching Jira project: {project}…")

        ids, documents, metadatas = [], [], []
        for issue in _fetch_jira_tickets(project):
            doc = _ticket_to_doc(issue, project)
            chunk = f"Team: {doc['team']}\nTitle: {doc['title']}\n\n{doc['content']}"
            ids.append(doc["id"])
            documents.append(chunk)
            metadatas.append({
                "team": doc["team"],
                "title": doc["title"],
                "tags": ", ".join(doc["tags"]),
                "source": "jira",
                "url": doc["url"],
            })

        if ids:
            _upsert_batch(collection, ids, documents, metadatas)
            total += len(ids)
            if progress_cb:
                progress_cb(f"  ✓ {project}: {len(ids)} tickets synced")

    return {"synced": total, "projects": projects}


# ── Confluence ────────────────────────────────────────────────────────────────

def _fetch_confluence_pages(space_key: str) -> Generator[dict, None, None]:
    base, auth = _jira_auth()  # same credentials
    url = f"{base}/wiki/rest/api/content"
    start = 0
    page_size = 50

    while True:
        resp = requests.get(
            url,
            auth=auth,
            params={
                "spaceKey": space_key,
                "type": "page",
                "status": "current",
                "start": start,
                "limit": page_size,
                "expand": "body.storage,version,ancestors",
            },
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        pages = data.get("results", [])
        if not pages:
            break
        yield from pages
        start += len(pages)
        if start >= data.get("size", 0) and len(pages) < page_size:
            break


def _page_to_doc(page: dict, space_key: str) -> dict:
    title = page.get("title", "")
    page_id = page.get("id", "")
    body_html = (page.get("body") or {}).get("storage", {}).get("value", "")
    content = _strip_html(body_html)

    # Truncate very long pages to keep chunks meaningful
    if len(content) > 3000:
        content = content[:3000] + "…"

    team = SPACE_TO_TEAM.get(space_key.upper(), space_key)

    # Confluence returns a relative web path in _links.webui (e.g. /spaces/ENG/pages/123/Title)
    base = _base_url()
    webui = (page.get("_links") or {}).get("webui", "")
    url = f"{base}/wiki{webui}" if (base and webui) else ""

    return {
        "id": _doc_id("conf", page_id),
        "team": team,
        "title": title,
        "content": content or "(no content)",
        "tags": ["confluence", space_key.lower()],
        "url": url,
    }


def sync_confluence(progress_cb=None) -> dict:
    """
    Sync all configured Confluence spaces into ChromaDB.
    Returns {"synced": int, "spaces": list}
    """
    raw = os.environ.get("CONFLUENCE_SPACES", "")
    spaces = [s.strip().upper() for s in raw.split(",") if s.strip()]
    if not spaces:
        raise RuntimeError("CONFLUENCE_SPACES env var not set. e.g. ENG,DATA,PROD")

    collection = _get_collection()
    total = 0

    for space in spaces:
        if progress_cb:
            progress_cb(f"Fetching Confluence space: {space}…")

        ids, documents, metadatas = [], [], []
        for page in _fetch_confluence_pages(space):
            doc = _page_to_doc(page, space)
            chunk = f"Team: {doc['team']}\nTitle: {doc['title']}\n\n{doc['content']}"
            ids.append(doc["id"])
            documents.append(chunk)
            metadatas.append({
                "team": doc["team"],
                "title": doc["title"],
                "tags": ", ".join(doc["tags"]),
                "source": "confluence",
                "url": doc["url"],
            })

        if ids:
            _upsert_batch(collection, ids, documents, metadatas)
            total += len(ids)
            if progress_cb:
                progress_cb(f"  ✓ {space}: {len(ids)} pages synced")

    return {"synced": total, "spaces": spaces}


# ── Slack ─────────────────────────────────────────────────────────────────────
#
# Requires a Slack bot token (xoxb-...) with read scopes:
#   channels:history, channels:read, groups:history, groups:read, users:read
# Configure channels (and their AXIS team) via:
#   SLACK_CHANNELS="eng-help=Engineering,data-chat=Data,product=Product"
# An entry without "=Team" defaults the team to the channel name.

SLACK_API = "https://slack.com/api"
SLACK_MAX_MESSAGES = 200  # most-recent messages fetched per channel
_slack_user_cache: dict[str, str] = {}


def _slack_token() -> str:
    token = os.environ.get("SLACK_BOT_TOKEN", "")
    if not token:
        raise RuntimeError(
            "Missing Slack credentials. Set SLACK_BOT_TOKEN (xoxb-...) and SLACK_CHANNELS."
        )
    return token


def _slack_call(method: str, params: dict) -> dict:
    """Call a Slack Web API method; raise on Slack-level errors."""
    resp = requests.get(
        f"{SLACK_API}/{method}",
        headers={"Authorization": f"Bearer {_slack_token()}"},
        params=params,
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    if not data.get("ok"):
        raise RuntimeError(f"Slack API error on {method}: {data.get('error')}")
    return data


def _parse_slack_channels() -> list[tuple[str, str]]:
    """Return [(channel_name, team), ...] from SLACK_CHANNELS."""
    raw = os.environ.get("SLACK_CHANNELS", "")
    out = []
    for entry in raw.split(","):
        entry = entry.strip()
        if not entry:
            continue
        if "=" in entry:
            name, team = entry.split("=", 1)
            out.append((name.strip().lstrip("#"), team.strip()))
        else:
            out.append((entry.lstrip("#"), entry.strip()))
    return out


def _slack_user_name(user_id: str) -> str:
    if not user_id:
        return "Unknown"
    if user_id not in _slack_user_cache:
        try:
            info = _slack_call("users.info", {"user": user_id})["user"]
            _slack_user_cache[user_id] = (
                info.get("real_name") or info.get("name") or user_id
            )
        except Exception:
            _slack_user_cache[user_id] = user_id
    return _slack_user_cache[user_id]


def _slack_channel_id(name: str) -> str | None:
    """Resolve a channel name to its ID (paginates public + private channels)."""
    cursor = ""
    while True:
        data = _slack_call("conversations.list", {
            "types": "public_channel,private_channel",
            "limit": 200,
            "cursor": cursor,
        })
        for ch in data.get("channels", []):
            if ch.get("name") == name:
                return ch["id"]
        cursor = data.get("response_metadata", {}).get("next_cursor", "")
        if not cursor:
            return None


def _looks_like_channel_id(s: str) -> bool:
    """Slack channel IDs look like C0123ABC / G0123ABC (public/private)."""
    return bool(re.fullmatch(r"[CG][A-Z0-9]{6,}", s))


def _resolve_channel(name_or_id: str) -> tuple[str | None, str]:
    """Return (channel_id, display_name) for a SLACK_CHANNELS entry (name OR ID)."""
    if _looks_like_channel_id(name_or_id):
        try:
            info = _slack_call("conversations.info", {"channel": name_or_id})["channel"]
            return name_or_id, info.get("name", name_or_id)
        except Exception:
            return name_or_id, name_or_id
    return _slack_channel_id(name_or_id), name_or_id


def _slack_permalink(channel_id: str, ts: str) -> str:
    try:
        return _slack_call("chat.getPermalink", {
            "channel": channel_id, "message_ts": ts,
        }).get("permalink", "")
    except Exception:
        return ""


def _thread_text(channel_id: str, root: dict) -> str:
    """Build readable text for a message, expanding its thread replies if any."""
    lines = []
    if root.get("reply_count", 0) > 0:
        replies = _slack_call("conversations.replies", {
            "channel": channel_id, "ts": root["ts"], "limit": 50,
        }).get("messages", [])
    else:
        replies = [root]
    for m in replies:
        text = (m.get("text") or "").strip()
        if not text:
            continue
        lines.append(f"{_slack_user_name(m.get('user', ''))}: {text}")
    return "\n".join(lines)


def sync_slack(progress_cb=None) -> dict:
    """Sync configured Slack channels' messages/threads into ChromaDB."""
    channels = _parse_slack_channels()
    if not channels:
        raise RuntimeError('SLACK_CHANNELS not set. e.g. "eng-help=Engineering,data=Data"')

    _slack_token()  # fail fast if no token
    collection = _get_collection()
    total = 0

    for entry, team in channels:
        channel_id, name = _resolve_channel(entry)
        if progress_cb:
            progress_cb(f"Fetching Slack channel: #{name}…")

        if not channel_id:
            if progress_cb:
                progress_cb(f"  ! {entry}: not found or bot not a member")
            continue

        history = _slack_call("conversations.history", {
            "channel": channel_id, "limit": SLACK_MAX_MESSAGES,
        }).get("messages", [])

        ids, documents, metadatas = [], [], []
        for msg in history:
            # skip joins/leaves/bot/system messages and empty text
            if msg.get("subtype") or not (msg.get("text") or "").strip():
                continue
            # only index thread roots / standalone messages (not individual replies)
            if msg.get("thread_ts") and msg.get("thread_ts") != msg.get("ts"):
                continue

            body = _thread_text(channel_id, msg)
            if len(body) < 15:
                continue
            if len(body) > 3000:
                body = body[:3000] + "…"

            snippet = (msg.get("text") or "").strip().split("\n")[0][:60]
            title = f"#{name}: {snippet}"
            url = _slack_permalink(channel_id, msg["ts"])
            content = f"Slack channel #{name}\n\n{body}"
            chunk = f"Team: {team}\nTitle: {title}\n\n{content}"

            ids.append(_doc_id("slack", f"{channel_id}_{msg['ts']}"))
            documents.append(chunk)
            metadatas.append({
                "team": team,
                "title": title,
                "tags": ", ".join(["slack", name]),
                "source": "slack",
                "url": url,
            })

        if ids:
            _upsert_batch(collection, ids, documents, metadatas)
            total += len(ids)
            if progress_cb:
                progress_cb(f"  ✓ #{name}: {len(ids)} messages synced")

    return {"synced": total, "channels": [c[0] for c in channels]}


# ── Notion ────────────────────────────────────────────────────────────────────
#
# Create an internal integration at notion.so/my-integrations, copy its token,
# and "Connect" the pages/databases you want AXIS to read to that integration.
#   NOTION_TOKEN=secret_xxx   (or ntn_xxx)
#   NOTION_TEAM=Product       (AXIS team all Notion pages are filed under)

NOTION_API = "https://api.notion.com/v1"
NOTION_VERSION = "2022-06-28"


def _notion_headers() -> dict:
    token = os.environ.get("NOTION_TOKEN", "")
    if not token:
        raise RuntimeError("Missing NOTION_TOKEN. Create an internal Notion integration and share pages with it.")
    return {
        "Authorization": f"Bearer {token}",
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
    }


def _notion_search_pages() -> list[dict]:
    """All pages shared with the integration (paginated)."""
    headers = _notion_headers()
    pages, cursor = [], None
    while True:
        body = {"filter": {"value": "page", "property": "object"}, "page_size": 100}
        if cursor:
            body["start_cursor"] = cursor
        resp = requests.post(f"{NOTION_API}/search", headers=headers, json=body, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        pages.extend(data.get("results", []))
        if not data.get("has_more"):
            return pages
        cursor = data.get("next_cursor")


def _notion_title(page: dict) -> str:
    for prop in page.get("properties", {}).values():
        if prop.get("type") == "title":
            return "".join(t.get("plain_text", "") for t in prop.get("title", [])) or "Untitled"
    return "Untitled"


def _notion_content(page_id: str) -> str:
    """Concatenate plain text from a page's blocks (paginated)."""
    headers = _notion_headers()
    lines, cursor = [], None
    while True:
        params = {"page_size": 100}
        if cursor:
            params["start_cursor"] = cursor
        resp = requests.get(f"{NOTION_API}/blocks/{page_id}/children", headers=headers, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        for block in data.get("results", []):
            btype = block.get("type", "")
            rich = (block.get(btype) or {}).get("rich_text", [])
            text = "".join(r.get("plain_text", "") for r in rich)
            if text:
                lines.append(text)
        if not data.get("has_more"):
            return "\n".join(lines)
        cursor = data.get("next_cursor")


def sync_notion(progress_cb=None) -> dict:
    """Sync Notion pages shared with the integration into ChromaDB."""
    _notion_headers()  # fail fast if no token
    team = os.environ.get("NOTION_TEAM", "Product")
    collection = _get_collection()

    pages = _notion_search_pages()
    if progress_cb:
        progress_cb(f"Found {len(pages)} Notion page(s) shared with the integration")

    ids, documents, metadatas = [], [], []
    for page in pages:
        title = _notion_title(page)
        content = _notion_content(page["id"]) or "(no text content)"
        if len(content) > 3000:
            content = content[:3000] + "…"
        chunk = f"Team: {team}\nTitle: {title}\n\n{content}"
        ids.append(_doc_id("notion", page["id"]))
        documents.append(chunk)
        metadatas.append({
            "team": team,
            "title": title,
            "tags": "notion",
            "source": "notion",
            "url": page.get("url", ""),
        })

    if ids:
        _upsert_batch(collection, ids, documents, metadatas)
        if progress_cb:
            progress_cb(f"  ✓ {len(ids)} Notion page(s) synced")

    return {"synced": len(ids)}


# ── Google Drive ──────────────────────────────────────────────────────────────
#
# Create a GCP service account, enable the Drive API, download its JSON key, and
# share the Drive files/folder with the service account's email. Then set:
#   GOOGLE_SERVICE_ACCOUNT_FILE=/path/to/key.json
#   GDRIVE_TEAM=Data            (AXIS team all Drive docs are filed under)
#   GDRIVE_FOLDER_ID=...        (optional — limit to one folder)

def sync_gdrive(progress_cb=None) -> dict:
    """Sync Google Docs the service account can access into ChromaDB."""
    sa_file = os.environ.get("GOOGLE_SERVICE_ACCOUNT_FILE", "")
    if not sa_file:
        raise RuntimeError("Missing GOOGLE_SERVICE_ACCOUNT_FILE (path to a service-account JSON key).")

    try:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build
    except ImportError:
        raise RuntimeError("Google libs not installed. Run: pip install google-api-python-client google-auth")

    team = os.environ.get("GDRIVE_TEAM", "Data")
    folder = os.environ.get("GDRIVE_FOLDER_ID", "")

    creds = service_account.Credentials.from_service_account_file(
        sa_file, scopes=["https://www.googleapis.com/auth/drive.readonly"]
    )
    service = build("drive", "v3", credentials=creds, cache_discovery=False)

    query = "mimeType='application/vnd.google-apps.document' and trashed=false"
    if folder:
        query += f" and '{folder}' in parents"

    collection = _get_collection()
    ids, documents, metadatas = [], [], []
    page_token = None
    while True:
        resp = service.files().list(
            q=query,
            fields="nextPageToken, files(id, name, webViewLink)",
            pageToken=page_token,
            pageSize=100,
        ).execute()

        for f in resp.get("files", []):
            try:
                exported = service.files().export(fileId=f["id"], mimeType="text/plain").execute()
                text = exported.decode("utf-8") if isinstance(exported, bytes) else str(exported)
            except Exception:
                text = ""
            if len(text) > 3000:
                text = text[:3000] + "…"
            title = f.get("name", "Untitled")
            chunk = f"Team: {team}\nTitle: {title}\n\n{text or '(no text content)'}"
            ids.append(_doc_id("gdrive", f["id"]))
            documents.append(chunk)
            metadatas.append({
                "team": team,
                "title": title,
                "tags": "google-drive",
                "source": "gdrive",
                "url": f.get("webViewLink", ""),
            })

        page_token = resp.get("nextPageToken")
        if not page_token:
            break

    if ids:
        _upsert_batch(collection, ids, documents, metadatas)
        if progress_cb:
            progress_cb(f"  ✓ {len(ids)} Google Doc(s) synced")

    return {"synced": len(ids)}


# ── Full sync ─────────────────────────────────────────────────────────────────

def sync_all(progress_cb=None) -> dict:
    results = {"jira": None, "confluence": None, "slack": None,
               "notion": None, "gdrive": None, "errors": []}

    steps = [
        ("jira", "Jira", sync_jira),
        ("confluence", "Confluence", sync_confluence),
        ("slack", "Slack", sync_slack),
        ("notion", "Notion", sync_notion),
        ("gdrive", "Google Drive", sync_gdrive),
    ]
    for key, label, fn in steps:
        try:
            results[key] = fn(progress_cb)
        except Exception as e:
            results["errors"].append(f"{label}: {e}")
            if progress_cb:
                progress_cb(f"{label} sync skipped: {e}")

    return results


# ── CLI ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("AXIS — Jira + Confluence + Slack Sync")
    print("=" * 50)
    results = sync_all(progress_cb=print)
    print()
    if results["jira"]:
        print(f"Jira: {results['jira']['synced']} tickets from {results['jira']['projects']}")
    if results["confluence"]:
        print(f"Confluence: {results['confluence']['synced']} pages from {results['confluence']['spaces']}")
    if results["slack"]:
        print(f"Slack: {results['slack']['synced']} messages from {results['slack']['channels']}")
    if results["notion"]:
        print(f"Notion: {results['notion']['synced']} pages")
    if results["gdrive"]:
        print(f"Google Drive: {results['gdrive']['synced']} docs")
    if results["errors"]:
        print("Errors:", results["errors"])
