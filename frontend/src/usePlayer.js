import { useCallback, useEffect, useRef, useState } from 'react'

function shuffled(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// One shared <audio> element for the whole app.
const audio = new Audio()
audio.preload = 'auto'

const range = (n) => Array.from({ length: n }, (_, i) => i)

function readVolume() {
  try {
    const v = parseFloat(localStorage.getItem('volume'))
    return Number.isFinite(v) ? v : 0.8
  } catch {
    return 0.8
  }
}

export default function usePlayer() {
  const [queue, setQueue] = useState([])
  const [order, setOrder] = useState([]) // play order: indices into queue
  const [pos, setPos] = useState(0) // position within `order`
  const [loadKey, setLoadKey] = useState(0) // bump to (re)load + play the current track
  const [isPlaying, setIsPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(readVolume)
  const [muted, setMuted] = useState(false)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState('off') // off | all | one

  const current = queue[order[pos]] ?? null

  // Latest state for audio event handlers.
  const state = useRef({ queue: [], order: [], pos: 0, repeat: 'off', shuffle: false })
  useEffect(() => {
    state.current = { queue, order, pos, repeat, shuffle }
  })
  // Where the queue came from (e.g. "playlist:3"), so edits to that list can update it live.
  const source = useRef(null)

  // Stop the music when the player goes away (e.g. on sign-out).
  useEffect(
    () => () => {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    },
    [],
  )

  // Load + play whenever loadKey changes.
  useEffect(() => {
    if (!loadKey || !current) return
    audio.src = current.stream_url
    audio.play().catch(() => setIsPlaying(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadKey])

  useEffect(() => {
    audio.volume = volume
    audio.muted = muted
    try {
      localStorage.setItem('volume', String(volume))
    } catch {
      /* ignore */
    }
  }, [volume, muted])

  const goTo = useCallback((nextPos) => {
    setPos(nextPos)
    setTime(0)
    setLoadKey((k) => k + 1)
  }, [])

  const next = useCallback(
    (auto = false) => {
      const { order, pos, repeat } = state.current
      if (!order.length) return
      if (pos + 1 < order.length) goTo(pos + 1)
      else if (repeat === 'all' || !auto) goTo(0)
      else {
        audio.pause()
        audio.currentTime = 0
      }
    },
    [goTo],
  )

  const prev = useCallback(() => {
    const { order, pos } = state.current
    if (!order.length) return
    if (audio.currentTime > 3 || pos === 0) {
      audio.currentTime = 0
      return
    }
    goTo(pos - 1)
  }, [goTo])

  // Audio element events.
  useEffect(() => {
    const onTime = () => setTime(audio.currentTime)
    const onMeta = () => setDuration(audio.duration || 0)
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onEnded = () => {
      if (state.current.repeat === 'one') {
        audio.currentTime = 0
        audio.play()
      } else next(true)
    }
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
    }
  }, [next])

  const toggle = useCallback(() => {
    if (!audio.src) return
    if (audio.paused) audio.play()
    else audio.pause()
  }, [])

  /**
   * Play `songs` starting at index `start`. `forceShuffle` turns shuffle on.
   * `from` names the list (e.g. "playlist:3") so syncQueue can follow later edits to it.
   */
  const playList = useCallback(
    (songs, start = 0, forceShuffle = false, from = null) => {
      if (!songs.length) return
      source.current = from
      const useShuffle = forceShuffle || shuffle
      if (forceShuffle) setShuffle(true)
      const first = forceShuffle ? Math.floor(Math.random() * songs.length) : start
      setQueue(songs)
      setOrder(
        useShuffle ? [first, ...shuffled(range(songs.length).filter((i) => i !== first))] : range(songs.length),
      )
      goTo(useShuffle ? 0 : first)
    },
    [shuffle, goTo],
  )

  /**
   * The list `from` changed (reordered, songs added/removed). If it's what's playing,
   * update the upcoming order without interrupting the current song.
   */
  const syncQueue = useCallback((from, songs) => {
    const s = state.current
    if (!from || from !== source.current) return
    const cur = s.queue[s.order[s.pos]]
    if (!cur) return

    let list = songs
    let idx = list.findIndex((x) => x.id === cur.id)
    if (idx === -1) {
      // The playing song was removed from the list: let it finish, then carry on from its old spot.
      idx = Math.min(s.order[s.pos], list.length)
      list = [...list.slice(0, idx), cur, ...list.slice(idx)]
    }

    let newOrder
    if (s.shuffle) {
      // Keep the shuffled sequence; drop removed songs, shuffle newly added ones in after it.
      const newIndex = new Map(list.map((x, i) => [x.id, i]))
      const kept = s.order.map((i) => newIndex.get(s.queue[i].id)).filter((i) => i !== undefined)
      const seen = new Set(kept)
      newOrder = [...kept, ...shuffled(range(list.length).filter((i) => !seen.has(i)))]
    } else {
      newOrder = range(list.length)
    }
    const newPos = newOrder.indexOf(idx)

    setQueue(list)
    setOrder(newOrder)
    setPos(newPos)
    // Apply immediately for back-to-back calls before the next render.
    state.current = { ...s, queue: list, order: newOrder, pos: newPos }
  }, [])

  const toggleShuffle = useCallback(() => {
    const idx = order[pos]
    if (!shuffle) {
      if (queue.length) {
        setOrder([idx, ...shuffled(range(queue.length).filter((i) => i !== idx))])
        setPos(0)
      }
      setShuffle(true)
    } else {
      setOrder(range(queue.length))
      setPos(idx ?? 0)
      setShuffle(false)
    }
  }, [shuffle, order, pos, queue.length])

  const cycleRepeat = useCallback(
    () => setRepeat((r) => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off')),
    [],
  )

  const seek = useCallback(
    (t) => {
      audio.currentTime = t
      setTime(t)
    },
    [],
  )

  const setVolume = useCallback((v) => {
    setVolumeState(v)
    setMuted(false)
  }, [])

  const toggleMute = useCallback(() => setMuted((m) => !m), [])

  // Space bar toggles playback (unless typing).
  useEffect(() => {
    const onKey = (e) => {
      if (e.code !== 'Space') return
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON' || e.target.isContentEditable) return
      e.preventDefault()
      toggle()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle])

  // Hardware media keys / OS now-playing widget.
  useEffect(() => {
    if (!('mediaSession' in navigator) || !current) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.title,
      artist: current.artist || '',
      artwork: current.cover_url ? [{ src: current.cover_url, sizes: '512x512', type: 'image/jpeg' }] : [],
    })
    navigator.mediaSession.setActionHandler('play', () => audio.play())
    navigator.mediaSession.setActionHandler('pause', () => audio.pause())
    navigator.mediaSession.setActionHandler('nexttrack', () => next())
    navigator.mediaSession.setActionHandler('previoustrack', () => prev())
  }, [current, next, prev])

  // Keep the tab title in sync.
  useEffect(() => {
    document.title = current && isPlaying ? `${current.title} — Music` : 'Music'
  }, [current, isPlaying])

  return {
    current,
    isPlaying,
    time,
    duration,
    volume,
    muted,
    shuffle,
    repeat,
    playList,
    syncQueue,
    toggle,
    next: () => next(),
    prev,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
  }
}
