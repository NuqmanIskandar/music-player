import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useEffect, useRef, useState } from 'react'
import { formatTime } from '../api'
import { Cover } from './Cover'
import { IconGrip, IconMore, IconPause, IconPlay } from './Icons'

function RowMenu({ song, playlists, onAddToPlaylist, onNewPlaylistWith, onRemove, onDelete }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    const esc = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const run = (fn) => () => {
    setOpen(false)
    fn()
  }

  return (
    <div className="menu" ref={ref}>
      <button
        className="icon-btn row-more"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        title="More"
      >
        <IconMore size={18} />
      </button>
      {open && (
        <div className="menu__panel" onClick={(e) => e.stopPropagation()}>
          <div className="menu__label">Add to playlist</div>
          <button className="menu__item" onClick={run(() => onNewPlaylistWith(song))}>
            New playlist…
          </button>
          {playlists.map((p) => (
            <button key={p.id} className="menu__item" onClick={run(() => onAddToPlaylist(p.id, song))}>
              <span className="truncate">{p.name}</span>
            </button>
          ))}
          <div className="menu__sep" />
          {onRemove && (
            <button className="menu__item" onClick={run(() => onRemove(song))}>
              Remove from playlist
            </button>
          )}
          {onDelete && (
            <button className="menu__item menu__item--danger" onClick={run(() => onDelete(song))}>
              Delete from library
            </button>
          )}
          <a className="menu__item" href={song.source_url} target="_blank" rel="noreferrer">
            Open on YouTube
          </a>
        </div>
      )}
    </div>
  )
}

function SongRow({ song, index, active, isPlaying, onPlay, onTogglePlay, menuProps, sortable }) {
  return (
    <div
      ref={sortable?.setNodeRef}
      style={sortable?.style}
      role="row"
      className={`songrow ${active ? 'is-current' : ''} ${sortable?.isDragging ? 'is-dragging' : ''}`}
      onDoubleClick={() => onPlay(index)}
    >
      {sortable && (
        <button
          className="songrow__grip"
          title="Drag to reorder"
          aria-label={`Reorder ${song.title}`}
          {...sortable.attributes}
          {...sortable.listeners}
        >
          <IconGrip size={16} />
        </button>
      )}
      <span className="songrow__index">
        <span className="songrow__num">
          {active && isPlaying ? (
            <span className="eq">
              <i />
              <i />
              <i />
            </span>
          ) : (
            index + 1
          )}
        </span>
        <button
          className="songrow__play"
          onClick={() => (active ? onTogglePlay() : onPlay(index))}
          title={active && isPlaying ? 'Pause' : 'Play'}
        >
          {active && isPlaying ? <IconPause size={14} /> : <IconPlay size={14} />}
        </button>
      </span>
      <span className="songrow__title">
        <Cover src={song.cover_url} size={40} radius={6} />
        <span className="truncate">
          <span className="songrow__name truncate">{song.title}</span>
          <span className="songrow__artist-sm truncate">{song.artist || 'Unknown artist'}</span>
        </span>
      </span>
      <span className="muted truncate hide-sm">{song.artist || 'Unknown artist'}</span>
      <span className="muted hide-sm">
        {new Date(song.added_at.replace(' ', 'T') + 'Z').toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
      </span>
      <span className="muted right tabular">{formatTime(song.duration)}</span>
      <RowMenu song={song} {...menuProps} />
    </div>
  )
}

function SortableSongRow(props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.song.id,
  })
  const style = { transform: CSS.Translate.toString(transform), transition }
  return <SongRow {...props} sortable={{ attributes, listeners, setNodeRef, style, isDragging }} />
}

/**
 * Pass `onReorder(newSongs)` to enable drag-and-drop reordering (used by playlists).
 */
export default function SongList({ songs, current, isPlaying, onPlay, onTogglePlay, onReorder, ...menuProps }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    const from = songs.findIndex((s) => s.id === active.id)
    const to = songs.findIndex((s) => s.id === over.id)
    onReorder(arrayMove(songs, from, to))
  }

  const rowProps = (song, i) => ({
    song,
    index: i,
    active: current?.id === song.id,
    isPlaying,
    onPlay,
    onTogglePlay,
    menuProps,
  })

  const head = (
    <div className="songlist__head" role="row">
      {onReorder && <span />}
      <span>#</span>
      <span>Title</span>
      <span className="hide-sm">Artist</span>
      <span className="hide-sm">Added</span>
      <span className="right">Time</span>
      <span />
    </div>
  )

  if (!onReorder) {
    return (
      <div className="songlist" role="table">
        {head}
        {songs.map((song, i) => (
          <SongRow key={song.id} {...rowProps(song, i)} />
        ))}
      </div>
    )
  }

  return (
    <div className="songlist songlist--sortable" role="table">
      {head}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={songs.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="songlist__body">
            {songs.map((song, i) => (
              <SortableSongRow key={song.id} {...rowProps(song, i)} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
