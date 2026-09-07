export interface SparklinePoint {
  label: string
  value: number
}

const WIDTH = 300
const HEIGHT = 80
// Horizontal padding is 0 so the line's first/last points land exactly
// at x=0 and x=WIDTH - matching the footer's date labels below, which
// use justify-content: space-between and sit flush against the true
// left/right edges with no inset of their own. A non-zero value here
// previously made the chart line end visibly short of where the "last
// date" label sat. Vertical padding is kept so peaks/troughs don't
// touch the very top/bottom of the chart.
const PADDING_X = 0
const PADDING_Y = 4

export function Sparkline({ points }: { points: SparklinePoint[] }) {
  const max = Math.max(1, ...points.map((p) => p.value))
  const stepX = points.length > 1 ? (WIDTH - PADDING_X * 2) / (points.length - 1) : 0

  const coords = points.map((p, i) => {
    const x = PADDING_X + i * stepX
    const y = HEIGHT - PADDING_Y - (p.value / max) * (HEIGHT - PADDING_Y * 2)
    return { x, y, ...p }
  })

  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x},${c.y}`).join(' ')
  const areaPath =
    coords.length > 0
      ? `${linePath} L${coords[coords.length - 1].x},${HEIGHT - PADDING_Y} L${coords[0].x},${HEIGHT - PADDING_Y} Z`
      : ''

  const total = points.reduce((sum, p) => sum + p.value, 0)
  const first = points[0]?.label
  const last = points[points.length - 1]?.label

  return (
    <div className="sparkline">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="sparkline-svg" preserveAspectRatio="none">
        {areaPath && <path d={areaPath} fill="var(--color-primary)" opacity="0.12" />}
        {linePath && (
          <path d={linePath} fill="none" stroke="var(--color-primary)" strokeWidth="2" />
        )}
      </svg>
      <div className="sparkline-footer">
        <span>{first}</span>
        <span>{total} claims in range</span>
        <span>{last}</span>
      </div>
    </div>
  )
}