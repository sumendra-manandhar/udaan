const paths = {
  back: <path d="M14 4 L7 11 L14 18" />,
  close: <path d="M5 5 L17 17 M17 5 L5 17" />,
  plus: <path d="M11 4v14M4 11h14" />,
  pin: (
    <>
      <path d="M11 20s7-6.2 7-11.5a7 7 0 0 0-14 0C4 13.8 11 20 11 20z" />
      <circle cx="11" cy="8.5" r="2.3" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4.5" width="16" height="14" rx="2" />
      <path d="M3 9h16M7.5 2.5v4M14.5 2.5v4" />
    </>
  ),
  logs: <path d="M2.5 16.5 L8 10 L12 13 L19.5 4.5" />,
  user: (
    <>
      <circle cx="11" cy="7.5" r="3.8" />
      <path d="M3.5 19.5c1.2-4.2 4.3-6.4 7.5-6.4s6.3 2.2 7.5 6.4" />
    </>
  ),
  shield: (
    <>
      <path d="M11 2.5 L18 5.5 V11 C18 15 15 18 11 19.5 C7 18 4 15 4 11 V5.5 Z" />
      <path d="M8 11 L10 13 L14 9" />
    </>
  ),
  check: <path d="M4 11.5 L9 16 L18 6" />,
  alert: <path d="M11 5v8M11 16.5v.5" />,
  upload: <path d="M11 15V4M6 9l5-5 5 5M3.5 17.5v2h15v-2" />,
  play: <path d="M6 3.5v15l12-7.5z" fill="currentColor" stroke="none" />,
  pause: <path d="M7 4v14M15 4v14" />,
  locate: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M11 1.5v4M11 16.5v4M1.5 11h4M16.5 11h4" />
    </>
  ),
  bookmark: <path d="M5.5 2.5h11v17l-5.5-3.8-5.5 3.8z" />,
  share: <path d="M11 3v11M6.5 7.5 11 3l4.5 4.5M4 13v5.5h14V13" />,
  sync: <path d="M18 8a7 7 0 0 0-12.5-2.5M4 14a7 7 0 0 0 12.5 2.5M5 2.5v3.5h3.5M17 19.5V16h-3.5" />,
  cloudOff: <path d="M3 3l16 16M7 7.5A5 5 0 0 0 6.5 17.5H16M10 5.2A5.5 5.5 0 0 1 16.4 9.6 4 4 0 0 1 18.8 15.8" />,
  settings: (
    <>
      <circle cx="11" cy="11" r="3" />
      <path d="M11 2v3M11 17v3M2 11h3M17 11h3M4.6 4.6l2.1 2.1M15.3 15.3l2.1 2.1M4.6 17.4l2.1-2.1M15.3 6.7l2.1-2.1" />
    </>
  ),
  send: <path d="M2.5 10.5 L19.5 3 L14 19.5 L10.5 12 Z M10.5 12 L19.5 3" />,
  download: <path d="M11 3v11M6.5 9.5 11 14l4.5-4.5M4 17.5v2h14v-2" />,
  trash: <path d="M4 6h14M8.5 6V3.5h5V6M6 6l1 13h8l1-13" />,
  camera: (
    <>
      <path d="M3 7.5h3.5L8 5h6l1.5 2.5H19v11H3z" />
      <circle cx="11" cy="12.5" r="3.2" />
    </>
  ),
  checkin: (
    <>
      <path d="M11 20s7-6.2 7-11.5a7 7 0 0 0-14 0C4 13.8 11 20 11 20z" />
      <path d="M8 8.8l2.2 2.2L14.2 7" />
    </>
  ),
  sun: (
    <>
      <circle cx="11" cy="11" r="4" />
      <path d="M11 1.5v2.5M11 18v2.5M1.5 11H4M18 11h2.5M4.3 4.3l1.8 1.8M15.9 15.9l1.8 1.8M4.3 17.7l1.8-1.8M15.9 6.1l1.8-1.8" />
    </>
  ),
  moon: <path d="M18.5 13.5A7.5 7.5 0 0 1 8.5 3.5a7.5 7.5 0 1 0 10 10z" />,
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 20, strokeWidth = 1.8 }: { name: IconName; size?: number; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 22 22"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="logo">
      <svg width={size} height={size} viewBox="0 0 30 30" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 21 L11 11 L16 16 L27 5" />
        <path d="M20 5 H27 V12" />
      </svg>
      udaan
    </span>
  );
}
