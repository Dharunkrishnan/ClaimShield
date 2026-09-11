import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ApiError,
  getClaim,
  getMyClaims,
  getMyCustomerProfile,
} from '../lib/api'
import type { ClaimResponseDto } from '../lib/types'
import { ClaimStatus, ClaimStatusName, LossType } from '../lib/statuses'
import { SkeletonBlock } from '../components/Skeleton'
import { ClaimStatusBadge } from '../components/StatusBadge'
import {
  Search,
  X,
  MapPinned,
  FileCheck,
  ClipboardCheck,
  ClipboardList,
  SearchCheck,
  RefreshCw,
  ShieldCheck,
  Wallet,
  Check,
  Zap,
  Eye,
  CalendarDays,
  ArrowRight,
} from 'lucide-react'

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface Stage {
  key: string
  label: string
  icon: typeof FileCheck
  threshold: number
}

// Register: treated as "formally logged for review" (UnderReview).
// Under Process: covers both RepairAssigned and RepairInProgress -
// the claim is actively being worked, regardless of which of those
// two sub-statuses it's in.
const STAGES: Stage[] = [
  { key: 'intimated', label: 'Claim Intimated', icon: FileCheck, threshold: ClaimStatus.Submitted },
  { key: 'register', label: 'Register', icon: ClipboardCheck, threshold: ClaimStatus.UnderReview },
  { key: 'surveyAllocated', label: 'Survey Allocated', icon: ClipboardList, threshold: ClaimStatus.SurveyAssigned },
  { key: 'surveyDone', label: 'Survey Done', icon: SearchCheck, threshold: ClaimStatus.SurveyCompleted },
  { key: 'underProcess', label: 'Under Process', icon: RefreshCw, threshold: ClaimStatus.RepairAssigned },
  { key: 'approved', label: 'Approved', icon: ShieldCheck, threshold: ClaimStatus.Approved },
  { key: 'settled', label: 'Claim Settled', icon: Wallet, threshold: ClaimStatus.Settled },
]

