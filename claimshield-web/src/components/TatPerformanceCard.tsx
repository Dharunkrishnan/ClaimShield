import { useEffect, useState } from 'react'
import { Clock3, Info } from 'lucide-react'
import { getTatPerformance } from '../lib/api'
import type { TatCategoryResultDto } from '../lib/types'

export type TatPerformanceRow = {
    label: string
    subLabel?: string
    actualTat: number
    sla: number
    withinTat: number
    outsideTat: number
}

type TatPerformanceCardProps = {
    // Optional override, mainly for testing/storybook-style use - the
    // real dashboard usage below fetches live data itself and doesn't
    // pass this.
    data?: TatPerformanceRow[]
}

// Splits a backend category string like "Settlement 1 (vs Last Doc
// Date)" into a label/subLabel pair for the two-line chart labels;
// categories with no parenthetical suffix (Survey TAT, Repair
// Approval) just get a plain label.
function splitCategoryLabel(category: string): { label: string; subLabel?: string } {
    const match = category.match(/^(.*?)\s*(\(.*\))$/)
    if (!match) return { label: category }
    return { label: match[1], subLabel: match[2] }
}

function mapToRows(categories: TatCategoryResultDto[]): TatPerformanceRow[] {
    return categories.map((cat) => ({
        ...splitCategoryLabel(cat.category),
        actualTat: cat.averageTatDays ?? 0,
        sla: cat.slaDays,
        withinTat: cat.withinTatCount,
        outsideTat: cat.outsideTatCount,
    }))
}

function formatDays(value: number) {
    return Number.isInteger(value) ? `${value}d` : `${value.toFixed(1)}d`
}

function getPercent(value: number, total: number) {
    if (total <= 0) return 0
    return (value / total) * 100
}

