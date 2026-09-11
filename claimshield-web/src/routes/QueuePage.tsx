import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, getMyQueue } from '../lib/api'
import type { ClaimQueueItemResponseDto } from '../lib/types'
import { Hash, AlertCircle } from 'lucide-react'

const QUEUE_REASON_LABEL: Record<string, string> = {
  AwaitingSurvey: 'Awaiting your survey & assessment',
  AwaitingSurveyorDecision: 'Awaiting your survey decision',
  AwaitingApproverDecision: 'Awaiting your approval',
}

export function QueuePage() {
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
          setError(err instanceof ApiError ? err.message : 'Failed to load your queue.')
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div>
      <h1>My Queue</h1>

      {error && <p className="error-text">{error}</p>}

      {!error && !items && <p>Loading…</p>}

      {items && items.length === 0 && (
        <p>Nothing waiting on you right now.</p>
      )}

      {items && items.length > 0 && (
        <div className="table-responsive">
          <table className="queue-table">
            <thead>
              <tr>
                <th><Hash size={14} /> Claim number</th>
                <th><AlertCircle size={14} /> Reason</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.claimId}>
                  <td>
                    <Link to={`/claims/${item.claimId}`}>
                      {item.claimNumber}
                    </Link>
                  </td>
                  <td>
                    {QUEUE_REASON_LABEL[item.queueReason] ?? item.queueReason}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
