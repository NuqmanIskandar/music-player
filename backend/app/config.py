"""App settings, read from environment variables or backend/.env (see .env.example)."""

from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", env_file_encoding="utf-8", extra="ignore")

    # --- auth ---
    secret_key: str  # signs login tokens; generate with: openssl rand -hex 32
    access_token_expire_days: int = 30
    allow_signup: bool = True  # set false once your accounts exist

    # --- web ---
    # Comma-separated list of frontend origins allowed to call the API.
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    # Optional regex for origins that change, e.g. Vercel preview deployments:
    #   https://music-player(-[a-z0-9-]+)?\.vercel\.app
    cors_origin_regex: str | None = None
    # Optional: path to the built frontend (frontend/dist) to serve it from this server too.
    frontend_dist: Path | None = None

    # --- storage & downloads ---
    storage_dir: Path = BASE_DIR / "storage"
    mp3_quality: str = "192"  # kbps
    max_concurrent_downloads: int = 2
    # Optional helpers when YouTube blocks the server's IP ("Sign in to confirm you're not a bot").
    ytdlp_cookies_file: Path | None = None  # Netscape-format cookies.txt exported from your browser
    ytdlp_proxy: str | None = None  # e.g. http://user:pass@host:port

    @field_validator("secret_key")
    @classmethod
    def strong_secret(cls, v: str) -> str:
        if len(v) < 32 or v.startswith("change-me"):
            raise ValueError("SECRET_KEY must be a random string of 32+ characters (openssl rand -hex 32)")
        return v

    @field_validator("frontend_dist", "ytdlp_cookies_file", "ytdlp_proxy", "cors_origin_regex", mode="before")
    @classmethod
    def empty_is_none(cls, v):
        return v or None

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip().rstrip("/") for o in self.cors_origins.split(",") if o.strip()]

    @property
    def music_dir(self) -> Path:
        return self.storage_dir / "music"

    @property
    def covers_dir(self) -> Path:
        return self.storage_dir / "covers"

    @property
    def db_path(self) -> Path:
        return self.storage_dir / "library.db"


settings = Settings()

for d in (settings.storage_dir, settings.music_dir, settings.covers_dir):
    d.mkdir(parents=True, exist_ok=True)
