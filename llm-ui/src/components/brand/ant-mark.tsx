import { useId } from "react";

type Props = {
  size?: number;
  /** Render the antenna + leg strokes (full brand mark for dark panels). */
  withLegs?: boolean;
};

export function AntMark({ size = 24, withLegs = false }: Props) {
  const gid = useId();
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block" }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gid} x1="20" y1="8" x2="80" y2="92" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#F6A93B" />
          <stop offset="0.45" stopColor="#F08223" />
          <stop offset="1" stopColor="#DA4525" />
        </linearGradient>
      </defs>
      {withLegs && (
        <>
          <g fill="none" stroke="#C23A1E" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M44 45 L27 38 L20 30" />
            <path d="M43 52 L24 52 L16 54" />
            <path d="M44 59 L27 66 L21 74" />
            <path d="M56 45 L73 38 L80 30" />
            <path d="M57 52 L76 52 L84 54" />
            <path d="M56 59 L73 66 L79 74" />
          </g>
          <g fill="none" stroke="#C23A1E" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M45 20 L39 11 L33 7" />
            <path d="M55 20 L61 11 L67 7" />
          </g>
          <circle cx="32" cy="6" r="3.2" fill="#DA4525" />
          <circle cx="68" cy="6" r="3.2" fill="#DA4525" />
        </>
      )}
      <circle cx="50" cy="24" r="11" fill={`url(#${gid})`} />
      <ellipse cx="50" cy="45" rx="9" ry="11" fill={`url(#${gid})`} />
      <ellipse cx="50" cy="71" rx="13.5" ry="16" fill={`url(#${gid})`} />
      {withLegs && (
        <>
          <circle cx="45.5" cy="22" r="2.1" fill="#FFE6CC" opacity="0.9" />
          <circle cx="54.5" cy="22" r="2.1" fill="#FFE6CC" opacity="0.9" />
          <ellipse cx="46" cy="64" rx="3.4" ry="5" fill="#FACA71" opacity="0.55" />
        </>
      )}
    </svg>
  );
}
