import { useMemo, useState } from 'react'
import { formatTotal, matches } from '../api'
import { IconDownload, IconPlay, IconSearch, IconShuffle } from './Icons'
import SongList from './SongList'

export default function SongsView({ songs, loading, player, onGoAdd, listProps }) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => songs.filter((s) => matches(s, query)), [songs, query])
  const total = songs.reduce((t, s) => t + (s.duration || 0), 0)

  return (
    <div className="page">
      <header className="page__header page__header--row">
        <div>
          <h1>Songs</h1>
          <p className="muted">
            {songs.length} {songs.length === 1 ? 'song' : 'songs'} · {formatTotal(total)}
          </p>
        </div>
        <div className="search">
          <IconSearch size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search library" />
        </div>
      </header>

      {!loading && songs.length === 0 ? (
        <div className="empty gradient-border">
          <h3>Your library is empty</h3>
          <p className="muted">Add your first song by pasting a YouTube link.</p>
          <button className="btn btn--primary" onClick={onGoAdd}>
            <IconDownload size={16} /> Add Music
          </button>
        </div>
      ) : (
        <>
          <div className="actions">
            <button className="btn btn--primary" disabled={!filtered.length} onClick={() => player.playList(filtered, 0)}>
              <IconPlay size={14} /> Play
            </button>
            <button className="btn" disabled={!filtered.length} onClick={() => player.playList(filtered, 0, true)}>
              <IconShuffle size={16} /> Shuffle
            </button>
          </div>
          {filtered.length === 0 ? (
            <p className="muted pad">No songs match “{query}”.</p>
          ) : (
            <SongList
              songs={filtered}
              current={player.current}
              isPlaying={player.isPlaying}
              onPlay={(i) => player.playList(filtered, i)}
              onTogglePlay={player.toggle}
              {...listProps}
            />
          )}
        </>
      )}
    </div>
  )
}
