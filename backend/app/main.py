from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator

from . import auth
from .auth import Credentials, current_user, current_user_media
from .config import settings
from .db import get_db, init_db
from .downloader import delete_track_if_unused, jobs, start_download

app = FastAPI(title="Music Player API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
)
init_db()

# Files never change for a given track id, so browsers can cache them for good.
MEDIA_CACHE = {"Cache-Control": "private, max-age=31536000, immutable"}

SONG_COLUMNS = "t.id, t.title, t.artist, t.duration, t.cover, t.source_url, l.added_at"


# ---------- helpers ----------

def song_to_dict(row) -> dict:
    d = dict(row)
    d["stream_url"] = f"/api/songs/{d['id']}/stream"
    d["cover_url"] = f"/api/songs/{d['id']}/cover" if d.pop("cover", None) else None
    return d


def get_library_track_or_404(conn, user_id: int, song_id: str):
    row = conn.execute(
        "SELECT t.* FROM library l JOIN tracks t ON t.id = l.track_id WHERE l.user_id = ? AND l.track_id = ?",
        (user_id, song_id),
    ).fetchone()
    if not row:
        raise HTTPException(404, "Song not found")
    return row


def get_playlist_or_404(conn, user_id: int, playlist_id: int):
    row = conn.execute(
        "SELECT id, name, description, created_at FROM playlists WHERE id = ? AND user_id = ?",
        (playlist_id, user_id),
    ).fetchone()
    if not row:
        raise HTTPException(404, "Playlist not found")
    return row


def playlist_songs(conn, playlist_id: int, user_id: int) -> list[dict]:
    rows = conn.execute(
        f"SELECT {SONG_COLUMNS} FROM playlist_songs ps"
        " JOIN tracks t ON t.id = ps.song_id"
        " JOIN library l ON l.track_id = t.id AND l.user_id = ?"
        " WHERE ps.playlist_id = ? ORDER BY ps.position",
        (user_id, playlist_id),
    ).fetchall()
    return [song_to_dict(r) for r in rows]


def playlist_to_dict(conn, row, user_id: int, with_songs: bool = False) -> dict:
    d = dict(row)
    songs = playlist_songs(conn, d["id"], user_id)
    d["song_count"] = len(songs)
    d["duration"] = sum(s["duration"] or 0 for s in songs)
    d["covers"] = [s["cover_url"] for s in songs if s["cover_url"]][:4]
    if with_songs:
        d["songs"] = songs
    return d


def set_playlist_songs(conn, user_id: int, playlist_id: int, song_ids: list[str]) -> None:
    ordered = list(dict.fromkeys(song_ids))  # de-duplicate, keep order
    if ordered:
        placeholders = ",".join("?" * len(ordered))
        owned = {r["track_id"] for r in conn.execute(
            f"SELECT track_id FROM library WHERE user_id = ? AND track_id IN ({placeholders})",
            [user_id, *ordered],
        )}
        missing = [s for s in ordered if s not in owned]
        if missing:
            raise HTTPException(400, f"Not in your library: {', '.join(missing)}")
    conn.execute("DELETE FROM playlist_songs WHERE playlist_id = ?", (playlist_id,))
    conn.executemany(
        "INSERT INTO playlist_songs (playlist_id, song_id, position) VALUES (?, ?, ?)",
        [(playlist_id, sid, i) for i, sid in enumerate(ordered)],
    )


# ---------- auth ----------

@app.get("/api/auth/config")
def auth_config():
    return {"allow_signup": settings.allow_signup}


@app.post("/api/auth/signup", status_code=201)
def signup(body: Credentials):
    return auth.signup(body)


@app.post("/api/auth/login")
def login(body: Credentials):
    return auth.login(body)


@app.get("/api/auth/me")
def me(user: dict = Depends(current_user)):
    return user


# ---------- downloads ----------

class DownloadRequest(BaseModel):
    url: str

    @field_validator("url")
    @classmethod
    def must_be_youtube(cls, v: str) -> str:
        v = v.strip()
        if not any(h in v for h in ("youtube.com/", "youtu.be/")):
            raise ValueError("Please paste a YouTube link.")
        return v


@app.post("/api/downloads", status_code=202)
def create_download(req: DownloadRequest, user: dict = Depends(current_user)):
    return start_download(user["id"], req.url).public()


@app.get("/api/downloads")
def list_downloads(user: dict = Depends(current_user)):
    return jobs.for_user(user["id"])


@app.delete("/api/downloads", status_code=204)
def clear_downloads(user: dict = Depends(current_user)):
    jobs.clear_finished(user["id"])


# ---------- songs (the user's library) ----------

@app.get("/api/songs")
def list_songs(user: dict = Depends(current_user)):
    with get_db() as conn:
        rows = conn.execute(
            f"SELECT {SONG_COLUMNS} FROM library l JOIN tracks t ON t.id = l.track_id"
            " WHERE l.user_id = ? ORDER BY l.added_at DESC",
            (user["id"],),
        ).fetchall()
        return [song_to_dict(r) for r in rows]


