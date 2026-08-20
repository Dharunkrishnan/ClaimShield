import { useEffect, useState } from 'react'
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
import { FileText, ClipboardList, CheckCircle2, Hash, Wallet, CalendarClock, FilePlus2, Eye, Clock } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

function formatCurrency(amount: number | null) {
  return amount != null ? `₹ ${amount.toLocaleString('en-IN')}` : '—'
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// incidentDate/policy dates are date-only values (from a date picker,
// no real time was ever collected) - formatting them with a time
// component produces a misleading artifact like "5:30 AM" that was
// never actually chosen by anyone.
function formatDateOnly(value: string) {
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function CustomerDashboardPage() {
  const { session, displayName } = useAuth()
  const [claims, setClaims] = useState<ClaimResponseDto[] | null>(null)
  const [policies, setPolicies] = useState<PolicyResponseDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    getMyCustomerProfile()
      .then(async (customer) => {
        const [claimData, policyData] = await Promise.all([
          getMyClaims(customer.customerId),
          getMyPolicies(customer.customerId),
        ])
        if (!cancelled) {
          setClaims(claimData)
          setPolicies(policyData)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Failed to load your dashboard.')
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const loading = !claims || !policies

  const openClaims = claims?.filter((c) => c.statusId !== ClaimStatus.Closed) ?? []
  const closedClaims = claims?.filter((c) => c.statusId === ClaimStatus.Closed) ?? []
  const activePolicy = policies?.find((p) => new Date(p.endDate) >= new Date())

  const firstName = displayName?.trim().split(' ')[0] || 'there'
  const lastLoginAt = session?.user.last_sign_in_at

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="dashboard-topbar-eyebrow">Dashboard</span>
          <h1 className="dashboard-topbar-title">Welcome back, {firstName}</h1>
        </div>

        {lastLoginAt && (
          <div className="dashboard-topbar-login">
            <Clock size={14} />
            Last login: {formatDate(lastLoginAt)}
          </div>
        )}
      </div>

      {error && <p className="error-text">{error}</p>}

      {!error && loading && (
        <section className="card">
          <SkeletonBlock lines={4} />
        </section>
      )}

      {!loading && (
        <>
          <div className="stat-cards">
            <div className="stat-card stat-card-blue">
              <span className="stat-card-icon stat-card-icon-blue">
                <FileText size={18} />
              </span>
              <p className="stat-card-label">Active policies</p>
              <p className="stat-card-value">
                {policies!.filter((p) => new Date(p.endDate) >= new Date()).length}
              </p>
            </div>
            <div className="stat-card stat-card-amber">
              <span className="stat-card-icon stat-card-icon-amber">
                <ClipboardList size={18} />
              </span>
              <p className="stat-card-label">Open claims</p>
              <p className="stat-card-value">{openClaims.length}</p>
            </div>
            <div className="stat-card stat-card-teal">
              <span className="stat-card-icon stat-card-icon-teal">
                <CheckCircle2 size={18} />
              </span>
              <p className="stat-card-label">Closed claims</p>
              <p className="stat-card-value">{closedClaims.length}</p>
            </div>
          </div>

          <InstantClaimBanner />

          <HowItWorks />

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
                  <h2>Your active policy</h2>
                  <span className="badge badge-icon badge-blue policy-type-chip">
                    <FileText size={13} />
                    {activePolicy.policyTypeId
                      ? (PolicyTypeName[activePolicy.policyTypeId] ?? 'Policy')
                      : 'Policy'}
                  </span>

                  <dl className="fact-grid fact-grid-rich">
                    <dt>
                      <span className="fact-icon fact-icon-blue">
                        <Hash size={14} />
                      </span>
                      Policy number
                    </dt>
                    <dd>{activePolicy.policyNumber}</dd>

                    <dt>
                      <span className="fact-icon fact-icon-teal">
                        <Wallet size={14} />
                      </span>
                      Coverage amount
                    </dt>
                    <dd>{formatCurrency(activePolicy.coverageAmount)}</dd>

                    <dt>
                      <span className="fact-icon fact-icon-amber">
                        <CalendarClock size={14} />
                      </span>
                      Valid until
                    </dt>
                    <dd>
                      {formatDateOnly(activePolicy.endDate)}
                      <div className="policy-validity-bar">
                        <div
                          className="policy-validity-bar-fill"
                          style={{ width: `${remainingPercent}%` }}
                        />
                      </div>
                      <span className="policy-validity-days">
                        {daysRemaining} day{daysRemaining === 1 ? '' : 's'} remaining
                      </span>
                    </dd>
                  </dl>
                  <Link to="/my-policy">View full policy details →</Link>
                </section>
              )
            })()}

          <section className="card card-tint-blue">
            <h2>Recent claims</h2>
            {claims!.length === 0 && <p>You haven't raised any claims yet.</p>}
            {claims!.length > 0 && (
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
                  {claims!.slice(0, 5).map((claim) => (
                    <tr key={claim.claimId}>
                      <td>
                        {claim.claimNumber}
                      </td>
                      <td>{claim.policyNumber ?? '—'}</td>
                      <td>{claim.vehicleRegistrationNumber ?? '—'}</td>
                      <td>{formatDateOnly(claim.incidentDate)}</td>
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
            <p>
              <Link to="/my-claims/new" className="button-link">
                <FilePlus2 size={16} />
                Raise a new claim
              </Link>
            </p>
          </section>
        </>
      )}
    </div>
  )
}