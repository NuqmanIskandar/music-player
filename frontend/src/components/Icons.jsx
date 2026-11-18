const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

const Svg = ({ size, children, ...rest }) => (
  <svg {...base} width={size ?? base.width} height={size ?? base.height} {...rest}>
    {children}
  </svg>
)

export const IconPlay = (p) => (
  <Svg {...p} fill="currentColor" stroke="none">
    <path d="M7 4.8v14.4a1 1 0 0 0 1.5.86l12-7.2a1 1 0 0 0 0-1.72l-12-7.2A1 1 0 0 0 7 4.8z" />
  </Svg>
)
export const IconPause = (p) => (
  <Svg {...p} fill="currentColor" stroke="none">
    <rect x="6" y="4" width="4.2" height="16" rx="1.2" />
    <rect x="13.8" y="4" width="4.2" height="16" rx="1.2" />
  </Svg>
)
export const IconNext = (p) => (
  <Svg {...p} fill="currentColor" stroke="none">
    <path d="M3 6.2v11.6a.8.8 0 0 0 1.2.7L12 13.4v4.4a.8.8 0 0 0 1.2.7l9.3-5.8a.8.8 0 0 0 0-1.4l-9.3-5.8a.8.8 0 0 0-1.2.7v4.4L4.2 5.5a.8.8 0 0 0-1.2.7z" />
  </Svg>
)
export const IconPrev = (p) => <IconNext {...p} style={{ transform: 'scaleX(-1)' }} />
export const IconShuffle = (p) => (
  <Svg {...p}>
    <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
  </Svg>
)
export const IconRepeat = (p) => (
  <Svg {...p}>
    <path d="m17 2 4 4-4 4" />
    <path d="M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4" />
    <path d="M21 13v1a4 4 0 0 1-4 4H3" />
  </Svg>
)
export const IconVolume = (p) => (
  <Svg {...p}>
    <path d="M11 5 6 9H2v6h4l5 4V5z" fill="currentColor" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
  </Svg>
)
export const IconMute = (p) => (
  <Svg {...p}>
    <path d="M11 5 6 9H2v6h4l5 4V5z" fill="currentColor" />
    <path d="m22 9-6 6M16 9l6 6" />
  </Svg>
)
export const IconMusic = (p) => (
  <Svg {...p}>
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </Svg>
)
export const IconList = (p) => (
  <Svg {...p}>
    <path d="M3 6h13M3 12h13M3 18h9M19 14v7M15.5 17.5h7" />
  </Svg>
)
export const IconDownload = (p) => (
  <Svg {...p}>
    <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
  </Svg>
)
export const IconPlus = (p) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
)
export const IconSearch = (p) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Svg>
)
export const IconMore = (p) => (
  <Svg {...p} fill="currentColor" stroke="none">
    <circle cx="5" cy="12" r="1.8" />
    <circle cx="12" cy="12" r="1.8" />
    <circle cx="19" cy="12" r="1.8" />
  </Svg>
)
export const IconTrash = (p) => (
  <Svg {...p}>
    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
  </Svg>
)
export const IconClose = (p) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
)
export const IconCheck = (p) => (
  <Svg {...p} strokeWidth={2.4}>
    <path d="m5 12 5 5 9-10" />
  </Svg>
)
export const IconBack = (p) => (
  <Svg {...p}>
    <path d="m15 18-6-6 6-6" />
  </Svg>
)
export const IconEdit = (p) => (
  <Svg {...p}>
    <path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" />
  </Svg>
)
export const IconGrip = (p) => (
  <Svg {...p} fill="currentColor" stroke="none">
    <circle cx="9" cy="6" r="1.6" />
    <circle cx="15" cy="6" r="1.6" />
    <circle cx="9" cy="12" r="1.6" />
    <circle cx="15" cy="12" r="1.6" />
    <circle cx="9" cy="18" r="1.6" />
    <circle cx="15" cy="18" r="1.6" />
  </Svg>
)
export const IconLogout = (p) => (
  <Svg {...p}>
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" />
  </Svg>
)
export const IconLink = (p) => (
  <Svg {...p}>
    <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
  </Svg>
)