@app.get("/api/songs/{song_id}/stream")
def stream_song(song_id: str, user: dict = Depends(current_user_media)):
    with get_db() as conn:
        row = get_library_track_or_404(conn, user["id"], song_id)
    path = settings.music_dir / row["filename"]
    if not path.exists():
        raise HTTPException(404, "Audio file is missing from storage")
    return FileResponse(path, media_type="audio/mpeg", headers=MEDIA_CACHE)


@app.get("/api/songs/{song_id}/cover")
def song_cover(song_id: str, user: dict = Depends(current_user_media)):
    with get_db() as conn:
        row = get_library_track_or_404(conn, user["id"], song_id)
    if not row["cover"] or not (settings.covers_dir / row["cover"]).exists():
        raise HTTPException(404, "No cover")
    return FileResponse(settings.covers_dir / row["cover"], media_type="image/jpeg", headers=MEDIA_CACHE)


@app.delete("/api/songs/{song_id}", status_code=204)
def remove_song(song_id: str, user: dict = Depends(current_user)):
    """Removes the song from this user's library. The file is deleted only if nobody else has it."""
    with get_db() as conn:
        get_library_track_or_404(conn, user["id"], song_id)
        conn.execute(
            "DELETE FROM playlist_songs WHERE song_id = ?"
            " AND playlist_id IN (SELECT id FROM playlists WHERE user_id = ?)",
            (song_id, user["id"]),
        )
        conn.execute("DELETE FROM library WHERE user_id = ? AND track_id = ?", (user["id"], song_id))
    delete_track_if_unused(song_id)


# ---------- playlists ----------

class PlaylistCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=500)
    song_ids: list[str] = []


class PlaylistUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    song_ids: list[str] | None = None


class SongIds(BaseModel):
    song_ids: list[str]


@app.get("/api/playlists")
def list_playlists(user: dict = Depends(current_user)):
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, name, description, created_at FROM playlists WHERE user_id = ?"
            " ORDER BY created_at DESC, id DESC",
            (user["id"],),
        ).fetchall()
        return [playlist_to_dict(conn, r, user["id"]) for r in rows]


@app.post("/api/playlists", status_code=201)
def create_playlist(body: PlaylistCreate, user: dict = Depends(current_user)):
    with get_db() as conn:
        cur = conn.execute(
            "INSERT INTO playlists (user_id, name, description) VALUES (?, ?, ?)",
            (user["id"], body.name.strip(), body.description.strip()),
        )
        set_playlist_songs(conn, user["id"], cur.lastrowid, body.song_ids)
        row = get_playlist_or_404(conn, user["id"], cur.lastrowid)
        return playlist_to_dict(conn, row, user["id"], with_songs=True)


@app.get("/api/playlists/{playlist_id}")
def get_playlist(playlist_id: int, user: dict = Depends(current_user)):
    with get_db() as conn:
        row = get_playlist_or_404(conn, user["id"], playlist_id)
        return playlist_to_dict(conn, row, user["id"], with_songs=True)


@app.patch("/api/playlists/{playlist_id}")
def update_playlist(playlist_id: int, body: PlaylistUpdate, user: dict = Depends(current_user)):
    with get_db() as conn:
        get_playlist_or_404(conn, user["id"], playlist_id)
        if body.name is not None:
            conn.execute("UPDATE playlists SET name = ? WHERE id = ?", (body.name.strip(), playlist_id))
        if body.description is not None:
            conn.execute(
                "UPDATE playlists SET description = ? WHERE id = ?", (body.description.strip(), playlist_id)
            )
        if body.song_ids is not None:
            set_playlist_songs(conn, user["id"], playlist_id, body.song_ids)
        row = get_playlist_or_404(conn, user["id"], playlist_id)
        return playlist_to_dict(conn, row, user["id"], with_songs=True)


@app.post("/api/playlists/{playlist_id}/songs")
def add_playlist_songs(playlist_id: int, body: SongIds, user: dict = Depends(current_user)):
    with get_db() as conn:
        row = get_playlist_or_404(conn, user["id"], playlist_id)
        current = [s["id"] for s in playlist_songs(conn, playlist_id, user["id"])]
        set_playlist_songs(conn, user["id"], playlist_id, current + body.song_ids)
        return playlist_to_dict(conn, row, user["id"], with_songs=True)


@app.delete("/api/playlists/{playlist_id}/songs/{song_id}")
def remove_playlist_song(playlist_id: int, song_id: str, user: dict = Depends(current_user)):
    with get_db() as conn:
        row = get_playlist_or_404(conn, user["id"], playlist_id)
        conn.execute("DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?", (playlist_id, song_id))
        return playlist_to_dict(conn, row, user["id"], with_songs=True)


@app.delete("/api/playlists/{playlist_id}", status_code=204)
def delete_playlist(playlist_id: int, user: dict = Depends(current_user)):
    with get_db() as conn:
        get_playlist_or_404(conn, user["id"], playlist_id)
        conn.execute("DELETE FROM playlists WHERE id = ?", (playlist_id,))


@app.get("/api/health")
def health():
    return {"ok": True}


# Optionally serve the built frontend from this same server (set FRONTEND_DIST).
if settings.frontend_dist and settings.frontend_dist.is_dir():
    app.mount("/", StaticFiles(directory=settings.frontend_dist, html=True), name="frontend")
