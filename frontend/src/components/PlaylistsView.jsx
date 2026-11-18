import { formatTotal } from '../api'
import { PlaylistArt } from './Cover'
import { IconPlus } from './Icons'

export default function PlaylistsView({ playlists, onOpen, onNew }) {
  return (
    <div className="page">
      <header className="page__header page__header--row">
        <div>
          <h1>Playlists</h1>
          <p className="muted">
            {playlists.length} {playlists.length === 1 ? 'playlist' : 'playlists'}
          </p>
        </div>
        <button className="btn btn--primary" onClick={onNew}>
          <IconPlus size={16} /> New Playlist
        </button>
      </header>

      <div className="grid">
        <button className="card card--new" onClick={onNew}>
          <div className="card__art card__art--new gradient-border">
            <IconPlus size={36} />
          </div>
          <div className="card__title">New Playlist</div>
          <div className="card__meta">Pick songs from your library</div>
        </button>
        {playlists.map((p) => (
          <button key={p.id} className="card" onClick={() => onOpen(p.id)}>
            <div className="card__art">
              <PlaylistArt covers={p.covers} size="100%" />
            </div>
            <div className="card__title truncate">{p.name}</div>
            <div className="card__meta">
              {p.song_count} {p.song_count === 1 ? 'song' : 'songs'}
              {p.duration > 0 && ` · ${formatTotal(p.duration)}`}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
