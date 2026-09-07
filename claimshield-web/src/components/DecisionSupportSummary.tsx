import { useEffect, useState } from 'react'
import { Brain, Sparkles, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { ApiError, getDecisionSupportSummary } from '../lib/api'
import type { DecisionSupportSummaryDto } from '../lib/types'
import { SkeletonBlock } from './Skeleton'

export function DecisionSupportSummary({ claimId }: { claimId: string }) {
  const [summary, setSummary] = useState<DecisionSupportSummaryDto | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    getDecisionSupportSummary(claimId)
      .then((data) => {
        if (!cancelled) setSummary(data)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Failed to load decision support.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })

    return () => {
      cancelled = true
    }
  }, [claimId])

  if (!loaded) {
    return (
      <section className="card decision-support-card">
        <SkeletonBlock lines={3} />
      </section>
    )
  }

  if (error || !summary) {
    return null
  }

  return (
    <section className="card decision-support-card">
      <div className="decision-support-header">
        <span className="decision-support-icon">
          <Brain size={17} />
        </span>
        <div>
          <h2>Decision Support Summary</h2>
          <span className="decision-support-subtitle">
            <Sparkles size={11} />
            Rule-based summary of real assessment data - not an automated decision
          </span>
        </div>
      </div>

      <ul className="decision-support-points">
        {summary.keyPoints.map((point, i) => (
          <li key={i} className={summary.hasVarianceFlag && i === summary.keyPoints.length - 1 ? 'decision-support-flagged' : ''}>
            {point.includes('worth a closer look') || point.includes('not Green') ? (
              <AlertTriangle size={14} className="decision-support-point-icon-warn" />
            ) : (
              <CheckCircle2 size={14} className="decision-support-point-icon-ok" />
            )}
            {point}
          </li>
        ))}
      </ul>
    </section>
  )
}
