import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'
import AddMusic from './components/AddMusic'
import PlayerBar from './components/PlayerBar'
import PlaylistDetail from './components/PlaylistDetail'
import PlaylistEditor from './components/PlaylistEditor'
import PlaylistsView from './components/PlaylistsView'
import Sidebar from './components/Sidebar'
import SongsView from './components/SongsView'
import usePlayer from './usePlayer'

const ACTIVE = ['queued', 'downloading', 'converting']

export default function MusicApp({ user, onLogout }) {
  const player = usePlayer()
  const [view, setView] = useState({ name: 'songs' })
  const [songs, setSongs] = useState([])
  const [songsLoading, setSongsLoading] = useState(true)
  const [playlists, setPlaylists] = useState([])
  const [openPlaylist, setOpenPlaylist] = useState(null)
  const [downloads, setDownloads] = useState([])
  const [editor, setEditor] = useState(null) // { isNew, id?, initial }
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)

  const notify = useCallback((message, kind = 'info') => {
    clearTimeout(toastTimer.current)
    setToast({ message, kind })
    toastTimer.current = setTimeout(() => setToast(null), 2800)
  }, [])

  const loadSongs = useCallback(
    () =>
      api
        .listSongs()
        .then(setSongs)
        .catch((e) => notify(e.message, 'error'))
        .finally(() => setSongsLoading(false)),
    [notify],
  )

  const loadPlaylists = useCallback(() => api.listPlaylists().then(setPlaylists).catch(() => {}), [])

  // A playlist's songs changed: if the player is playing it, update the upcoming order live.
  const { syncQueue } = player
  const playlistChanged = useCallback((p) => syncQueue(`playlist:${p.id}`, p.songs), [syncQueue])

  const openId = view.name === 'playlist' ? view.id : null
  const loadOpenPlaylist = useCallback(() => {
    if (openId == null) return Promise.resolve()
    return api
      .getPlaylist(openId)
      .then((p) => {
        setOpenPlaylist(p)
        playlistChanged(p)
      })
      .catch(() => setView({ name: 'playlists' }))
  }, [openId, playlistChanged])

  const refreshAll = useCallback(
    () => Promise.all([loadSongs(), loadPlaylists(), loadOpenPlaylist()]),
    [loadSongs, loadPlaylists, loadOpenPlaylist],
  )

  // Initial load.
  useEffect(() => {
    loadSongs()
    loadPlaylists()
    api.listDownloads().then(setDownloads).catch(() => {})
  }, [loadSongs, loadPlaylists])

  // Load the playlist being viewed.
  useEffect(() => {
    loadOpenPlaylist()
  }, [loadOpenPlaylist])

  // Poll download progress while anything is in flight.
  const hasActive = downloads.some((d) => ACTIVE.includes(d.status))
  const doneCount = useRef(0)
  useEffect(() => {
    if (!hasActive) return
    const t = setInterval(async () => {
      try {
        const list = await api.listDownloads()
        setDownloads(list)
        const done = list.filter((d) => d.status === 'done').length
        if (done !== doneCount.current) {
          doneCount.current = done
          loadSongs()
        }
      } catch {
        /* backend hiccup; keep polling */
      }
    }, 1200)
    return () => clearInterval(t)
  }, [hasActive, loadSongs])

  // ---- actions ----

  const navigate = (v) => {
    if (v.name !== 'playlist' || v.id !== openId) setOpenPlaylist(null)
    setView(v)
  }

  const startedDownload = () => api.listDownloads().then(setDownloads)

  const clearDownloads = async () => {
    await api.clearDownloads()
    setDownloads(await api.listDownloads())
    doneCount.current = 0
  }

  const addToPlaylist = async (playlistId, song) => {
    try {
      const p = await api.addToPlaylist(playlistId, [song.id])
      notify(`Added to “${p.name}”`)
      loadPlaylists()
      playlistChanged(p)
      if (openId === playlistId) setOpenPlaylist(p)
    } catch (e) {
      notify(e.message, 'error')
    }
  }

  const removeFromPlaylist = async (song) => {
    const p = await api.removeFromPlaylist(openId, song.id)
    setOpenPlaylist(p)
    playlistChanged(p)
    loadPlaylists()
  }

  const reorderPlaylist = async (newSongs) => {
    const previous = openPlaylist
    // Optimistic: show the new order immediately, then persist it.
    setOpenPlaylist({ ...openPlaylist, songs: newSongs })
    playlistChanged({ ...openPlaylist, songs: newSongs })
    try {
      const p = await api.updatePlaylist(openPlaylist.id, { song_ids: newSongs.map((s) => s.id) })
      setOpenPlaylist(p)
      loadPlaylists() // cover mosaic follows the first 4 songs
    } catch (e) {
      setOpenPlaylist(previous)
      playlistChanged(previous)
      notify(`Couldn't save the new order: ${e.message}`, 'error')
    }
  }

  const deleteSong = async (song) => {
    if (!confirm(`Remove “${song.title}” from your library? It will also leave your playlists.`)) return
    await api.deleteSong(song.id)
    notify('Song removed')
    refreshAll()
  }

  const deletePlaylist = async () => {
    if (!confirm(`Delete the playlist “${openPlaylist.name}”? Songs stay in your library.`)) return
    await api.deletePlaylist(openPlaylist.id)
    notify('Playlist deleted')
    loadPlaylists()
    navigate({ name: 'playlists' })
  }

  const openNewPlaylist = (songIds = []) =>
    setEditor({ isNew: true, initial: { name: '', description: '', song_ids: songIds } })

  const openEditPlaylist = () =>
    setEditor({
      isNew: false,
      id: openPlaylist.id,
      initial: {
        name: openPlaylist.name,
        description: openPlaylist.description,
        song_ids: openPlaylist.songs.map((s) => s.id),
      },
    })

  const saveEditor = async (data) => {
    if (editor.isNew) {
      const p = await api.createPlaylist(data)
      notify(`Created “${p.name}”`)
      setEditor(null)
      await loadPlaylists()
      navigate({ name: 'playlist', id: p.id })
    } else {
      const p = await api.updatePlaylist(editor.id, data)
      setOpenPlaylist(p)
      playlistChanged(p)
      setEditor(null)
      notify('Playlist saved')
      loadPlaylists()
    }
  }

  const listProps = {
    playlists,
    onAddToPlaylist: addToPlaylist,
    onNewPlaylistWith: (song) => openNewPlaylist([song.id]),
  }

  return (
    <div className="app">
      <div className="topline" />
      <Sidebar
        view={view}
        onNavigate={navigate}
        playlists={playlists}
        onNewPlaylist={() => openNewPlaylist()}
        user={user}
        onLogout={onLogout}
        activeDownloads={downloads.filter((d) => ACTIVE.includes(d.status)).length}
      />

      <main className="main">
        {view.name === 'songs' && (
          <SongsView
            songs={songs}
            loading={songsLoading}
            player={player}
            onGoAdd={() => navigate({ name: 'add' })}
            listProps={{ ...listProps, onDelete: deleteSong }}
          />
        )}
        {view.name === 'playlists' && (
          <PlaylistsView
            playlists={playlists}
            onOpen={(id) => navigate({ name: 'playlist', id })}
            onNew={() => openNewPlaylist()}
          />
        )}
        {view.name === 'playlist' && (
          <PlaylistDetail
            playlist={openPlaylist}
            player={player}
            onEdit={openEditPlaylist}
            onDelete={deletePlaylist}
            onRemoveSong={removeFromPlaylist}
            onReorder={reorderPlaylist}
            listProps={listProps}
          />
        )}
        {view.name === 'add' && (
          <AddMusic downloads={downloads} onStarted={startedDownload} onClear={clearDownloads} />
        )}
      </main>

      <PlayerBar player={player} />

      {editor && (
        <PlaylistEditor
          library={songs}
          initial={editor.initial}
          isNew={editor.isNew}
          onSave={saveEditor}
          onClose={() => setEditor(null)}
        />
      )}

      {toast && <div className={`toast toast--${toast.kind}`}>{toast.message}</div>}
    </div>
  )
}
