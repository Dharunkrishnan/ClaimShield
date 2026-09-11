import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, getMyClaims, getMyCustomerProfile } from '../lib/api'
import type { ClaimResponseDto } from '../lib/types'
import { ClaimStatusBadge } from '../components/StatusBadge'
import { Search, Eye, X, Plus, CalendarDays, ArrowRight, ShieldCheck } from 'lucide-react'

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
  const [visibleCount, setVisibleCount] = useState(3)

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
      <div className="page-header-row">
        <h1>My Claims</h1>
        <Link to="/my-claims/new" className="button-link btn-header-action">
          <Plus size={15} />
          <span>Raise new claim</span>
        </Link>
      </div>

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
                setVisibleCount(3)
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
                  setVisibleCount(3)
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
            <>
              {/* Desktop Claims Table (>= 768px) */}
              <div className="my-claims-desktop-table table-responsive">
                <table className="queue-table">
                  <thead>
                    <tr>
                      <th>Claim No</th>
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
              </div>

              {/* Mobile Structured Claims List (< 768px) */}
              <div className="my-claims-mobile-list">
                {filteredClaims.slice(0, visibleCount).map((claim) => (
                  <div key={claim.claimId} className="my-claim-mobile-card">
                    <div className="my-claim-mobile-top">
                      <span className="my-claim-mobile-number">
                        <ShieldCheck size={16} />
                        {claim.claimNumber}
                      </span>
                      <ClaimStatusBadge statusId={claim.statusId} />
                    </div>

                    <div className="my-claim-mobile-grid">
                      <div className="my-claim-mobile-field">
                        <span className="my-claim-mobile-label">Policy</span>
                        <span className="my-claim-mobile-val font-mono">{claim.policyNumber ?? '—'}</span>
                      </div>
                      <div className="my-claim-mobile-field">
                        <span className="my-claim-mobile-label">Vehicle</span>
                        <span className="my-claim-mobile-val font-mono">{claim.vehicleRegistrationNumber ?? '—'}</span>
                      </div>
                      <div className="my-claim-mobile-field full-width">
                        <span className="my-claim-mobile-label">Loss Date</span>
                        <span className="my-claim-mobile-val">
                          <CalendarDays size={12} />
                          {formatDate(claim.incidentDate)}
                        </span>
                      </div>
                    </div>

                    <div className="my-claim-mobile-footer">
                      <Link to={`/my-claims/${claim.claimId}`} className="my-claim-mobile-link">
                        <span>View claim details</span>
                        <ArrowRight size={14} />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {visibleCount < filteredClaims.length && (
            <button
              type="button"
              className="track-claim-view-more"
              onClick={() => setVisibleCount((c) => c + 3)}
            >
              View more ({filteredClaims.length - visibleCount} more)
            </button>
          )}
        </>
      )}
    </div>
  )
}