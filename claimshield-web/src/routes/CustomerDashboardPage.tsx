import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ApiError,
  getMyClaims,
  getMyCustomerProfile,
  getMyPolicies,
} from '../lib/api'
import type { ClaimResponseDto, PolicyResponseDto } from '../lib/types'
import { ClaimStatus, PolicyTypeName } from '../lib/statuses'
import { SkeletonBlock } from '../components/Skeleton'
import { ClaimStatusBadge } from '../components/StatusBadge'
import { HowItWorks } from '../components/HowItWorks'
import { InstantClaimBanner } from '../components/InstantClaimBanner'
import { FileText, ClipboardList, CheckCircle2, Hash, Wallet, CalendarClock, FilePlus2, Eye, RefreshCw } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

function formatCurrency(amount: number | null) {
  return amount != null ? `₹ ${amount.toLocaleString('en-IN')}` : '—'
}

function formatDateOnly(value: string) {
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function CustomerDashboardPage() {
  const { displayName } = useAuth()
  const [claims, setClaims] = useState<ClaimResponseDto[] | null>(null)
  const [policies, setPolicies] = useState<PolicyResponseDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const loadDashboard = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true)
    setError(null)

    try {
      const customer = await getMyCustomerProfile()
      const [claimData, policyData] = await Promise.all([
        getMyClaims(customer.customerId),
        getMyPolicies(customer.customerId),
      ])
      setClaims(claimData)
      setPolicies(policyData)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load your dashboard.')
    } finally {
      if (isManualRefresh) setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadDashboard(false)
  }, [loadDashboard])

  const loading = !claims || !policies

  const openClaims = claims?.filter((c) => c.statusId !== ClaimStatus.Closed) ?? []
  const closedClaims = claims?.filter((c) => c.statusId === ClaimStatus.Closed) ?? []
  const activePolicy = policies?.find((p) => new Date(p.endDate) >= new Date())

  const firstName = displayName?.trim().split(' ')[0] || 'there'

  return (
    <div className="dashboard-page-container">
      {/* Welcome Top Header with compact refresh button on top right */}
      <div className="dashboard-topbar">
        <div className="dashboard-topbar-header">
          <div>
            <span className="dashboard-topbar-eyebrow">Dashboard</span>
            <h1 className="dashboard-topbar-title">Welcome back, {firstName}</h1>
          </div>
          <button
            type="button"
            className="dashboard-refresh-icon-btn"
            onClick={() => void loadDashboard(true)}
            disabled={refreshing}
            aria-label="Refresh dashboard"
            title="Refresh"
          >
            <RefreshCw size={15} className={refreshing ? 'is-spinning' : ''} />
          </button>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {!error && loading && (
        <section className="card">
          <SkeletonBlock lines={4} />
        </section>
      )}

      {!loading && (
        <>
          {/* 3 KPI cards in a single compact line on all screens */}
          <div className="stat-cards stat-cards-row">
            <div className="stat-card stat-card-compact stat-card-blue">
              <div className="stat-card-header">
                <span className="stat-card-icon stat-card-icon-blue">
                  <FileText size={11} />
                </span>
                <p className="stat-card-label">Active policies</p>
              </div>
              <p className="stat-card-value">
                {policies!.filter((p) => new Date(p.endDate) >= new Date()).length}
              </p>
            </div>
            <div className="stat-card stat-card-compact stat-card-amber">
              <div className="stat-card-header">
                <span className="stat-card-icon stat-card-icon-amber">
                  <ClipboardList size={11} />
                </span>
                <p className="stat-card-label">Open claims</p>
              </div>
              <p className="stat-card-value">{openClaims.length}</p>
            </div>
            <div className="stat-card stat-card-compact stat-card-teal">
              <div className="stat-card-header">
                <span className="stat-card-icon stat-card-icon-teal">
                  <CheckCircle2 size={11} />
                </span>
                <p className="stat-card-label">Closed claims</p>
              </div>
              <p className="stat-card-value">{closedClaims.length}</p>
            </div>
          </div>

          {/* Instant Claim Banner (compact) */}
          <InstantClaimBanner />

          {/* How It Works (3 cards in single line) */}
          <HowItWorks />

          {/* Your active policy (3 clean lines) */}
          {activePolicy &&
            (() => {
              const startMs = new Date(activePolicy.startDate).getTime()
              const endMs = new Date(activePolicy.endDate).getTime()
              const nowMs = Date.now()
              const totalDuration = endMs - startMs
              const remainingMs = Math.max(0, endMs - nowMs)
              const remainingPercent =
                totalDuration > 0 ? Math.min(100, (remainingMs / totalDuration) * 100) : 0
              const daysRemaining = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)))

              return (
                <section className="card card-tint-blue policy-highlight-card">
                  <div className="policy-highlight-header">
                    <h2>Your active policy</h2>
                    <span className="badge badge-icon badge-blue policy-type-chip">
                      <FileText size={11} />
                      {activePolicy.policyTypeId
                        ? (PolicyTypeName[activePolicy.policyTypeId] ?? 'Policy')
                        : 'Policy'}
                    </span>
                  </div>

                  <div className="policy-kv-list">
                    {/* Line 1: Policy number */}
                    <div className="policy-kv-row">
                      <span className="policy-kv-label">
                        <Hash size={12} className="policy-kv-icon" />
                        Policy number
                      </span>
                      <span className="policy-kv-value">{activePolicy.policyNumber}</span>
                    </div>

                    {/* Line 2: Coverage amount */}
                    <div className="policy-kv-row">
                      <span className="policy-kv-label">
                        <Wallet size={12} className="policy-kv-icon" />
                        Coverage amount
                      </span>
                      <span className="policy-kv-value">{formatCurrency(activePolicy.coverageAmount)}</span>
                    </div>

                    {/* Line 3: Valid until */}
                    <div className="policy-kv-row">
                      <span className="policy-kv-label">
                        <CalendarClock size={12} className="policy-kv-icon" />
                        Valid until
                      </span>
                      <div className="policy-kv-val-group">
                        <span className="policy-kv-value">{formatDateOnly(activePolicy.endDate)}</span>
                        <span className="policy-validity-pill">{daysRemaining}d left</span>
                      </div>
                    </div>
                  </div>

                  <div className="policy-validity-bar-wrap">
                    <div className="policy-validity-bar">
                      <div
                        className="policy-validity-bar-fill"
                        style={{ width: `${remainingPercent}%` }}
                      />
                    </div>
                  </div>

                  <Link to="/my-policy" className="policy-details-link">View full policy details →</Link>
                </section>
              )
            })()}

          {/* Recent claims section (shows only 2 claims + View more option) */}
          <section className="card card-tint-blue recent-claims-card">
            <div className="recent-claims-header-row">
              <h2>Recent claims</h2>
              {claims!.length > 2 && (
                <Link to="/my-claims" className="recent-claims-view-more-link">
                  View all ({claims!.length}) →
                </Link>
              )}
            </div>
            {claims!.length === 0 && <p>You haven't raised any claims yet.</p>}
            {claims!.length > 0 && (
              <>
                {/* Desktop table view (Top 2) */}
                <div className="desktop-recent-claims-table table-responsive">
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
                      {claims!.slice(0, 2).map((claim) => (
                        <tr key={claim.claimId}>
                          <td>{claim.claimNumber}</td>
                          <td>{claim.policyNumber ?? '—'}</td>
                          <td>{claim.vehicleRegistrationNumber ?? '—'}</td>
                          <td>{formatDateTime(claim.incidentDate)}</td>
                          <td>
                            <ClaimStatusBadge statusId={claim.statusId} />
                          </td>
                          <td>
                            <Link to={`/my-claims/${claim.claimId}`} className="button-link">
                              <Eye size={12} />
                              View
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile compact card list (Top 2 claims, fits 100% screen width) */}
                <div className="mobile-recent-claims-list">
                  {claims!.slice(0, 2).map((claim) => (
                    <div key={claim.claimId} className="mobile-claim-card">
                      <div className="mobile-claim-card-top">
                        <span className="mobile-claim-number">{claim.claimNumber}</span>
                        <ClaimStatusBadge statusId={claim.statusId} />
                      </div>
                      <div className="mobile-claim-card-meta">
                        <span>{claim.vehicleRegistrationNumber ?? claim.policyNumber ?? 'Vehicle'}</span>
                        <span className="mobile-claim-dot">•</span>
                        <span>{formatDateOnly(claim.incidentDate)}</span>
                      </div>
                      <Link to={`/my-claims/${claim.claimId}`} className="mobile-claim-view-btn">
                        <Eye size={12} />
                        View claim details
                      </Link>
                    </div>
                  ))}
                </div>

                {claims!.length > 2 && (
                  <div className="mobile-recent-claims-more-btn-wrap">
                    <Link to="/my-claims" className="mobile-recent-claims-more-btn">
                      View all {claims!.length} claims
                    </Link>
                  </div>
                )}
              </>
            )}
            <div className="recent-claims-cta-wrap">
              <Link to="/my-claims/new" className="button-link btn-compact-center">
                <FilePlus2 size={13} />
                Raise a new claim
              </Link>
            </div>
          </section>
        </>
      )}
    </div>
  )
}