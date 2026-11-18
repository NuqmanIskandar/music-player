import { useState } from 'react'
import { api } from '../api'
import { IconCheck, IconClose, IconLink } from './Icons'

const STATUS_LABEL = {
  queued: 'Queued',
  downloading: 'Downloading',
  converting: 'Converting to MP3',
  done: 'Added to library',
  error: 'Failed',
}

export default function AddMusic({ downloads, onStarted, onClear }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!url.trim()) return
    setBusy(true)
    setError('')
    try {
      await api.startDownload(url.trim())
      setUrl('')
      onStarted()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const hasFinished = downloads.some((d) => d.status === 'done' || d.status === 'error')

  return (
    <div className="page">
      <header className="page__header">
        <h1>Add Music</h1>
        <p className="muted">Paste a YouTube link. It will be downloaded as an MP3 and saved to your library.</p>
      </header>

      <form className="url-form gradient-border" onSubmit={submit}>
        <IconLink size={18} className="muted" />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=…"
          autoFocus
          spellCheck={false}
        />
        <button className="btn btn--primary" disabled={busy || !url.trim()}>
          {busy ? 'Adding…' : 'Add'}
        </button>
      </form>
      {error && <p className="form-error">{error}</p>}

      {downloads.length > 0 && (
        <section className="downloads">
          <div className="section-title">
            <h2>Downloads</h2>
            {hasFinished && (
              <button className="link-btn" onClick={onClear}>
                Clear finished
              </button>
            )}
          </div>
          <ul>
            {[...downloads].reverse().map((d) => (
              <li key={d.id} className={`download download--${d.status}`}>
                <div className="download__icon">
                  {d.status === 'done' ? (
                    <IconCheck size={16} />
                  ) : d.status === 'error' ? (
                    <IconClose size={16} />
                  ) : (
                    <span className="spinner" />
                  )}
                </div>
                <div className="download__body">
                  <div className="download__title truncate">{d.title || d.url}</div>
                  <div className="download__meta">
                    {d.status === 'error' ? d.error : d.status === 'done' ? d.message : STATUS_LABEL[d.status]}
                    {d.status === 'downloading' && ` · ${Math.round(d.progress)}%`}
                  </div>
                  {(d.status === 'downloading' || d.status === 'converting' || d.status === 'queued') && (
                    <div className="bar">
                      <div
                        className={`bar__fill ${d.status !== 'downloading' ? 'bar__fill--indeterminate' : ''}`}
                        style={{ width: d.status === 'downloading' ? `${d.progress}%` : undefined }}
                      />
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
