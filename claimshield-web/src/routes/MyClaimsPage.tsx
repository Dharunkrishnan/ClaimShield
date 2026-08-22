import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, getMyClaims, getMyCustomerProfile } from '../lib/api'
import type { ClaimResponseDto } from '../lib/types'
import { ClaimStatusBadge } from '../components/StatusBadge'
import { Hash, Search, Eye, X } from 'lucide-react'

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function MyClaimsPage() {
  const [claims, setClaims] = useState<ClaimResponseDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [visibleCount, setVisibleCount] = useState(4)

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

  const filteredClaims = useMemo(() => {
    if (!claims) return []

    const term = searchTerm.trim().toLowerCase()
    if (!term) return claims

    return claims.filter((claim) => {
      const claimNo = claim.claimNumber?.toLowerCase() ?? ''
      const policyNo = claim.policyNumber?.toLowerCase() ?? ''
      const vehicleNo = claim.vehicleRegistrationNumber?.toLowerCase() ?? ''
      const lossDate = formatDate(claim.incidentDate).toLowerCase()

      return (
        claimNo.includes(term) ||
        policyNo.includes(term) ||
        vehicleNo.includes(term) ||
        lossDate.includes(term)
      )
    })
  }, [claims, searchTerm])

  return (
    <div>
      <h1>My Claims</h1>

      <p>
        <Link to="/my-claims/new" className="button-link">
          Submit a new claim
        </Link>
      </p>

      {error && <p className="error-text">{error}</p>}

      {!error && !claims && <p>Loading…</p>}

      {claims && claims.length === 0 && <p>You haven't submitted any claims yet.</p>}

      {claims && claims.length > 0 && (
        <>
          <div className="table-search">
            <Search size={16} className="table-search-icon" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value)
                setVisibleCount(4)
              }}
              placeholder="Search by claim no, policy no, vehicle no, or date"
              className="table-search-input"
            />
            {searchTerm && (
              <button
                type="button"
                className="table-search-clear"
                onClick={() => {
                  setSearchTerm('')
                  setVisibleCount(4)
                }}
                aria-label="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {filteredClaims.length === 0 && (
            <p>No claims match "{searchTerm}".</p>
          )}

          {filteredClaims.length > 0 && (
            <table className="queue-table">
              <thead>
                <tr>
                  <th><Hash size={14} /> Claim No</th>
                  <th>Policy No</th>
                  <th>Vehicle No</th>
                  <th>Loss Date</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredClaims.slice(0, visibleCount).map((claim) => (
                  <tr key={claim.claimId}>
                    <td>
                      {claim.claimNumber}
                    </td>
                    <td>{claim.policyNumber ?? '—'}</td>
                    <td>{claim.vehicleRegistrationNumber ?? '—'}</td>
                    <td>{formatDate(claim.incidentDate)}</td>
                    <td>
                      <ClaimStatusBadge statusId={claim.statusId} />
                    </td>
                    <td>
                      <Link to={`/my-claims/${claim.claimId}`} className="button-link">
                        <Eye size={14} />
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {visibleCount < filteredClaims.length && (
            <button
              type="button"
              className="track-claim-view-more"
              onClick={() => setVisibleCount((c) => c + 4)}
            >
              View more ({filteredClaims.length - visibleCount} more)
            </button>
          )}
        </>
      )}
    </div>
  )
}