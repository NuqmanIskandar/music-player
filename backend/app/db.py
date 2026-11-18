"""SQLite storage.

Data model (one MP3 per YouTube video, shared by every user):

    tracks          one row per downloaded video = one file on disk
    library         which users have which tracks  (user_id, track_id)
    playlists       owned by a user
    playlist_songs  ordered tracks in a playlist

A track's file is deleted only when no user has it in their library anymore.
"""

import sqlite3
from contextlib import contextmanager

from .config import settings

SCHEMA_VERSION = 1

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tracks (
    id          TEXT PRIMARY KEY,          -- YouTube video id
    title       TEXT NOT NULL,
    artist      TEXT,
    duration    INTEGER,                   -- seconds
    filename    TEXT NOT NULL,             -- file name inside storage/music
    cover       TEXT,                      -- file name inside storage/covers
    source_url  TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS library (
    user_id   INTEGER NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    track_id  TEXT    NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    added_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, track_id)
);
CREATE INDEX IF NOT EXISTS idx_library_track ON library(track_id);

CREATE TABLE IF NOT EXISTS playlists (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_playlists_user ON playlists(user_id);

CREATE TABLE IF NOT EXISTS playlist_songs (
    playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    song_id     TEXT    NOT NULL REFERENCES tracks(id)    ON DELETE CASCADE,
    position    INTEGER NOT NULL,
    PRIMARY KEY (playlist_id, song_id)
);
"""


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(settings.db_path, timeout=15)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def get_db():
    conn = _connect()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    conn = _connect()
    try:
        conn.execute("PRAGMA journal_mode = WAL")  # readers don't block the downloader's writes
        version = conn.execute("PRAGMA user_version").fetchone()[0]
        if version < 1:
            legacy = conn.execute(
                "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'songs'"
            ).fetchone()
            if legacy:
                # Single-user database from before accounts existed. Keep all data:
                # songs -> tracks (playlist_songs references follow the rename), and
                # playlists get an owner column. The first account to sign up claims them.
                conn.execute("ALTER TABLE songs RENAME TO tracks")
                conn.execute(
                    "ALTER TABLE playlists ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE"
                )
            conn.executescript(SCHEMA)
            # Drop any dangling rows (e.g. left by edits made with foreign keys off).
            conn.execute(
                "DELETE FROM playlist_songs WHERE playlist_id NOT IN (SELECT id FROM playlists)"
                " OR song_id NOT IN (SELECT id FROM tracks)"
            )
            conn.execute(f"PRAGMA user_version = {SCHEMA_VERSION}")
        conn.commit()
    finally:
        conn.close()
