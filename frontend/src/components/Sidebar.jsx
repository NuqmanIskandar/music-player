import { IconDownload, IconList, IconLogout, IconMusic, IconPlus } from './Icons'

const NAV = [
  { id: 'songs', label: 'Songs', icon: IconMusic },
  { id: 'playlists', label: 'Playlists', icon: IconList },
  { id: 'add', label: 'Add Music', icon: IconDownload },
]

export default function Sidebar({ view, onNavigate, playlists, onNewPlaylist, activeDownloads, user, onLogout }) {
  const isActive = (id) => view.name === id

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand__logo">
          <IconMusic size={16} />
        </span>
        <span className="brand__name">Music</span>
      </div>

      <div className="sidebar__section">Library</div>
      <nav className="nav">
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`nav__item ${isActive(id) ? 'is-active' : ''}`}
            onClick={() => onNavigate({ name: id })}
          >
            <Icon size={18} />
            <span>{label}</span>
            {id === 'add' && activeDownloads > 0 && <span className="badge">{activeDownloads}</span>}
          </button>
        ))}
      </nav>

      <div className="sidebar__section sidebar__section--row">
        <span>Playlists</span>
        <button className="icon-btn icon-btn--sm" onClick={onNewPlaylist} title="New playlist">
          <IconPlus size={16} />
        </button>
      </div>
      <nav className="nav nav--playlists">
        {playlists.length === 0 && <p className="sidebar__empty">No playlists yet</p>}
        {playlists.map((p) => (
          <button
            key={p.id}
            className={`nav__item ${view.name === 'playlist' && view.id === p.id ? 'is-active' : ''}`}
            onClick={() => onNavigate({ name: 'playlist', id: p.id })}
          >
            <IconList size={16} />
            <span className="truncate">{p.name}</span>
          </button>
        ))}
      </nav>

      <div className="account">
        <span className="account__avatar">{user.username.slice(0, 1).toUpperCase()}</span>
        <span className="account__name truncate">{user.username}</span>
        <button className="icon-btn icon-btn--sm" onClick={onLogout} title="Sign out">
          <IconLogout size={16} />
        </button>
      </div>
    </aside>
  )
}
