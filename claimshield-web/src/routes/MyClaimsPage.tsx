import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, getMyClaims, getMyCustomerProfile } from '../lib/api'
import type { ClaimResponseDto } from '../lib/types'
import { ClaimStatusBadge } from '../components/StatusBadge'
import { Hash } from 'lucide-react'

export function MyClaimsPage() {
  const [claims, setClaims] = useState<ClaimResponseDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    getMyCustomerProfile()
      .then((customer) => getMyClaims(customer.customerId))
      .then((data) => {
        if (!cancelled) setClaims(data)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Failed to load your claims.')
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="my-claims-page">
      <h1>My Claims</h1>

      <p>
        <Link to="/my-claims/new" className="button-link">
          Start Claims Process
        </Link>
      </p>

      {error && <p className="error-text">{error}</p>}

      {!error && !claims && <p>Loading…</p>}

      {claims && claims.length === 0 && <p>You haven't submitted any claims yet.</p>}

      {claims && claims.length > 0 && (
        <table className="queue-table">
          <thead>
            <tr>
              <th><Hash size={14} /> Claim number</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((claim) => (
              <tr key={claim.claimId}>
                <td>
                  <Link to={`/my-claims/${claim.claimId}`}>{claim.claimNumber}</Link>
                </td>
                <td>
                  <ClaimStatusBadge statusId={claim.statusId} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}