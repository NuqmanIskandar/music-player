import { useEffect, useMemo, useState } from 'react'
import { formatTime, matches } from '../api'
import { Cover } from './Cover'
import { IconCheck, IconClose, IconSearch } from './Icons'

/**
 * Modal for creating or editing a playlist.
 * `initial` = { name, description, song_ids } ; `isNew` toggles the copy.
 */
export default function PlaylistEditor({ library, initial, isNew, onSave, onClose }) {
  const [name, setName] = useState(initial.name ?? '')
  const [description, setDescription] = useState(initial.description ?? '')
  const [selected, setSelected] = useState(initial.song_ids ?? [])
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onClose])

  const selectedSet = useMemo(() => new Set(selected), [selected])
  const visible = useMemo(() => library.filter((s) => matches(s, query)), [library, query])
  const allVisibleSelected = visible.length > 0 && visible.every((s) => selectedSet.has(s.id))

  const toggle = (id) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))

  const toggleAllVisible = () =>
    setSelected((cur) => {
      if (allVisibleSelected) {
        const hide = new Set(visible.map((s) => s.id))
        return cur.filter((id) => !hide.has(id))
      }
      return [...cur, ...visible.map((s) => s.id).filter((id) => !cur.includes(id))]
    })

  async function submit(e) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Give your playlist a name.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave({ name: name.trim(), description: description.trim(), song_ids: selected })
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal gradient-border" onSubmit={submit}>
        <div className="modal__head">
          <h2>{isNew ? 'New Playlist' : 'Edit Playlist'}</h2>
          <button type="button" className="icon-btn" onClick={onClose} title="Close">
            <IconClose size={18} />
          </button>
        </div>

        <div className="modal__fields">
          <input
            className="field field--title"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Playlist name"
            maxLength={100}
            autoFocus
          />
          <input
            className="field"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
          />
        </div>

        <div className="picker__bar">
          <div className="search search--full">
            <IconSearch size={16} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your library" />
          </div>
          <button type="button" className="link-btn" onClick={toggleAllVisible} disabled={!visible.length}>
            {allVisibleSelected ? 'Deselect all' : 'Select all'}
          </button>
        </div>

        <div className="picker">
          {library.length === 0 && (
            <p className="muted pad">Your library is empty. Add songs from YouTube first.</p>
          )}
          {library.length > 0 && visible.length === 0 && <p className="muted pad">No matches.</p>}
          {visible.map((s) => {
            const on = selectedSet.has(s.id)
            return (
              <button
                type="button"
                key={s.id}
                className={`picker__row ${on ? 'is-on' : ''}`}
                onClick={() => toggle(s.id)}
              >
                <span className={`check ${on ? 'is-on' : ''}`}>{on && <IconCheck size={12} />}</span>
                <Cover src={s.cover_url} size={36} radius={5} />
                <span className="picker__text truncate">
                  <span className="truncate">{s.title}</span>
                  <span className="muted small truncate">{s.artist || 'Unknown artist'}</span>
                </span>
                <span className="muted small tabular">{formatTime(s.duration)}</span>
              </button>
            )
          })}
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="modal__foot">
          <span className="muted small">
            {selected.length} {selected.length === 1 ? 'song' : 'songs'} selected
          </span>
          <div className="actions actions--tight">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn--primary" disabled={saving}>
              {saving ? 'Saving…' : isNew ? 'Create' : 'Save'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
