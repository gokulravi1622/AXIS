"""
AXIS MCP Server — exposes AXIS tools to Claude Code and Claude.ai.

Implements the MCP 2025-03-26 Streamable HTTP transport (single POST endpoint).
Employees configure this once; then in any Claude Code session or Claude.ai chat
they can type "share my current work context to AXIS" and it just works.

Tools exposed:
  share_to_axis  — push a context entry into the AXIS knowledge base
  search_axis    — search the AXIS knowledge base from within a Claude session
"""

import logging
from typing import Optional

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from auth import decode_token, get_user_by_id
from contribute import submit_context
from query import retrieve

logger = logging.getLogger("axis.mcp")

router = APIRouter()

MCP_VERSION = "2025-03-26"
SERVER_NAME = "axis-mcp"
SERVER_VERSION = "1.0.0"

TOOLS = [
    {
        "name": "share_to_axis",
        "description": (
            "Share your current work context to the AXIS knowledge base so teammates "
            "can discover and request access to it. Use this when you've solved a problem, "
            "made an architectural decision, discovered something useful, or want to document "
            "what you're building. Claude will summarize the conversation context before sharing "
            "if you ask it to."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "title": {
                    "type": "string",
                    "description": "A short descriptive title (e.g. 'Fixed N+1 query in user dashboard')",
                },
                "content": {
                    "type": "string",
                    "description": (
                        "The context to share — what you're working on, the problem, "
                        "the solution, key decisions. Teammates will read this directly."
                    ),
                },
                "team": {
                    "type": "string",
                    "enum": ["Engineering", "Data", "CRM", "Client Success", "Product"],
                    "description": "Which team this context belongs to",
                },
                "tags": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Optional tags to improve discoverability (e.g. ['postgres', 'performance'])",
                },
            },
            "required": ["title", "content", "team"],
        },
    },
    {
        "name": "search_axis",
        "description": (
            "Search the AXIS knowledge base for context your teammates have shared. "
            "Use this before asking a colleague — they may have already documented the answer."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "What to search for",
                },
                "team": {
                    "type": "string",
                    "enum": ["Engineering", "Data", "CRM", "Client Success", "Product"],
                    "description": "Optional: restrict results to a specific team",
                },
            },
            "required": ["query"],
        },
    },
]


def _track_mcp_connection(authorization: Optional[str]) -> None:
    """Best-effort: mark this user as connected via Claude Desktop MCP."""
    if not authorization or not authorization.startswith("Bearer "):
        return
    from auth import decode_token
    from db import get_conn, now_iso
    payload = decode_token(authorization[7:].strip())
    if not payload:
        return
    try:
        conn = get_conn()
        try:
            conn.execute(
                "UPDATE users SET mcp_last_seen = ?, mcp_desktop_connected = 1 WHERE id = ?",
                (now_iso(), int(payload["sub"])),
            )
            conn.commit()
        finally:
            conn.close()
    except Exception:
        pass


def _auth_user(authorization: Optional[str]) -> dict:
    """Extract and validate the AXIS user from the Authorization header."""
    if not authorization or not authorization.startswith("Bearer "):
        return _err_response(None, -32001, "Authorization required. Add your AXIS token as a Bearer header.")
    token = authorization[7:].strip()
    payload = decode_token(token)
    if not payload:
        return _err_response(None, -32001, "Invalid or expired AXIS token.")
    user = get_user_by_id(int(payload["sub"]))
    if not user:
        return _err_response(None, -32001, "AXIS user not found.")
    return user


def _ok(msg_id, result: dict) -> dict:
    return {"jsonrpc": "2.0", "id": msg_id, "result": result}


def _err_response(msg_id, code: int, message: str) -> dict:
    return {"jsonrpc": "2.0", "id": msg_id, "error": {"code": code, "message": message}}


def _text_content(text: str) -> dict:
    return {"content": [{"type": "text", "text": text}], "isError": False}


def _error_content(text: str) -> dict:
    return {"content": [{"type": "text", "text": text}], "isError": True}


