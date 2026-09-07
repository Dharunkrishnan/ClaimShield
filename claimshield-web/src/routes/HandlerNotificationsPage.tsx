import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, FileText, CheckCircle2 } from 'lucide-react'
import { getMyQueue, ApiError } from '../lib/api'
import type { ClaimQueueItemResponseDto } from '../lib/types'
import { SkeletonBlock } from '../components/Skeleton'

const QUEUE_REASON_LABEL: Record<string, string> = {
  AwaitingSurvey: 'Awaiting Survey',
  AwaitingSurveyorDecision: 'Awaiting Decision',
  AwaitingApproverDecision: 'Awaiting Approver',
  InfoRequested: 'Info Requested',
}

// Real "notifications" built from the same live queue data the dashboard
// uses - claims genuinely waiting on this handler right now, most-relevant
// first. Not a separate fake notification store.
export function HandlerNotificationsPage() {
  const [items, setItems] = useState<ClaimQueueItemResponseDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getMyQueue()
      .then((data) => {
        if (!cancelled) setItems(data)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Failed to load notifications.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div>
      <h1>Notifications</h1>
      <p className="subtitle">Claims that currently need your attention.</p>

      {error && <p className="error-text">{error}</p>}

      {!error && !items && (
        <section className="card">
          <SkeletonBlock lines={4} />
        </section>
      )}

      {items && items.length === 0 && (
        <section className="card">
          <div className="empty-state">
            <span className="empty-state-icon">
              <CheckCircle2 size={20} />
            </span>
            <span className="empty-state-title">You're all caught up</span>
            <p>Nothing needs your attention right now.</p>
          </div>
        </section>
      )}

      {items && items.length > 0 && (
        <ul className="timeline">
          {items.map((item) => (
            <li key={item.claimId}>
              <span className="notification-bell-icon">
                <Bell size={15} />
              </span>
              <Link to={`/claims/${item.claimId}`}>{item.claimNumber}</Link>
              {' — '}
              {QUEUE_REASON_LABEL[item.queueReason] ?? item.queueReason}
              {item.customerName ? ` · ${item.customerName}` : ''}
            </li>
          ))}
        </ul>
      )}

      <p className="subtitle" style={{ marginTop: '1rem' }}>
        <FileText size={14} style={{ verticalAlign: 'text-bottom', marginRight: '0.3rem' }} />
        For a full breakdown, use the work queue on your Dashboard.
      </p>
    </div>
  )
}