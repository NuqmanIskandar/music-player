import { formatTotal } from '../api'
import { PlaylistArt } from './Cover'
import { IconEdit, IconPlay, IconPlus, IconShuffle, IconTrash } from './Icons'
import SongList from './SongList'

export default function PlaylistDetail({ playlist, player, onEdit, onDelete, onRemoveSong, onReorder, listProps }) {
  if (!playlist) return <div className="page muted">Loading…</div>
  const songs = playlist.songs
  const from = `playlist:${playlist.id}`

  return (
    <div className="page">
      <header className="hero">
        <div className="hero__art">
          <PlaylistArt covers={playlist.covers} size={220} radius={14} />
        </div>
        <div className="hero__info">
          <span className="eyebrow">Playlist</span>
          <h1>{playlist.name}</h1>
          {playlist.description && <p className="hero__desc">{playlist.description}</p>}
          <p className="muted">
            {playlist.song_count} {playlist.song_count === 1 ? 'song' : 'songs'}
            {playlist.duration > 0 && ` · ${formatTotal(playlist.duration)}`}
          </p>
          <div className="actions">
            <button className="btn btn--primary" disabled={!songs.length} onClick={() => player.playList(songs, 0, false, from)}>
              <IconPlay size={14} /> Play
            </button>
            <button className="btn" disabled={!songs.length} onClick={() => player.playList(songs, 0, true, from)}>
              <IconShuffle size={16} /> Shuffle
            </button>
            <button className="btn" onClick={onEdit}>
              <IconEdit size={16} /> Edit
            </button>
            <button className="icon-btn icon-btn--danger" onClick={onDelete} title="Delete playlist">
              <IconTrash size={18} />
            </button>
          </div>
        </div>
      </header>

      {songs.length === 0 ? (
        <div className="empty gradient-border">
          <h3>This playlist is empty</h3>
          <p className="muted">Choose songs from your library to add them here.</p>
          <button className="btn btn--primary" onClick={onEdit}>
            <IconPlus size={16} /> Add Songs
          </button>
        </div>
      ) : (
        <SongList
          songs={songs}
          current={player.current}
          isPlaying={player.isPlaying}
          onPlay={(i) => player.playList(songs, i, false, from)}
          onTogglePlay={player.toggle}
          onRemove={onRemoveSong}
          onReorder={onReorder}
          {...listProps}
        />
      )}
    </div>
  )
}
