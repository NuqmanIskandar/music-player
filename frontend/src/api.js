// Backend address. Empty = same origin (Vite dev proxy, or frontend served by the backend).
const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')
const SESSION_KEY = 'session'

// ---------- session (token + user) ----------

export const session = {
  get() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY))
    } catch {
      return null
    }
  },
  set(value) {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(value))
    } catch {
      /* private mode: session lasts until reload */
    }
    memory = value
  },
  clear() {
    try {
      localStorage.removeItem(SESSION_KEY)
    } catch {
      /* ignore */
    }
    memory = null
  },
}

let memory = session.get()
const token = () => memory?.token

let onUnauthorized = () => {}
/** Called when the server rejects our token (expired, user deleted, …). */
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn
}

// ---------- requests ----------

async function request(path, options = {}) {
  const headers = {}
  if (options.body) headers['Content-Type'] = 'application/json'
  if (token()) headers.Authorization = `Bearer ${token()}`

  let res
  try {
    res = await fetch(API_URL + path, {
      method: options.method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    })
  } catch {
    throw new Error('Cannot reach the server. Check your connection or the backend address.')
  }

  if (res.status === 401 && token()) {
    session.clear()
    onUnauthorized()
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const data = await res.json()
      if (typeof data.detail === 'string') message = data.detail
      else if (Array.isArray(data.detail)) message = data.detail[0]?.msg?.replace(/^Value error, /, '') ?? message
    } catch {
      /* not JSON */
    }
    throw new Error(message)
  }
  return res.status === 204 ? null : res.json()
}

// <audio> and <img> can't send headers, so media URLs carry the token.
const media = (path) => (path ? `${API_URL}${path}?token=${encodeURIComponent(token())}` : null)
const withMedia = (song) => ({ ...song, stream_url: media(song.stream_url), cover_url: media(song.cover_url) })
const withPlaylistMedia = (p) => ({
  ...p,
  covers: p.covers.map(media),
  ...(p.songs && { songs: p.songs.map(withMedia) }),
})

export const api = {
  // auth
  authConfig: () => request('/api/auth/config'),
  login: (username, password) => request('/api/auth/login', { method: 'POST', body: { username, password } }),
  signup: (username, password) => request('/api/auth/signup', { method: 'POST', body: { username, password } }),

  // downloads
  startDownload: (url) => request('/api/downloads', { method: 'POST', body: { url } }),
  listDownloads: () => request('/api/downloads'),
  clearDownloads: () => request('/api/downloads', { method: 'DELETE' }),

  // songs
  listSongs: () => request('/api/songs').then((list) => list.map(withMedia)),
  deleteSong: (id) => request(`/api/songs/${id}`, { method: 'DELETE' }),

  // playlists
  listPlaylists: () => request('/api/playlists').then((list) => list.map(withPlaylistMedia)),
  getPlaylist: (id) => request(`/api/playlists/${id}`).then(withPlaylistMedia),
  createPlaylist: (data) => request('/api/playlists', { method: 'POST', body: data }).then(withPlaylistMedia),
  updatePlaylist: (id, data) =>
    request(`/api/playlists/${id}`, { method: 'PATCH', body: data }).then(withPlaylistMedia),
  addToPlaylist: (id, songIds) =>
    request(`/api/playlists/${id}/songs`, { method: 'POST', body: { song_ids: songIds } }).then(withPlaylistMedia),
  removeFromPlaylist: (id, songId) =>
    request(`/api/playlists/${id}/songs/${songId}`, { method: 'DELETE' }).then(withPlaylistMedia),
  deletePlaylist: (id) => request(`/api/playlists/${id}`, { method: 'DELETE' }),
}

// ---------- formatting ----------

export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const s = Math.floor(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

export function formatTotal(seconds) {
  if (!seconds) return '0 min'
  const m = Math.max(1, Math.round(seconds / 60))
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)} hr ${m % 60} min`
}

export function matches(song, q) {
  const s = q.trim().toLowerCase()
  return !s || song.title.toLowerCase().includes(s) || (song.artist || '').toLowerCase().includes(s)
}
