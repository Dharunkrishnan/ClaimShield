// ClaimShield+ logo, built as SVG rather than a raster image so it's
// crisp at any size and automatically follows the active color theme
// (it reads var(--color-primary)/var(--color-primary-dark), which
// already flip between the orange and green/blue palettes) instead
// of needing two separate exported PNGs.

export function ClaimShieldLogo({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="claimshield-logo-bg" x1="0" y1="0" x2="100" y2="100">
          <stop offset="0%" stopColor="var(--color-primary-light)" />
          <stop offset="100%" stopColor="var(--color-primary-dark)" />
        </linearGradient>
      </defs>

      <rect x="2" y="2" width="96" height="96" rx="24" fill="url(#claimshield-logo-bg)" />

      <path
        d="M50 16 L73 25 V48 C73 65 63 77 50 84 C37 77 27 65 27 48 V25 Z"
        stroke="#ffffff"
        strokeWidth="6"
        strokeLinejoin="round"
      />

      <path
        d="M39 49 L47 57 L63 39"
        stroke="#ffffff"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <g>
        <rect x="69" y="55" width="11" height="29" rx="4.5" fill="#ffffff" />
        <rect x="60" y="64" width="29" height="11" rx="4.5" fill="#ffffff" />
      </g>
    </svg>
  )
}