export function TatPerformanceCard({ data: dataOverride }: TatPerformanceCardProps) {
    const [fetchedRows, setFetchedRows] = useState<TatPerformanceRow[] | null>(null)
    const [loaded, setLoaded] = useState(dataOverride != null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (dataOverride != null) return

        let cancelled = false

        getTatPerformance()
            .then((result) => {
                if (!cancelled) setFetchedRows(mapToRows(result.categories))
            })
            .catch((err) => {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Failed to load TAT performance.')
                }
            })
            .finally(() => {
                if (!cancelled) setLoaded(true)
            })

        return () => {
            cancelled = true
        }
    }, [dataOverride])

    if (!loaded) {
        return null
    }

    const data = dataOverride ?? fetchedRows ?? []

    const maxTat = Math.max(
        ...data.flatMap((item) => [item.actualTat, item.sla]),
        1,
    )

    const totalWithin = data.reduce(
        (sum, item) => sum + Math.max(0, item.withinTat),
        0,
    )

    const totalOutside = data.reduce(
        (sum, item) => sum + Math.max(0, item.outsideTat),
        0,
    )

    const totalPaidClaims = totalWithin + totalOutside

    const withinPercent = getPercent(totalWithin, totalPaidClaims)
    const outsidePercent = getPercent(totalOutside, totalPaidClaims)

    return (
        <article className="csd-card csd-tat-card">
            <div className="csd-section-header">
                <div className="csd-section-heading">
                    <span className="csd-section-icon">
                        <Clock3 size={17} />
                    </span>

                    <div>
                        <h2>TAT Performance</h2>
                        <p>Paid Claims</p>
                    </div>
                </div>
            </div>

            {error && <p className="error-text" style={{ marginTop: '10px' }}>{error}</p>}

            {!error && data.length === 0 && (
                <p style={{ fontSize: '10px', color: '#98a2b3', marginTop: '12px' }}>
                    No paid claims this month yet.
                </p>
            )}

            {!error && data.length > 0 && (
                <div className="csd-tat-layout">
                    {/* =========================================================
            1. AVERAGE TAT VS SLA - VERTICAL BAR GRAPH
           ========================================================= */}
                    <section className="csd-tat-panel">
                        <div className="csd-tat-panel-header">
                            <div>
                                <h3>1. Average TAT vs SLA</h3>

                            </div>

                            <div className="csd-tat-legend">
                                <span>
                                    <i className="csd-tat-dot csd-tat-dot-actual" />
                                    Average TAT
                                </span>

                                <span>
                                    <i className="csd-tat-dot csd-tat-dot-sla" />
                                    SLA
                                </span>
                            </div>
                        </div>

                        <div className="csd-tat-bar-chart">
                            <div className="csd-tat-y-axis">
                                <span>{Math.ceil(maxTat)}d</span>
                                <span>{Math.ceil(maxTat * 0.75)}d</span>
                                <span>{Math.ceil(maxTat * 0.5)}d</span>
                                <span>{Math.ceil(maxTat * 0.25)}d</span>
                                <span>0</span>
                            </div>

                            <div className="csd-tat-plot">
                                <div className="csd-tat-grid">
                                    <span />
                                    <span />
                                    <span />
                                    <span />
                                    <span />
                                </div>

                                <div className="csd-tat-groups">
                                    {data.map((item) => {
                                        const actualHeight = Math.max(
                                            (item.actualTat / maxTat) * 100,
                                            item.actualTat > 0 ? 2 : 0,
                                        )

                                        const slaHeight = Math.max(
                                            (item.sla / maxTat) * 100,
                                            item.sla > 0 ? 2 : 0,
                                        )

                                        return (
                                            <div className="csd-tat-group" key={`${item.label}-${item.subLabel ?? ''}`}>
                                                <div className="csd-tat-bars">
                                                    <div className="csd-tat-single-bar">
                                                        <strong>{formatDays(item.actualTat)}</strong>
                                                        <div
                                                            className="csd-tat-bar csd-tat-bar-actual"
                                                            style={{ height: `${actualHeight}%` }}
                                                            title={`Average TAT: ${formatDays(item.actualTat)}`}
                                                        />
                                                    </div>

                                                    <div className="csd-tat-single-bar">
                                                        <strong className="csd-tat-sla-value">
                                                            {formatDays(item.sla)}
                                                        </strong>
                                                        <div
                                                            className="csd-tat-bar csd-tat-bar-sla"
                                                            style={{ height: `${slaHeight}%` }}
                                                            title={`SLA: ${formatDays(item.sla)}`}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="csd-tat-x-label">
                                                    <span>{item.label}</span>
                                                    {item.subLabel && <small>{item.subLabel}</small>}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* =========================================================
            2. WITHIN TAT VS OUTSIDE TAT - VERTICAL BAR GRAPH
           ========================================================= */}
                    <section className="csd-tat-panel csd-tat-comparison-panel">
                        <div className="csd-tat-panel-header">
                            <div>
                                <h3>2. Within TAT vs Outside TAT</h3>
                                <p>Paid claims by TAT compliance</p>
                            </div>
                            <Info size={15} className="csd-tat-info" />
                        </div>

                        <div className="csd-tat-comparison-chart">
                            <div className="csd-tat-comparison-total">
                                <strong>{totalPaidClaims}</strong>
                                <span>Paid Claims</span>
                            </div>

                            <div
                                className="csd-tat-comparison-plot"
                                aria-label={`Within TAT ${withinPercent.toFixed(0)} percent, Outside TAT ${outsidePercent.toFixed(0)} percent`}
                            >
                                <div className="csd-tat-comparison-y-axis">
                                    <span>100%</span>
                                    <span>75%</span>
                                    <span>50%</span>
                                    <span>25%</span>
                                    <span>0%</span>
                                </div>

                                <div className="csd-tat-comparison-grid">
                                    <span /><span /><span /><span /><span />
                                </div>

                                <div className="csd-tat-comparison-bars">
                                    <div className="csd-tat-comparison-bar-item">
                                        <div className="csd-tat-comparison-value">{totalWithin}</div>
                                        <div className="csd-tat-comparison-track">
                                            <div
                                                className="csd-tat-comparison-fill csd-tat-comparison-fill-within"
                                                style={{ height: `${withinPercent}%` }}
                                                title={`Within TAT: ${totalWithin} claims (${withinPercent.toFixed(0)}%)`}
                                            />
                                        </div>
                                        <strong>Within TAT</strong>
                                        <small>{withinPercent.toFixed(0)}%</small>
                                    </div>

                                    <div className="csd-tat-comparison-bar-item">
                                        <div className="csd-tat-comparison-value">{totalOutside}</div>
                                        <div className="csd-tat-comparison-track">
                                            <div
                                                className="csd-tat-comparison-fill csd-tat-comparison-fill-outside"
                                                style={{ height: `${outsidePercent}%` }}
                                                title={`Outside TAT: ${totalOutside} claims (${outsidePercent.toFixed(0)}%)`}
                                            />
                                        </div>
                                        <strong>Outside TAT</strong>
                                        <small>{outsidePercent.toFixed(0)}%</small>
                                    </div>
                                </div>
                            </div>

                            <div className="csd-tat-comparison-note-row">
                                <span><i className="csd-tat-dot csd-tat-dot-actual" />Within TAT = Actual TAT ≤ SLA</span>
                                <span><i className="csd-tat-dot csd-tat-dot-outside" />Outside TAT = Actual TAT &gt; SLA</span>
                            </div>
                        </div>
                    </section>
                </div>
            )}



            <style>{`
        .csd-tat-card {
          width: 100%;
          min-width: 0;
          overflow: hidden;
          grid-column: 1 / -1;
          min-height: auto;
        }

        .csd-tat-layout {
          display: grid;
          grid-template-columns: minmax(0, 1.35fr) minmax(300px, 0.65fr);
          gap: 14px;
          margin-top: 13px;
        }

        .csd-tat-panel {
          min-width: 0;
          padding: 13px;
          border: 1px solid var(--color-border, #D9E1EA);
          border-radius: 12px;
          background: var(--color-surface, #FFFFFF);
        }

        .csd-tat-panel-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 10px;
        }

        .csd-tat-panel-header h3 {
          margin: 0;
          color: var(--color-text, #172B4D);
          font-size: 12px;
          font-weight: 800;
        }

        .csd-tat-panel-header p {
          margin: 3px 0 0;
          color: var(--color-muted, #667085);
          font-size: 9px;
        }

        .csd-tat-legend {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .csd-tat-legend span {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          color: var(--color-muted, #667085);
          font-size: 8px;
          font-weight: 700;
          white-space: nowrap;
        }

        .csd-tat-dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          flex: 0 0 8px;
          border-radius: 3px;
        }

        .csd-tat-dot-actual {
          background: var(--color-primary, #2563C7);
        }

        .csd-tat-dot-sla {
          background: var(--color-success, #16834B);
        }

        .csd-tat-dot-outside {
          background: var(--color-error, #D64545);
        }

        .csd-tat-info {
          flex: 0 0 auto;
          color: var(--color-muted, #667085);
        }

        /* Vertical bar graph */

        .csd-tat-bar-chart {
          display: flex;
          height: 285px;
          min-width: 0;
        }

        .csd-tat-y-axis {
          width: 34px;
          flex: 0 0 34px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 2px 6px 30px 0;
          text-align: right;
        }

        .csd-tat-y-axis span {
          color: var(--color-muted, #667085);
          font-size: 8px;
          font-weight: 700;
        }

        .csd-tat-plot {
          position: relative;
          flex: 1;
          min-width: 0;
          height: 100%;
          border-bottom: 1px solid var(--color-border, #D9E1EA);
        }

        .csd-tat-grid {
          position: absolute;
          inset: 0 0 30px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          pointer-events: none;
        }

        .csd-tat-grid span {
          width: 100%;
          border-top: 1px dashed var(--color-divider, #E7EBF0);
        }

        .csd-tat-groups {
          position: absolute;
          inset: 0;
          display: grid;
          grid-template-columns: repeat(4, minmax(70px, 1fr));
          gap: 10px;
        }

        .csd-tat-group {
          min-width: 0;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
        }

        .csd-tat-bars {
          height: calc(100% - 30px);
          display: flex;
          align-items: flex-end;
          justify-content: center;
          gap: 5px;
          padding: 0 4px;
        }

        .csd-tat-single-bar {
          position: relative;
          width: 27px;
          height: 100%;
          display: flex;
          align-items: flex-end;
          justify-content: center;
        }

        .csd-tat-single-bar strong {
          position: absolute;
          bottom: calc(100% + 4px);
          left: 50%;
          transform: translateX(-50%);
          color: var(--color-primary, #2563C7);
          font-size: 8px;
          font-weight: 900;
          white-space: nowrap;
        }

        .csd-tat-single-bar .csd-tat-sla-value {
          color: var(--color-success, #16834B);
        }

        .csd-tat-bar {
          width: 100%;
          min-height: 2px;
          border-radius: 5px 5px 0 0;
          transition: transform 0.15s ease;
        }

        .csd-tat-bar:hover {
          transform: translateY(-2px);
        }

        .csd-tat-bar-actual {
          background: var(--color-primary, #2563C7);
        }

        .csd-tat-bar-sla {
          background: var(--color-success, #16834B);
        }

        .csd-tat-x-label {
          height: 30px;
          padding-top: 7px;
          text-align: center;
        }

        .csd-tat-x-label span,
        .csd-tat-x-label small {
          display: block;
          color: var(--color-text, #172B4D);
          font-size: 8px;
          font-weight: 800;
          line-height: 1.2;
        }

        .csd-tat-x-label small {
          margin-top: 2px;
          color: var(--color-muted, #667085);
          font-size: 7px;
          font-weight: 600;
        }

        /* Second chart: vertical Within TAT vs Outside TAT bars */

        .csd-tat-comparison-panel {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .csd-tat-comparison-chart {
          flex: 1 1 auto;
          min-height: 285px;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          padding-top: 2px;
        }

        .csd-tat-comparison-total {
          display: flex;
          align-items: baseline;
          justify-content: center;
          gap: 5px;
          margin-bottom: 8px;
        }

        .csd-tat-comparison-total strong {
          color: var(--color-text, #172B4D);
          font-size: 20px;
          font-weight: 900;
        }

        .csd-tat-comparison-total span {
          color: var(--color-muted, #667085);
          font-size: 8px;
          font-weight: 700;
        }

        .csd-tat-comparison-plot {
          position: relative;
          height: 205px;
          min-height: 205px;
          margin-left: 30px;
          border-bottom: 1px solid var(--color-border, #D9E1EA);
          box-sizing: border-box;
        }

        .csd-tat-comparison-y-axis {
          position: absolute;
          left: -30px;
          top: 0;
          bottom: 0;
          width: 25px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .csd-tat-comparison-y-axis span {
          color: var(--color-muted, #667085);
          font-size: 7px;
          font-weight: 700;
          text-align: right;
        }

        .csd-tat-comparison-grid {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          pointer-events: none;
        }

        .csd-tat-comparison-grid span {
          width: 100%;
          border-top: 1px dashed var(--color-divider, #E7EBF0);
        }

        .csd-tat-comparison-grid span:last-child {
          border-top-style: solid;
        }

        .csd-tat-comparison-bars {
          position: relative;
          z-index: 1;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: stretch;
          justify-content: center;
          gap: 48px;
        }

        .csd-tat-comparison-bar-item {
          position: relative;
          width: 80px;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
        }

        .csd-tat-comparison-value {
          position: absolute;
          left: 50%;
          bottom: calc(100% - 26px);
          transform: translate(-50%, -4px);
          color: var(--color-text, #172B4D);
          font-size: 9px;
          font-weight: 900;
        }

        .csd-tat-comparison-track {
          width: 48px;
          height: calc(100% - 38px);
          display: flex;
          align-items: flex-end;
          overflow: hidden;
          border-radius: 6px 6px 0 0;
          background: var(--color-divider, #E7EBF0);
        }

        .csd-tat-comparison-fill {
          width: 100%;
          min-height: 2px;
          border-radius: 6px 6px 0 0;
          transition: height 0.3s ease;
        }

        .csd-tat-comparison-fill-within {
          background: var(--color-primary, #2563C7);
        }

        .csd-tat-comparison-fill-outside {
          background: var(--color-error, #D64545);
        }

        .csd-tat-comparison-bar-item > strong {
          margin-top: 7px;
          color: var(--color-text, #172B4D);
          font-size: 8px;
          font-weight: 800;
          white-space: nowrap;
        }

        .csd-tat-comparison-bar-item > small {
          margin-top: 2px;
          color: var(--color-muted, #667085);
          font-size: 8px;
          font-weight: 800;
        }

        .csd-tat-comparison-note-row {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 10px 14px;
          margin-top: 10px;
        }

        .csd-tat-comparison-note-row span {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          color: var(--color-muted, #667085);
          font-size: 7px;
        }

        /* Formula */

        .csd-tat-formula-panel {
          margin-top: 12px;
          padding: 12px;
          border: 1px solid var(--color-border, #D9E1EA);
          border-radius: 12px;
          background: var(--color-bg, #F5F7FA);
        }

        .csd-tat-formula-title {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin-bottom: 10px;
          color: var(--color-primary, #2563C7);
        }

        .csd-tat-formula-title h3 {
          margin: 0;
          color: var(--color-text, #172B4D);
          font-size: 10px;
          font-weight: 900;
        }

        .csd-tat-formula-title p {
          margin: 2px 0 0;
          color: var(--color-muted, #667085);
          font-size: 8px;
        }

        .csd-tat-formulas {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }

        .csd-tat-formulas > div {
          min-width: 0;
          padding: 9px;
          border: 1px solid var(--color-border, #D9E1EA);
          border-radius: 8px;
          background: var(--color-surface, #FFFFFF);
        }

        .csd-tat-formulas strong {
          display: block;
          color: var(--color-text, #172B4D);
          font-size: 8px;
          font-weight: 900;
        }

        .csd-tat-formulas span {
          display: block;
          margin-top: 4px;
          color: var(--color-muted, #667085);
          font-size: 7px;
          line-height: 1.35;
        }

        .csd-tat-footer-note {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 9px;
          padding: 8px 9px;
          border-radius: 7px;
          color: var(--color-muted, #667085);
          background: var(--color-info-light, #EAF3FF);
          font-size: 8px;
          font-weight: 700;
        }

        @media (max-width: 1050px) {
          .csd-tat-layout {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 720px) {
          .csd-tat-panel-header {
            flex-direction: column;
          }

          .csd-tat-bar-chart {
            height: 260px;
          }

          .csd-tat-groups {
            gap: 5px;
          }

          .csd-tat-single-bar {
            width: 22px;
          }

          .csd-tat-formulas {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 480px) {
          .csd-tat-formulas {
            grid-template-columns: 1fr;
          }

          .csd-tat-single-bar {
            width: 18px;
          }

          .csd-tat-bars {
            gap: 3px;
          }

          .csd-tat-x-label span {
            font-size: 7px;
          }

          .csd-tat-comparison-bars {
            gap: 18px;
          }

          .csd-tat-comparison-track {
            width: 36px;
          }

          .csd-tat-comparison-bar-item {
            width: 65px;
          }

          .csd-tat-comparison-bar-item > strong {
            font-size: 7px;
          }
        }
      `}</style>
        </article>
    )
}

export default TatPerformanceCard