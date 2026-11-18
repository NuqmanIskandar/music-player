# Music Player

A personal music player with accounts. You paste a YouTube link, the server saves it as an MP3, and you can play songs and build playlists from them.

- **backend/**: FastAPI + yt-dlp, managed with `uv`. Uses SQLite and username/password accounts.
- **frontend/**: React + Vite.

**One file per song.** MP3s are shared between all users. When a second person adds a song the server already has, it's added to their library instantly and nothing is downloaded. If two people add the same song at the same moment, it's still downloaded once. A file is deleted only when the last user who has it removes it.

---

## Local development

```bash
# backend → http://127.0.0.1:8000  (API docs at /docs)
cd backend
cp .env.example .env        # then set SECRET_KEY:  openssl rand -hex 32
uv run uvicorn app.main:app --reload --port 8000

# frontend → http://localhost:5173
cd frontend
npm install
npm run dev
```

> **Existing library:** your songs and playlists from before accounts existed go to the **first account you sign up**. A backup of the old database is in `backend/storage/library.before-auth.db`.

---

## Deploying to a VPS (Ubuntu/Debian)

The recommended setup is one server that serves both the API and the built frontend, with **Caddy** in front for HTTPS.

```
browser ──HTTPS──▶ Caddy :443 ──▶ uvicorn 127.0.0.1:8000  (API + frontend/dist)
```

### 1. Prepare the server (once)

```bash
sudo apt update && sudo apt install -y git ffmpeg unzip
sudo useradd -m -s /bin/bash music          # a dedicated user for the app
sudo mkdir -p /opt/music-player && sudo chown music:music /opt/music-player
sudo -iu music
curl -LsSf https://astral.sh/uv/install.sh | sh      # uv (Python)
curl -fsSL https://deno.land/install.sh | sh -s -- -y # deno (yt-dlp needs it for YouTube)
```
You also need Node 20+ **on the machine where you build the frontend**. That can be your laptop (see step 3).

### 2. Get the code and configure it

```bash
git clone <your-repo-url> /opt/music-player
cd /opt/music-player/backend
uv sync --frozen
cp .env.example .env
nano .env
```
Set these in `.env`:
| Variable | Value |
|---|---|
| `SECRET_KEY` | output of `openssl rand -hex 32`. Use a **new** value; don't reuse your laptop's. |
| `FRONTEND_DIST` | `/opt/music-player/frontend/dist` |
| `ALLOW_SIGNUP` | `true` for now. Change it to `false` after creating your accounts, then restart. |
| `CORS_ORIGINS` | only needed if the frontend is hosted somewhere else |

### 3. Build the frontend

The frontend is served by the backend from the same address, so leave `VITE_API_URL` empty:
```bash
cd /opt/music-player/frontend && npm ci && npm run build
```
(If you'd rather not install Node on the VPS, run `npm run build` on your laptop and copy `frontend/dist/` to the server with `scp -r dist music@<VPS-IP>:/opt/music-player/frontend/`.)

### 4. Run it as a service

```bash
sudo cp /opt/music-player/backend/deploy/music-player.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now music-player
curl http://127.0.0.1:8000/api/health        # → {"ok":true}
```

### 5. HTTPS with Caddy

Point your domain's DNS **A record** at the VPS IP, edit the domain in `backend/deploy/Caddyfile`, then:
```bash
sudo apt install -y caddy            # or see caddyserver.com/docs/install
sudo cp /opt/music-player/backend/deploy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo ufw allow 80,443/tcp            # if you use ufw
```
Open `https://your-domain`, sign up, and set `ALLOW_SIGNUP=false` once your accounts exist.

**No domain?** Change `--host 127.0.0.1` to `--host 0.0.0.0` in the service file, open port 8000, and use `http://<VPS-IP>:8000`. This works, but passwords and tokens then travel unencrypted. A free duckdns.org subdomain plus Caddy fixes that.

### Updating

```bash
cd /opt/music-player && git pull
cd backend && uv sync --frozen
cd ../frontend && npm ci && npm run build
sudo systemctl restart music-player
```

### Frontend hosted somewhere else (optional)

Set `VITE_API_URL=https://your-backend-domain` in `frontend/.env` before `npm run build`, and add the frontend's address to `CORS_ORIGINS` in `backend/.env`. An HTTPS frontend can't call an `http://` backend, because browsers block mixed content.

---

## Troubleshooting

- **"YouTube blocked this server (bot check)":** YouTube often blocks datacenter IPs. Export your YouTube cookies from a logged-in browser as `cookies.txt` (a "Get cookies.txt" browser extension does this). Upload the file to the server and set `YTDLP_COOKIES_FILE=/opt/music-player/backend/cookies.txt`. `YTDLP_PROXY` is the other option.
- **Downloads failing after a YouTube change:** update yt-dlp with `cd backend && uv lock --upgrade-package yt-dlp && uv sync`.
- **Backups:** everything lives in `backend/storage/` (MP3s, covers, `library.db`), so copy that folder now and then.

## Where files are stored

```
backend/storage/
├── music/        ← MP3s, one per YouTube video, shared by all users
├── covers/       ← album art (.jpg)
└── library.db    ← users, tracks, each user's library, playlists
```

## Configuration files

- `backend/.env` and `frontend/.env` are **git-ignored**. Never commit them.
- `backend/.env.example` and `frontend/.env.example` list every setting. These are committed.

## API overview

All endpoints except `/api/auth/*` and `/api/health` need `Authorization: Bearer <token>`. Media URLs (`/stream`, `/cover`) also accept `?token=`.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/auth/signup`, `/api/auth/login` `{username, password}` | Returns `{token, user}` |
| GET | `/api/auth/me` | Current user |
| POST | `/api/downloads` `{url}` | Add a YouTube link (reuses the file if it's already on the server) |
| GET / DELETE | `/api/downloads` | Your download jobs / clear finished ones |
| GET | `/api/songs` | Your library |
| GET | `/api/songs/{id}/stream`, `/cover` | Audio (supports seeking) and artwork |
| DELETE | `/api/songs/{id}` | Remove from your library (the file is deleted only if no one else has it) |
| GET / POST | `/api/playlists` | Your playlists / create `{name, description, song_ids}` |
| GET / PATCH / DELETE | `/api/playlists/{id}` | Read, edit (incl. song order) or delete |
| POST | `/api/playlists/{id}/songs` `{song_ids}` | Add songs |
| DELETE | `/api/playlists/{id}/songs/{song_id}` | Remove a song from a playlist |
