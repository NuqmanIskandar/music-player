"""Download YouTube links as MP3, sharing one file per video across all users.

Flow for a job:
  1. Read the video id straight from the URL. If the server already has that track,
     just add it to the user's library — no network call, no new file.
  2. Otherwise ask YouTube for the video info (resolves odd URLs, playlists, etc.).
  3. Take a per-video lock so two users adding the same song at once produce one
     download: the second waits, then finds the finished track and reuses it.
"""

import re
import shutil
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from dataclasses import asdict, dataclass, field
from pathlib import Path

import yt_dlp

from .config import settings
from .db import get_db


def _ffmpeg_location() -> str:
    """Prefer a system ffmpeg; otherwise use the binary bundled with imageio-ffmpeg."""
    system = shutil.which("ffmpeg")
    if system:
        return system
    import imageio_ffmpeg

    return imageio_ffmpeg.get_ffmpeg_exe()


FFMPEG = _ffmpeg_location()

_VIDEO_ID_RE = re.compile(
    r"(?:[?&]v=|youtu\.be/|/shorts/|/embed/|/live/|/v/)([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])"
)


def extract_video_id(url: str) -> str | None:
    m = _VIDEO_ID_RE.search(url)
    return m.group(1) if m else None


# ---------- per-video locks ----------

_locks: dict[str, threading.Lock] = {}
_locks_guard = threading.Lock()


@contextmanager
def video_lock(video_id: str):
    with _locks_guard:
        lock = _locks.setdefault(video_id, threading.Lock())
    with lock:
        yield


# ---------- jobs ----------

@dataclass
class Job:
    id: str
    user_id: int
    url: str
    status: str = "queued"  # queued | downloading | converting | done | error
    progress: float = 0.0  # 0..100
    title: str | None = None
    song_id: str | None = None
    message: str | None = None  # shown under the title when done
    error: str | None = None
    finished_at: float | None = None

    def public(self) -> dict:
        d = asdict(self)
        d.pop("user_id")
        d.pop("finished_at")
        return d


@dataclass
class JobStore:
    jobs: dict[str, Job] = field(default_factory=dict)
    lock: threading.Lock = field(default_factory=threading.Lock)

    def create(self, user_id: int, url: str) -> Job:
        job = Job(id=uuid.uuid4().hex, user_id=user_id, url=url)
        with self.lock:
            # forget jobs that finished more than 6 hours ago
            cutoff = time.time() - 6 * 3600
            self.jobs = {k: j for k, j in self.jobs.items() if not j.finished_at or j.finished_at > cutoff}
            self.jobs[job.id] = job
        return job

    def update(self, job: Job, **changes) -> None:
        with self.lock:
            for k, v in changes.items():
                setattr(job, k, v)
            if job.status in ("done", "error") and not job.finished_at:
                job.finished_at = time.time()

    def for_user(self, user_id: int) -> list[dict]:
        with self.lock:
            return [j.public() for j in self.jobs.values() if j.user_id == user_id]

    def clear_finished(self, user_id: int) -> None:
        with self.lock:
            self.jobs = {
                k: j for k, j in self.jobs.items()
                if j.user_id != user_id or j.status not in ("done", "error")
            }


jobs = JobStore()
_executor = ThreadPoolExecutor(max_workers=settings.max_concurrent_downloads, thread_name_prefix="dl")


# ---------- library helpers ----------

def _track_file_exists(conn, video_id: str) -> bool:
    row = conn.execute("SELECT filename FROM tracks WHERE id = ?", (video_id,)).fetchone()
    return bool(row) and (settings.music_dir / row["filename"]).exists()


def _attach_existing(job: Job, video_id: str) -> bool:
    """If the server already has this track, add it to the user's library and finish the job."""
    with get_db() as conn:
        if not _track_file_exists(conn, video_id):
            return False
        title = conn.execute("SELECT title FROM tracks WHERE id = ?", (video_id,)).fetchone()["title"]
        cur = conn.execute(
            "INSERT OR IGNORE INTO library (user_id, track_id) VALUES (?, ?)", (job.user_id, video_id)
        )
    message = "Added instantly — already on the server" if cur.rowcount else "Already in your library"
    jobs.update(job, status="done", progress=100.0, song_id=video_id, title=title, message=message)
    return True


def delete_track_if_unused(video_id: str) -> None:
    """Remove a track and its files once no user has it in their library."""
    with video_lock(video_id):
        with get_db() as conn:
            if conn.execute("SELECT 1 FROM library WHERE track_id = ? LIMIT 1", (video_id,)).fetchone():
                return
            row = conn.execute("SELECT filename, cover FROM tracks WHERE id = ?", (video_id,)).fetchone()
            if not row:
                return
            conn.execute("DELETE FROM tracks WHERE id = ?", (video_id,))
        (settings.music_dir / row["filename"]).unlink(missing_ok=True)
        if row["cover"]:
            (settings.covers_dir / row["cover"]).unlink(missing_ok=True)


