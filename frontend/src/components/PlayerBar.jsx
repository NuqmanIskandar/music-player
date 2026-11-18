import { formatTime } from '../api'
import { Cover } from './Cover'
import {
  IconMute,
  IconNext,
  IconPause,
  IconPlay,
  IconPrev,
  IconRepeat,
  IconShuffle,
  IconVolume,
} from './Icons'

function Slider({ value, max, onChange, className = '', label }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <input
      type="range"
      className={`slider ${className}`}
      min={0}
      max={max || 0}
      step="any"
      value={Math.min(value, max || 0)}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ '--pct': `${pct}%` }}
      aria-label={label}
    />
  )
}

export default function PlayerBar({ player }) {
  const { current, isPlaying, time, duration, volume, muted, shuffle, repeat } = player
  const disabled = !current

  return (
    <footer className={`player ${disabled ? 'is-idle' : ''}`}>
      <div className="player__track">
        <Cover src={current?.cover_url} size={52} radius={8} />
        <div className="player__meta truncate">
          <div className="player__title truncate">{current?.title ?? 'Not playing'}</div>
          <div className="player__artist truncate">{current ? current.artist || 'Unknown artist' : 'Pick a song to start'}</div>
        </div>
      </div>

      <div className="player__center">
        <div className="player__controls">
          <button
            className={`icon-btn toggle ${shuffle ? 'is-on' : ''}`}
            onClick={player.toggleShuffle}
            title="Shuffle"
          >
            <IconShuffle size={17} />
          </button>
          <button className="icon-btn" onClick={player.prev} disabled={disabled} title="Previous">
            <IconPrev size={20} />
          </button>
          <button className="play-btn" onClick={player.toggle} disabled={disabled} title={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? <IconPause size={20} /> : <IconPlay size={20} />}
          </button>
          <button className="icon-btn" onClick={player.next} disabled={disabled} title="Next">
            <IconNext size={20} />
          </button>
          <button
            className={`icon-btn toggle ${repeat !== 'off' ? 'is-on' : ''}`}
            onClick={player.cycleRepeat}
            title={`Repeat: ${repeat}`}
          >
            <IconRepeat size={17} />
            {repeat === 'one' && <span className="toggle__one">1</span>}
          </button>
        </div>
        <div className="player__progress">
          <span className="tabular small muted">{formatTime(time)}</span>
          <Slider value={time} max={duration} onChange={player.seek} label="Seek" />
          <span className="tabular small muted">-{formatTime(Math.max(0, duration - time))}</span>
        </div>
      </div>

      <div className="player__volume">
        <button className="icon-btn" onClick={player.toggleMute} title={muted ? 'Unmute' : 'Mute'}>
          {muted || volume === 0 ? <IconMute size={18} /> : <IconVolume size={18} />}
        </button>
        <Slider value={muted ? 0 : volume} max={1} onChange={player.setVolume} className="slider--sm" label="Volume" />
      </div>
    </footer>
  )
}
