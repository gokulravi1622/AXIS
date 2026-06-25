"""
AXIS — Authentication
Password hashing (PBKDF2, stdlib — no native deps) + JWT session tokens.
Exposes FastAPI dependencies to identify the caller on protected routes.
"""

import os
import hmac
import hashlib
import sqlite3
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, Header

from db import get_conn, now_iso

# ── Config ────────────────────────────────────────────────────────────────────
# Set AXIS_JWT_SECRET in your .env for production. The dev default keeps tokens
# stable across restarts but is NOT secret — change it before deploying.
JWT_SECRET = os.environ.get("AXIS_JWT_SECRET", "axis-dev-secret-change-me")
JWT_ALGO = "HS256"
TOKEN_TTL_DAYS = 7
PBKDF2_ROUNDS = 200_000


# ── Password hashing ──────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    """Return 'salt$hash' — salt is random per user, never store the raw password."""
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ROUNDS)
    return f"{salt.hex()}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt_hex, dk_hex = stored.split("$")
    except ValueError:
        return False
    salt = bytes.fromhex(salt_hex)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ROUNDS)
    return hmac.compare_digest(dk.hex(), dk_hex)


# ── JWT tokens ────────────────────────────────────────────────────────────────

def create_token(user_id: int, email: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "email": email,
        "iat": now,
        "exp": now + timedelta(days=TOKEN_TTL_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.PyJWTError:
        return None


# ── User CRUD ─────────────────────────────────────────────────────────────────

def create_user(email: str, name: str, password: str, org_id: int) -> dict:
    email = email.strip().lower()
    conn = get_conn()
    try:
        cur = conn.execute(
            "INSERT INTO users (email, name, password_hash, created_at, org_id) VALUES (?, ?, ?, ?, ?)",
            (email, name.strip(), hash_password(password), now_iso(), org_id),
        )
        conn.commit()
        return {"id": cur.lastrowid, "email": email, "name": name.strip(), "org_id": org_id}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="An account with that email already exists.")
    finally:
        conn.close()


def create_user_prehashed(email: str, name: str, password_hash: str, org_id: int) -> dict:
    """Insert a user whose password is already hashed (used after OTP verification)."""
    email = email.strip().lower()
    conn = get_conn()
    try:
        cur = conn.execute(
            "INSERT INTO users (email, name, password_hash, created_at, org_id) VALUES (?, ?, ?, ?, ?)",
            (email, name.strip(), password_hash, now_iso(), org_id),
        )
        conn.commit()
        return {"id": cur.lastrowid, "email": email, "name": name.strip(), "org_id": org_id}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="An account with that email already exists.")
    finally:
        conn.close()


def authenticate(email: str, password: str) -> dict:
    email = email.strip().lower()
    conn = get_conn()
    try:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    finally:
        conn.close()
    if not row or not verify_password(password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    return {"id": row["id"], "email": row["email"], "name": row["name"], "org_id": row["org_id"]}


def get_user_by_id(user_id: int) -> Optional[dict]:
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT id, email, name, org_id FROM users WHERE id = ?", (user_id,)
        ).fetchone()
    finally:
        conn.close()
    return dict(row) if row else None


# ── FastAPI dependencies ──────────────────────────────────────────────────────

def _user_from_header(authorization: Optional[str]) -> Optional[dict]:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    payload = decode_token(token)
    if not payload:
        return None
    return get_user_by_id(int(payload["sub"]))


def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """Required auth — raises 401 if the caller isn't a valid logged-in user."""
    user = _user_from_header(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated.")
    return user


def get_optional_user(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    """Optional auth — returns the user if a valid token is present, else None."""
    return _user_from_header(authorization)