# ---------- downloading ----------

def _clean_artist(info: dict) -> str | None:
    artist = info.get("artist") or info.get("creator") or info.get("uploader") or info.get("channel")
    if artist and artist.endswith(" - Topic"):
        artist = artist[: -len(" - Topic")]
    return artist


def _ydl_opts(job: Job) -> dict:
    def progress_hook(d: dict) -> None:
        if d["status"] == "downloading":
            total = d.get("total_bytes") or d.get("total_bytes_estimate")
            if total:
                jobs.update(job, status="downloading", progress=round(d["downloaded_bytes"] / total * 100, 1))
        elif d["status"] == "finished":
            jobs.update(job, status="converting", progress=100.0)

    opts = {
        "format": "bestaudio/best",
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "ffmpeg_location": FFMPEG,
        # YouTube requires a JS runtime for signature solving (Deno or Node).
        "js_runtimes": {"deno": {}, "node": {}},
        "outtmpl": {
            "default": str(settings.music_dir / "%(title).150B [%(id)s].%(ext)s"),
            "thumbnail": str(settings.covers_dir / "%(id)s.%(ext)s"),
        },
        "writethumbnail": True,
        "postprocessors": [
            {"key": "FFmpegExtractAudio", "preferredcodec": "mp3", "preferredquality": settings.mp3_quality},
            {"key": "FFmpegMetadata", "add_metadata": True},
            {"key": "FFmpegThumbnailsConvertor", "format": "jpg", "when": "before_dl"},
        ],
        "progress_hooks": [progress_hook],
    }
    if settings.ytdlp_cookies_file:
        opts["cookiefile"] = str(settings.ytdlp_cookies_file)
    if settings.ytdlp_proxy:
        opts["proxy"] = settings.ytdlp_proxy
    return opts


def _run(job: Job) -> None:
    try:
        # 1. Fast path: known video id already on the server.
        video_id = extract_video_id(job.url)
        if video_id and _attach_existing(job, video_id):
            return

        jobs.update(job, status="downloading")
        with yt_dlp.YoutubeDL(_ydl_opts(job)) as ydl:
            # 2. Resolve the link.
            info = ydl.extract_info(job.url, download=False)
            if info.get("_type") == "playlist":
                entries = [e for e in (info.get("entries") or []) if e]
                if not entries:
                    raise ValueError("No videos found at this link.")
                info = entries[0]
            video_id = info["id"]
            jobs.update(job, title=info.get("title"))

            # 3. One download per video, even with simultaneous requests.
            with video_lock(video_id):
                if _attach_existing(job, video_id):
                    return
                info = ydl.process_ie_result(info, download=True)

                downloads = info.get("requested_downloads") or []
                mp3_path = Path(downloads[0]["filepath"]) if downloads else None
                if not mp3_path or not mp3_path.exists():
                    raise RuntimeError("Download finished but the MP3 file was not found.")
                cover = settings.covers_dir / f"{video_id}.jpg"

                with get_db() as conn:
                    conn.execute(
                        "INSERT INTO tracks (id, title, artist, duration, filename, cover, source_url)"
                        " VALUES (?, ?, ?, ?, ?, ?, ?)"
                        " ON CONFLICT(id) DO UPDATE SET filename = excluded.filename, cover = excluded.cover",
                        (
                            video_id,
                            info.get("track") or info.get("title") or video_id,
                            _clean_artist(info),
                            int(info["duration"]) if info.get("duration") else None,
                            mp3_path.name,
                            cover.name if cover.exists() else None,
                            info.get("webpage_url") or job.url,
                        ),
                    )
                    conn.execute(
                        "INSERT OR IGNORE INTO library (user_id, track_id) VALUES (?, ?)",
                        (job.user_id, video_id),
                    )
        jobs.update(job, status="done", progress=100.0, song_id=video_id, message="Added to library")
    except Exception as exc:  # report every failure back to the UI
        msg = str(exc).removeprefix("ERROR: ").strip() or exc.__class__.__name__
        if "confirm you" in msg and "bot" in msg:
            msg = "YouTube blocked this server (bot check). Set YTDLP_COOKIES_FILE in backend/.env."
        jobs.update(job, status="error", error=msg)


def start_download(user_id: int, url: str) -> Job:
    job = jobs.create(user_id, url)
    _executor.submit(_run, job)
    return job
