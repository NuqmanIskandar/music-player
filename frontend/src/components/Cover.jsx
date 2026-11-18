import { useState } from 'react'
import { IconMusic } from './Icons'

/** Square artwork with a soft gradient fallback when there is no image. */
export function Cover({ src, size = 44, radius = 8, className = '' }) {
  const [failed, setFailed] = useState(false)
  const style = { width: size, height: size, borderRadius: radius }
  if (!src || failed) {
    return (
      <div className={`cover cover--empty ${className}`} style={style}>
        <IconMusic size={typeof size === 'number' ? Math.max(14, size * 0.38) : 48} />
      </div>
    )
  }
  return (
    <img
      className={`cover ${className}`}
      style={style}
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}

/** 2x2 mosaic of song covers for playlists (Apple Music style). */
export function PlaylistArt({ covers = [], size = 180, radius = 12 }) {
  if (covers.length < 4) return <Cover src={covers[0]} size={size} radius={radius} />
  return (
    <div className="mosaic" style={{ width: size, height: size, borderRadius: radius }}>
      {covers.slice(0, 4).map((c, i) => (
        <img key={i} src={c} alt="" loading="lazy" />
      ))}
    </div>
  )
}