function ClaimProgressTracker({ claim }: { claim: ClaimResponseDto }) {
  const statusId = claim.statusId ?? 0
  const isRejected = statusId === ClaimStatus.Rejected

  // Instant Claim skips the survey/registration wait entirely by
  // design - so its tracker shows every stage as complete right away,
  // rather than accurately reflecting a multi-day workflow it never
  // actually went through.
  const isInstant =
    claim.lossTypeId === LossType.MinorAccident &&
    claim.instantClaimToggle === true

  const firstPendingIndex = STAGES.findIndex((s) => statusId < s.threshold)

  return (
    <div className="claim-timeline">
      {isInstant && !isRejected && (
        <div className="claim-timeline-instant-banner">
          <Zap size={14} fill="currentColor" />
          Settled via Instant Claim — fast-tracked, no surveyor visit needed.
        </div>
      )}

      {isRejected && (
        <div className="claim-timeline-rejected-banner">
          <X size={15} />
          This claim was rejected. Contact support for details.
        </div>
      )}

      {STAGES.map((stage, i) => {
        const Icon = stage.icon
        const done =
          isInstant ? !isRejected : !isRejected && statusId >= stage.threshold
        const isCurrent =
          !isInstant && !isRejected && !done && i === firstPendingIndex

        return (
          <div
            key={stage.key}
            className={`claim-timeline-step${done ? ' is-done' : ''}${
              isCurrent ? ' is-current' : ''
            }`}
          >
            <span className="claim-timeline-dot">
              {done ? <Check size={13} /> : <Icon size={13} />}
            </span>

            {i < STAGES.length - 1 && (
              <span className="claim-timeline-connector" />
            )}

            <div className="claim-timeline-content">
              <span className="claim-timeline-label">{stage.label}</span>
              {isCurrent && (
                <span className="claim-timeline-current-tag">In progress</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function TrackClaimPage() {
  const [claims, setClaims] = useState<ClaimResponseDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(3)

  const [selectedClaimDetail, setSelectedClaimDetail] =
    useState<ClaimResponseDto | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

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

  // The list endpoint doesn't carry instantClaimToggle/lossTypeId, so
  // once a specific claim is selected, fetch its full detail (which
  // does) to know whether it went through Instant Claim.
  useEffect(() => {
    if (!selectedClaimId) {
      setSelectedClaimDetail(null)
      return
    }

    let cancelled = false
    setDetailLoading(true)

    getClaim(selectedClaimId)
      .then((data) => {
        if (!cancelled) setSelectedClaimDetail(data)
      })
      .catch(() => {
        // Fall back to the list-sourced claim below if this fails.
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedClaimId])

  const filteredClaims = useMemo(() => {
    if (!claims) return []

    const term = searchTerm.trim().toLowerCase()
    if (!term) return claims

    return claims.filter((claim) => {
      const claimNo = claim.claimNumber?.toLowerCase() ?? ''
      const policyNo = claim.policyNumber?.toLowerCase() ?? ''
      const vehicleNo = claim.vehicleRegistrationNumber?.toLowerCase() ?? ''
      const status = (ClaimStatusName[claim.statusId ?? 0] ?? '').toLowerCase()
      const lossDate = formatDate(claim.incidentDate).toLowerCase()

      return (
        claimNo.includes(term) ||
        policyNo.includes(term) ||
        vehicleNo.includes(term) ||
        status.includes(term) ||
        lossDate.includes(term)
      )
    })
  }, [claims, searchTerm])

  const selectedClaimFromList = useMemo(
    () => claims?.find((c) => c.claimId === selectedClaimId) ?? null,
    [claims, selectedClaimId],
  )

  // Prefer the detailed fetch (has instantClaimToggle/lossTypeId); fall
  // back to the list version so the header still renders immediately
  // while the detail call is in flight.
  const selectedClaim = selectedClaimDetail ?? selectedClaimFromList

  const loading = !claims

  return (
    <div>
      <h1 className="track-claim-page-title">Track Claim</h1>

      {error && <p className="error-text">{error}</p>}

      {!error && loading && (
        <section className="card">
          <SkeletonBlock lines={4} />
        </section>
      )}

      {!loading && claims!.length === 0 && (
        <p>You haven't raised any claims yet.</p>
      )}

      {!loading && claims!.length > 0 && (
        <div className="policy-layout">
          <div className="policy-list track-claim-list">
            <div className="table-search">
              <Search size={16} className="table-search-icon" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setVisibleCount(3)
                }}
                placeholder="Search claim no, policy no, vehicle no…"
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

            {filteredClaims.slice(0, visibleCount).map((claim) => {
              const isSelected = claim.claimId === selectedClaimId

              return (
                <button
                  type="button"
                  key={claim.claimId}
                  className={`track-claim-item-tile${isSelected ? ' is-selected' : ''}`}
                  onClick={() =>
                    setSelectedClaimId((current) =>
                      current === claim.claimId ? null : claim.claimId,
                    )
                  }
                >
                  <div className="track-claim-tile-top">
                    <span className="track-claim-tile-number">
                      <ShieldCheck size={16} />
                      {claim.claimNumber}
                    </span>
                    <ClaimStatusBadge statusId={claim.statusId} />
                  </div>

                  <div className="track-claim-tile-grid">
                    <div className="track-claim-tile-field">
                      <span className="track-claim-tile-label">Policy</span>
                      <span className="track-claim-tile-val font-mono">{claim.policyNumber ?? '—'}</span>
                    </div>
                    <div className="track-claim-tile-field">
                      <span className="track-claim-tile-label">Vehicle</span>
                      <span className="track-claim-tile-val font-mono">{claim.vehicleRegistrationNumber ?? '—'}</span>
                    </div>
                    <div className="track-claim-tile-field full-width">
                      <span className="track-claim-tile-label">Loss Date</span>
                      <span className="track-claim-tile-val">
                        <CalendarDays size={12} />
                        {formatDate(claim.incidentDate)}
                      </span>
                    </div>
                  </div>

                  <div className="track-claim-tile-footer">
                    <div className="track-claim-tile-link">
                      <span>{isSelected ? 'Viewing claim timeline' : 'Track claim progress'}</span>
                      <ArrowRight size={14} />
                    </div>
                  </div>
                </button>
              )
            })}

            {visibleCount < filteredClaims.length && (
              <button
                type="button"
                className="track-claim-view-more"
                onClick={() => setVisibleCount((c) => c + 3)}
              >
                View more ({filteredClaims.length - visibleCount} more)
              </button>
            )}
          </div>

          {/* Backdrop on mobile */}
          {selectedClaim && (
            <div
              className="policy-mobile-backdrop"
              onClick={() => setSelectedClaimId(null)}
              aria-hidden="true"
            />
          )}

          <div className={`policy-detail-area${selectedClaim ? ' is-drawer-open' : ''}`}>
            {selectedClaim ? (
              <section className="card card-tint-blue">
                {/* Mobile Drawer Top Bar (Hidden on desktop) */}
                <div className="policy-drawer-topbar">
                  <button
                    type="button"
                    className="policy-drawer-back-btn"
                    onClick={() => setSelectedClaimId(null)}
                  >
                    ← Back to claims
                  </button>
                  <button
                    type="button"
                    className="policy-drawer-close-btn"
                    onClick={() => setSelectedClaimId(null)}
                    aria-label="Close details"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="claim-timeline-header">
                  <div>
                    <span className="details-strip-label">Claim Number</span>
                    <strong className="claim-timeline-header-number">
                      {selectedClaim.claimNumber}
                    </strong>
                  </div>

                  <ClaimStatusBadge statusId={selectedClaim.statusId} />
                </div>

                <p className="claim-timeline-subtitle">
                  Vehicle {selectedClaim.vehicleRegistrationNumber ?? '—'} · Loss date{' '}
                  {formatDate(selectedClaim.incidentDate)}
                </p>

                <h2 className="claim-timeline-heading">Claim Progress Timeline</h2>

                {detailLoading && !selectedClaimDetail ? (
                  <SkeletonBlock lines={4} />
                ) : (
                  <ClaimProgressTracker claim={selectedClaim} />
                )}

                <Link
                  to={`/my-claims/${selectedClaim.claimId}`}
                  className="button-link"
                  style={{ marginTop: '1.25rem', display: 'inline-flex' }}
                >
                  <Eye size={14} />
                  View full claim summary
                </Link>
              </section>
            ) : (
              <div className="policy-detail-placeholder">
                <MapPinned size={28} />
                <p>Select a claim on the left to see its progress timeline.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}