def _handle(msg: dict, authorization: Optional[str]) -> Optional[dict]:
    method = msg.get("method", "")
    params = msg.get("params") or {}

    # Notifications have no 'id' field at all — must not send a response
    if "id" not in msg:
        return None
    msg_id = msg.get("id")

    try:
        if method == "initialize":
            _track_mcp_connection(authorization)
            return _ok(msg_id, {
                "protocolVersion": MCP_VERSION,
                "serverInfo": {"name": SERVER_NAME, "version": SERVER_VERSION},
                "capabilities": {"tools": {}},
            })

        if method == "tools/list":
            return _ok(msg_id, {"tools": TOOLS})

        if method == "tools/call":
            user_or_err = _auth_user(authorization)
            if "jsonrpc" in user_or_err:
                return {**user_or_err, "id": msg_id}
            user = user_or_err

            tool = params.get("name")
            args = params.get("arguments") or {}

            if tool == "share_to_axis":
                team = args.get("team", "")
                title = (args.get("title") or "").strip()
                content = (args.get("content") or "").strip()
                tags = args.get("tags") or []

                if not title:
                    return _ok(msg_id, _error_content("Title is required."))
                if not content:
                    return _ok(msg_id, _error_content("Content is required."))

                try:
                    doc_id = submit_context(
                        team=team,
                        title=title,
                        content=content,
                        author=user["name"],
                        tags=tags,
                        contributed_by=user["email"],
                    )
                except ValueError as exc:
                    return _ok(msg_id, _error_content(str(exc)))
                except Exception:
                    logger.exception("submit_context failed user=%s team=%s", user["email"], team)
                    return _ok(msg_id, _error_content(
                        "Failed to save context to AXIS. Please try again or contact your admin."
                    ))
                return _ok(msg_id, _text_content(
                    f"Shared to AXIS! Entry saved as **{title}** (ID: `{doc_id}`, team: {team}).\n\n"
                    f"Teammates can now find this in the AXIS knowledge base. "
                    f"If it's private to your work, they can request access via the AXIS grant flow."
                ))

            if tool == "search_axis":
                query = (args.get("query") or "").strip()
                team_filter = args.get("team")
                if not query:
                    return _ok(msg_id, _error_content("Query is required."))

                chunks = retrieve(query, team_filter=team_filter)
                if not chunks:
                    return _ok(msg_id, _text_content(
                        f"No relevant context found in AXIS for: **{query}**.\n"
                        "Your teammates may not have documented this yet."
                    ))

                shown = chunks[:4]
                total = len(chunks)
                suffix = f" (showing top {len(shown)})" if total > len(shown) else ""
                lines = [f"Found {total} relevant entries in AXIS for **{query}**{suffix}:\n"]
                for i, c in enumerate(shown, 1):
                    title = c.get("title") or "(untitled)"
                    team = c.get("team") or "Unknown team"
                    relevance = c.get("relevance", "?")
                    content = c.get("content") or ""
                    lines.append(f"### {i}. {title} ({team} — {relevance}% relevance)")
                    preview = content[:500]
                    if len(content) > 500:
                        preview += "…"
                    lines.append(preview)
                    lines.append("")
                return _ok(msg_id, _text_content("\n".join(lines)))

            return _err_response(msg_id, -32602, f"Unknown tool: {tool}")

        return _err_response(msg_id, -32601, f"Method not found: {method}")

    except Exception as e:
        logger.error(f'"mcp error" method="{method}" error="{e}"')
        return _err_response(msg_id, -32603, f"Internal error: {e}")


@router.post("/mcp")
async def mcp_endpoint(request: Request):
    authorization = request.headers.get("Authorization")
    try:
        body = await request.json()
    except Exception:
        return JSONResponse(
            _err_response(None, -32700, "Parse error: invalid JSON"),
            status_code=400,
        )

    if isinstance(body, list):
        responses = [r for msg in body if (r := _handle(msg, authorization)) is not None]
        if not responses:
            return JSONResponse({}, status_code=202)
        return JSONResponse(responses)

    result = _handle(body, authorization)
    if result is None:
        return JSONResponse({}, status_code=202)
    return JSONResponse(result)
