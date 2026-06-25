"""
AXIS — Background sync scheduler
Runs Jira + Confluence sync automatically every SYNC_INTERVAL_HOURS hours.
"""
import os
import threading
import time
import logging
from datetime import datetime

from sync import sync_all

SYNC_INTERVAL_HOURS = float(os.environ.get("AXIS_SYNC_INTERVAL_HOURS", "6"))
SYNC_INTERVAL_SECONDS = SYNC_INTERVAL_HOURS * 3600

logger = logging.getLogger("axis.scheduler")
_thread = None
_last_sync = None
_next_sync = None
_running = False
_events: list[dict] = []          # ring buffer of last 20 sync events
_MAX_EVENTS = 20


def _push_event(event: dict):
    global _events
    _events.append(event)
    if len(_events) > _MAX_EVENTS:
        _events = _events[-_MAX_EVENTS:]


def get_events_since(since_ts: str | None) -> list[dict]:
    """Return events newer than since_ts (ISO string). Returns all if since_ts is None."""
    if not since_ts:
        return list(_events)
    return [e for e in _events if e["timestamp"] > since_ts]


def _sync_loop():
    global _last_sync, _next_sync, _running
    while _running:
        try:
            logger.info(f"Auto-sync starting...")
            result = sync_all(progress_cb=lambda msg: logger.info(f"  {msg}"))
            _last_sync = datetime.utcnow().isoformat() + "Z"
            j = result.get("jira", {})
            c = result.get("confluence", {})
            jira_count = j.get("synced", 0) if j else 0
            conf_count = c.get("synced", 0) if c else 0
            logger.info(f"Auto-sync done. Jira: {jira_count}, Confluence: {conf_count}")
            _push_event({
                "timestamp": _last_sync,
                "type": "auto_sync",
                "jira": jira_count,
                "confluence": conf_count,
                "message": f"Auto-sync complete — Jira: {jira_count} docs, Confluence: {conf_count} docs",
            })
            # refresh BM25 index after sync

            try:
                from query import get_bm25_index
                get_bm25_index().refresh()
            except Exception as e:
                logger.warning(f"BM25 refresh failed: {e}")
        except Exception as e:
            logger.error(f"Auto-sync error: {e}")
        _next_sync = time.time() + SYNC_INTERVAL_SECONDS
        time.sleep(SYNC_INTERVAL_SECONDS)


def start():
    global _thread, _running, _next_sync
    if _thread and _thread.is_alive():
        return
    _running = True
    _next_sync = time.time() + SYNC_INTERVAL_SECONDS
    _thread = threading.Thread(target=_sync_loop, daemon=True)
    _thread.start()
    logger.info(f"Scheduler started. Next sync in {SYNC_INTERVAL_HOURS}h")


def stop():
    global _running
    _running = False


def status() -> dict:
    return {
        "running": _running and bool(_thread and _thread.is_alive()),
        "interval_hours": SYNC_INTERVAL_HOURS,
        "last_sync": _last_sync,
        "next_sync_in_seconds": max(0, int(_next_sync - time.time())) if _next_sync else None,
    }
