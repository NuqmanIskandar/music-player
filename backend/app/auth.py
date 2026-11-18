"""Username + password accounts with signed (JWT) bearer tokens."""

import re
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pwdlib import PasswordHash
from pydantic import BaseModel, field_validator

from .config import settings
from .db import get_db

ALGORITHM = "HS256"
hasher = PasswordHash.recommended()  # Argon2
# Used to spend the same time on unknown usernames, so logins don't reveal which names exist.
_DUMMY_HASH = hasher.hash("not-a-real-password")
_bearer = HTTPBearer(auto_error=False)
_USERNAME_RE = re.compile(r"^[A-Za-z0-9_.-]{3,32}$")


class Credentials(BaseModel):
    username: str
    password: str

    @field_validator("username")
    @classmethod
    def valid_username(cls, v: str) -> str:
        v = v.strip()
        if not _USERNAME_RE.match(v):
            raise ValueError("Username must be 3–32 characters: letters, numbers, . _ -")
        return v

    @field_validator("password")
    @classmethod
    def valid_password(cls, v: str) -> str:
        if not 8 <= len(v) <= 128:
            raise ValueError("Password must be 8–128 characters.")
        return v


def _unauthorized(detail: str = "Please sign in again.") -> HTTPException:
    return HTTPException(status.HTTP_401_UNAUTHORIZED, detail, headers={"WWW-Authenticate": "Bearer"})


def create_token(user_id: int) -> str:
    expires = datetime.now(timezone.utc) + timedelta(days=settings.access_token_expire_days)
    return jwt.encode({"sub": str(user_id), "exp": expires}, settings.secret_key, algorithm=ALGORITHM)


def session_for(user) -> dict:
    return {"token": create_token(user["id"]), "user": {"id": user["id"], "username": user["username"]}}


def _user_from_token(token: str | None) -> dict:
    if not token:
        raise _unauthorized("Not signed in.")
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise _unauthorized()
    with get_db() as conn:
        row = conn.execute("SELECT id, username FROM users WHERE id = ?", (user_id,)).fetchone()
    if not row:
        raise _unauthorized()
    return dict(row)


def current_user(creds: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> dict:
    return _user_from_token(creds.credentials if creds else None)


def current_user_media(
    token: str | None = Query(default=None, description="Same token, for <audio>/<img> URLs"),
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict:
    """Audio and image tags can't send headers, so media URLs may carry ?token=…"""
    return _user_from_token(creds.credentials if creds else token)


def signup(body: Credentials) -> dict:
    if not settings.allow_signup:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sign-up is disabled on this server.")
    with get_db() as conn:
        is_first_user = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0
        exists = conn.execute("SELECT 1 FROM users WHERE username = ?", (body.username,)).fetchone()
        if exists:
            raise HTTPException(status.HTTP_409_CONFLICT, "That username is taken.")
        cur = conn.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (body.username, hasher.hash(body.password)),
        )
        user_id = cur.lastrowid
        if is_first_user:
            # Claim everything created before accounts existed.
            conn.execute(
                "INSERT OR IGNORE INTO library (user_id, track_id, added_at)"
                " SELECT ?, id, created_at FROM tracks",
                (user_id,),
            )
            conn.execute("UPDATE playlists SET user_id = ? WHERE user_id IS NULL", (user_id,))
        user = conn.execute("SELECT id, username FROM users WHERE id = ?", (user_id,)).fetchone()
    return session_for(user)


def login(body: Credentials) -> dict:
    with get_db() as conn:
        user = conn.execute(
            "SELECT id, username, password_hash FROM users WHERE username = ?", (body.username,)
        ).fetchone()
    if not user:
        hasher.verify(body.password, _DUMMY_HASH)
        raise _unauthorized("Wrong username or password.")
    valid, new_hash = hasher.verify_and_update(body.password, user["password_hash"])
    if not valid:
        raise _unauthorized("Wrong username or password.")
    if new_hash:  # hashing parameters were upgraded
        with get_db() as conn:
            conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (new_hash, user["id"]))
    return session_for(user)
