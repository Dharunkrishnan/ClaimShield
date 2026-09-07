import { useEffect, useId, useRef, useState } from 'react'

// A small animated bot face used in place of the plain lucide Bot icon
// wherever the assistant's identity is the main thing on screen (the
// floating chat bubble, the open panel's header). Too much detail to
// read at the tiny 13px size used for per-message avatars - those stay
// on the plain Bot icon (see ChatAssistant.tsx) - this is only used at
// 20px and up.
//
// The eyes track the cursor anywhere on the page - not just while
// hovering the icon itself - via a window-level mousemove listener,
// throttled to one update per animation frame. The offset is clamped
// to a small radius (see MAX_PUPIL_OFFSET) since this icon renders as
// small as 22px, where anything larger would look like the eyes
// popping out of the face rather than glancing toward the cursor.
const MAX_PUPIL_OFFSET = 1.6

export function BotMascotIcon({ size = 20 }: { size?: number }) {
  // Unique per instance - this component renders more than once on the
  // page (bubble + header), and two <radialGradient> elements sharing
  // one hardcoded id is invalid SVG.
  const glowId = useId()

  const svgRef = useRef<SVGSVGElement>(null)
  const [pupilOffset, setPupilOffset] = useState({ x: 0, y: 0 })

  useEffect(() => {
    let frameId: number | null = null

    const handleMouseMove = (event: MouseEvent) => {
      if (frameId !== null) return

      frameId = requestAnimationFrame(() => {
        frameId = null

        const svg = svgRef.current
        if (!svg) return

        const rect = svg.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2

        const dx = event.clientX - centerX
        const dy = event.clientY - centerY
        const angle = Math.atan2(dy, dx)
        const distance = Math.min(MAX_PUPIL_OFFSET, Math.hypot(dx, dy) / 12)

        setPupilOffset({
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance,
        })
      })
    }

    window.addEventListener('mousemove', handleMouseMove)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      if (frameId !== null) cancelAnimationFrame(frameId)
    }
  }, [])

  return (
    <svg ref={svgRef} width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.9" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect x="3" y="16" width="4" height="10" rx="2" fill="currentColor" opacity="0.55" />
      <rect x="33" y="16" width="4" height="10" rx="2" fill="currentColor" opacity="0.55" />

      <line x1="20" y1="4" x2="20" y2="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle className="bot-icon-antenna-glow" cx="20" cy="4" r="5" fill={`url(#${glowId})`} />
      <circle cx="20" cy="4" r="2.2" fill="currentColor" />

      <rect x="7" y="9" width="26" height="23" rx="11" fill="#ffffff" />
      <rect x="7" y="9" width="26" height="23" rx="11" fill="none" stroke="#1D4FA3" strokeOpacity="0.14" strokeWidth="1.5" />

      {/* Blink (scaleY, CSS-driven) lives on this outer group; the
          cursor-follow translate lives on the inner group below. Both
          need to be separate elements - an inline transform attribute
          set from JS on the SAME element as a CSS animation targeting
          `transform` gets replaced by the animation's own keyframe
          value on every frame, silently cancelling the JS offset out
          for most of the blink cycle. Nested groups compose their
          transforms instead of fighting over one. */}
      <g className="bot-icon-eyes">
        <g transform={`translate(${pupilOffset.x} ${pupilOffset.y})`}>
          <circle cx="16" cy="19" r="3.2" fill="#1D4FA3" />
          <circle cx="24" cy="19" r="3.2" fill="#1D4FA3" />
          <circle cx="15" cy="17.8" r="1" fill="#ffffff" />
          <circle cx="23" cy="17.8" r="1" fill="#ffffff" />
        </g>
      </g>

      <path d="M15 25 Q20 28.5 25 25" stroke="#1D4FA3" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  )
}