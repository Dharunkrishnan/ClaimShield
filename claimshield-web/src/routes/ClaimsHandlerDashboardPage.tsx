import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Bell,
  CheckCircle2,
  Clock3,
  ClipboardCheck,
  FileCheck2,
  Gauge,
  RefreshCw,
  ShieldAlert,
  Timer,
  TrendingUp,
} from 'lucide-react'

import {
  ApiError,
  getClaimsHandlerAllClaims,
  getClaimsHandlerDashboardSummary,
} from '../lib/api'
import type { ClaimsHandlerClaimListItem } from '../lib/api'
import type { ClaimsHandlerDashboardSummaryDto } from '../lib/types'
import { ClaimStatus, Sla } from '../lib/statuses'
import { CATEGORY_TABS, computeCategoryCounts } from '../lib/claimCategories'
import { useAuth } from '../context/AuthContext'
import { Sparkline } from '../components/Sparkline'
import { TatPerformanceCard } from '../components/TatPerformanceCard'

function SectionHeader({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: ReactNode
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="csd-section-header">
      <div className="csd-section-heading">
        <span className="csd-section-icon">{icon}</span>
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}

function daysOpen(value: string | null): number {
  if (!value) return 0

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 0

  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000))
}

function getGreetingPrefix(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Good Morning'
  if (hour >= 12 && hour < 17) return 'Good Afternoon'
  if (hour >= 17 && hour < 22) return 'Good Evening'
  return 'Good Night'
}

export function ClaimsHandlerDashboardPage() {
  const navigate = useNavigate()
  const { displayName } = useAuth()

  const [summary, setSummary] =
    useState<ClaimsHandlerDashboardSummaryDto | null>(null)

  const [claims, setClaims] =
    useState<ClaimsHandlerClaimListItem[] | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // Drives the greeting - a separate 60s tick rather than reusing the
  // 30s dashboard-refresh timer below, since this only needs to change
  // the hour-bucket, not trigger a data reload.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000)
    return () => window.clearInterval(timer)
  }, [])

  const loadDashboard = async (showRefreshState = true) => {
    if (showRefreshState) setRefreshing(true)
    setError(null)

    try {
      const [summaryData, claimsData] = await Promise.all([
        getClaimsHandlerDashboardSummary(),
        getClaimsHandlerAllClaims(),
      ])

      setSummary(summaryData)
      setClaims(claimsData)
    } catch (err: unknown) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Failed to load your Surveyor dashboard.',
      )
    } finally {
      if (showRefreshState) setRefreshing(false)
    }
  }

  useEffect(() => {
    void loadDashboard()

    const timer = window.setInterval(() => {
      void loadDashboard(false)
    }, 30000)

    return () => window.clearInterval(timer)
  }, [])

  const activeClaims = useMemo(
    () =>
      (claims ?? []).filter(
        (claim) =>
          claim.statusId !== ClaimStatus.Closed &&
          claim.statusId !== ClaimStatus.Rejected,
      ),
    [claims],
  )

  const outstandingClaims = useMemo(
    () =>
      (claims ?? []).filter(
        (claim) =>
          claim.statusId !== ClaimStatus.Closed &&
          claim.statusId !== ClaimStatus.Rejected &&
          claim.statusId !== ClaimStatus.Settled,
      ),
    [claims],
  )

  const paidClaims = useMemo(
    () => (claims ?? []).filter((claim) => claim.statusId === ClaimStatus.Settled),
    [claims],
  )

  const deniedClaims = useMemo(
    () => (claims ?? []).filter((claim) => claim.statusId === ClaimStatus.Rejected),
    [claims],
  )

  // Reads counts from the claim's own .category field (set by the
  // backend's CategoryFor()) via the exact same shared function the
  // Claims list page uses, rather than re-deriving categories locally
  // from raw statusId comparisons - that reimplementation is what was
  // causing this widget's numbers to drift out of sync with the real
  // per-category counts shown elsewhere in the app (e.g. Under Report
  // showing 0 here when the Claims page correctly showed 2).
  const workloadBars = useMemo(() => {
    const counts = computeCategoryCounts(claims)

    const colorByCategoryKey: Record<string, string> = {
      All: '#2563c7',
      PendingAction: '#2878c8',
      UnderReview: '#123b5d',
      InProgress: '#d99000',
      Completed: '#2878c8',
      OnHold: '#e67e22',
      Rejected: '#d64545',
    }

    return CATEGORY_TABS.map((tab) => ({
      label: tab.label,
      value: counts[tab.key] ?? 0,
      color: colorByCategoryKey[tab.key] ?? '#2563c7',
    }))
  }, [claims])

  const ageBars = useMemo(() => {
    const buckets = [
      { label: 'Up to 3 days', value: 0, color: 'var(--color-success)' },
      { label: '3–5 days', value: 0, color: 'var(--color-info)' },
      { label: '5–15 days', value: 0, color: 'var(--color-warning)' },
      { label: '>15 days', value: 0, color: 'var(--color-error)' },
    ]

    for (const claim of outstandingClaims) {
      const age = daysOpen(claim.relevantDate)

      if (age <= 3) buckets[0].value += 1
      else if (age <= 5) buckets[1].value += 1
      else if (age <= 15) buckets[2].value += 1
      else buckets[3].value += 1
    }

    return buckets
  }, [outstandingClaims])

  const assignmentTrend = useMemo(() => {
    const buckets = new Map<string, number>()

    for (const claim of claims ?? []) {
      if (!claim.relevantDate) continue

      const date = new Date(claim.relevantDate)
      if (Number.isNaN(date.getTime())) continue

      const key = `${date.getFullYear()}-${String(
        date.getMonth() + 1,
      ).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

      buckets.set(key, (buckets.get(key) ?? 0) + 1)
    }

    const sorted = [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)

    if (sorted.length === 0) {
      return [{ label: 'No data', value: 0 }]
    }

    return sorted.map(([date, value]) => ({
      label: new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
      }),
      value,
    }))
  }, [claims])

  const slaBreached = summary?.slaBreachedCount ?? 0
  const slaNearBreach = summary?.slaNearBreachCount ?? 0

  const withinSla = Math.max(
    0,
    activeClaims.length - slaBreached,
  )

  const slaHealth =
    activeClaims.length === 0
      ? 100
      : Math.max(
        0,
        Math.min(
          100,
          Math.round((withinSla / activeClaims.length) * 100),
        ),
      )

  const slaRiskCount = slaBreached + slaNearBreach

  const alerts = [
    {
      tone: 'danger',
      icon: <ShieldAlert size={17} />,
      title: `${slaBreached} claims breached SLA`,
      text: 'Prioritize these claims immediately.',
      value: slaBreached,
    },
    {
      tone: 'warning',
      icon: <Clock3 size={17} />,
      title: `${slaNearBreach} claims near SLA breach`,
      text: 'Review before they cross the limit.',
      value: slaNearBreach,
    },
    {
      tone: 'info',
      icon: <FileCheck2 size={17} />,
      title: `${summary?.awaitingDecisionCount ?? 0} decisions pending`,
      text: 'Inspection work is already completed.',
      value: summary?.awaitingDecisionCount ?? 0,
    },
    {
      tone: 'success',
      icon: <CheckCircle2 size={17} />,
      title: `${summary?.closedThisMonthCount ?? 0} claims closed`,
      text: 'Completed outcomes this month.',
      value: summary?.closedThisMonthCount ?? 0,
    },
  ]

  const surveyorName = displayName || 'Surveyor'
  const greeting = `${getGreetingPrefix(now.getHours())}, ${surveyorName}`

  if (error && !summary) {
    return (
      <div className="csd-page">
        <style>{DASHBOARD_CSS}</style>

        <div className="csd-error">
          <AlertCircle size={22} />
          <div className="csd-error-copy">
            <strong>Dashboard could not be loaded</strong>
            <span>{error}</span>
          </div>
          <button
            type="button"
            className="csd-button"
            onClick={() => void loadDashboard()}
          >
            <RefreshCw size={15} />
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="csd-page">
      <style>{DASHBOARD_CSS}</style>

      {/* COMPACT HERO */}
      <section className="csd-hero">
        <div className="csd-hero-main">
          <div className="csd-eyebrow">
            <span className="csd-live-dot" />
            SURVEYOR WORKSPACE
          </div>

          <h1>{greeting} 👋</h1>

          <p className="csd-hero-subtitle">Here&apos;s what&apos;s happening with your claims today.</p>

          <div className="csd-hero-metrics">
            <div className="csd-hero-pill">
              <ClipboardCheck size={14} />
              <strong>{summary?.totalMyClaims ?? 0}</strong>
              <span>Total claims</span>
            </div>

            <div className="csd-hero-pill">
              <Clock3 size={14} />
              <strong>{outstandingClaims.length}</strong>
              <span>Outstanding claims</span>
            </div>

            <div className="csd-hero-pill csd-hero-pill-good">
              <Gauge size={14} />
              <strong>{paidClaims.length}</strong>
              <span>Paid claims</span>
            </div>

            <div className="csd-hero-pill csd-hero-pill-denied">
              <Gauge size={14} />
              <strong>{deniedClaims.length}</strong>
              <span>Denied claims</span>
            </div>
          </div>
        </div>

        <div className="csd-hero-side">
          <div>
            <span>Dashboard scope</span>
            <strong>My Assigned Claims</strong>
          </div>

          <button
            type="button"
            className="csd-button csd-button-light"
            onClick={() => void loadDashboard()}
            disabled={refreshing}
          >
            <RefreshCw
              size={15}
              className={refreshing ? 'csd-spin' : ''}
            />
            {refreshing ? 'Refreshing' : 'Refresh'}
          </button>
        </div>
      </section>

      {error && (
        <div className="csd-inline-error">
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      {/* FIVE PARALLEL AREAS */}
      <section className="csd-five-grid">
        {/* 1. CURRENT WORKLOAD */}
        <article className="csd-card csd-workload-card">
          <SectionHeader
            icon={<BarChart3 size={17} />}
            title="Current Workload"
            subtitle="Stage Wise"
            action={
              <span className="csd-live-badge">
                <span />
                LIVE
              </span>
            }
          />

          <div className="csd-workload-status-list" aria-label="Live claim status counts">
            {workloadBars.map((item) => {
              const max = Math.max(...workloadBars.map((entry) => entry.value), 1)
              const width = item.value > 0 ? Math.max(6, (item.value / max) * 100) : 0

              return (
                <button
                  type="button"
                  className="csd-workload-status-row"
                  key={item.label}
                  onClick={() => navigate('/handler/claims')}
                  title={`Open claim queue for ${item.label}`}
                >
                  <span className="csd-workload-status-label">{item.label}</span>
                  <span className="csd-workload-status-track" aria-hidden="true">
                    <span
                      className="csd-workload-status-fill"
                      style={{ width: `${width}%`, background: item.color }}
                    />
                  </span>
                  <strong className="csd-workload-status-value">{item.value}</strong>
                </button>
              )
            })}
          </div>

          <button
            type="button"
            className="csd-card-link"
            onClick={() => navigate('/handler/claims')}
          >
            Open claim queue
            <ArrowRight size={13} />
          </button>
        </article>

        {/* 2. AGE-WISE CLAIM */}
        <article className="csd-card csd-age-card">
          <SectionHeader
            icon={<Timer size={17} />}
            title="Age-wise Claim"
            subtitle="Claim Ageing"
          />

          <div className="csd-age-summary">
            <div>
              <span>Total Claims</span>
              <strong>{outstandingClaims.length}</strong>
            </div>

            <div className="csd-age-warning">
              <span>15+ days old</span>
              <strong>{ageBars[3]?.value ?? 0}</strong>
            </div>
          </div>

          <div className="csd-age-full-chart">
            <div className="csd-age-chart-scale" aria-hidden="true">
              {(() => {
                const maxAge = Math.max(...ageBars.map((item) => item.value), 1)

                return (
                  <>
                    <span>{maxAge}</span>
                    <span>{Math.ceil(maxAge * 0.75)}</span>
                    <span>{Math.ceil(maxAge * 0.5)}</span>
                    <span>{Math.ceil(maxAge * 0.25)}</span>
                    <span>0</span>
                  </>
                )
              })()}
            </div>

            <div className="csd-age-full-plot">
              <div className="csd-age-grid" aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>

              <div className="csd-age-full-bars">
                {ageBars.map((item) => {
                  const maxAge = Math.max(
                    ...ageBars.map((entry) => entry.value),
                    1,
                  )

                  const height =
                    item.value <= 0
                      ? 0
                      : Math.max(3, (item.value / maxAge) * 100)

                  return (
                    <div
                      className="csd-age-full-bar-item"
                      key={item.label}
                    >
                      <strong>{item.value}</strong>

                      <div
                        className="csd-age-full-track"
                        aria-label={`${item.label}: ${item.value} claims`}
                      >
                        <span
                          className="csd-age-full-fill"
                          style={{
                            height: `${height}%`,
                            background: item.color,
                          }}
                        />
                      </div>

                      <span className="csd-age-full-label">
                        {item.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="csd-age-callout">
            <Clock3 size={15} />
            <span>
              {ageBars[3]?.value ?? 0} claims are more than 15 days old.
            </span>
          </div>
        </article>

        {/* 3. SLA HEALTH */}
        <article className="csd-card">
          <SectionHeader
            icon={<ShieldAlert size={17} />}
            title="SLA Health"
            subtitle="Active workload health"
          />

          <div className="csd-sla-center">
            <div className="csd-sla-ring">
              <svg viewBox="0 0 120 120">
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  className="csd-sla-bg"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  className="csd-sla-progress"
                  strokeDasharray={`${slaHealth * 3.14} 314`}
                />
              </svg>

              <div className="csd-sla-label">
                <strong>{slaHealth}%</strong>
                <span>Healthy</span>
              </div>
            </div>
          </div>

          <div className="csd-sla-grid">
            <div className="csd-sla-stat danger">
              <span />
              <strong>{slaBreached}</strong>
              <small>Breached</small>
            </div>

            <div className="csd-sla-stat warning">
              <span />
              <strong>{slaNearBreach}</strong>
              <small>Near breach</small>
            </div>

            <div className="csd-sla-stat success">
              <span />
              <strong>{withinSla}</strong>
              <small>Within SLA</small>
            </div>
          </div>

          <div className="csd-sla-progress">
            <div>
              <span>Overall SLA health</span>
              <strong>{slaHealth}%</strong>
            </div>

            <div className="csd-progress-track">
              <span style={{ width: `${slaHealth}%` }} />
            </div>
          </div>

          <div className="csd-thresholds">
            <span>Survey {Sla.SurveyBreachDays}d</span>
            <span>Decision {Sla.DecisionBreachDays}d</span>
            <span>Repair {Sla.RepairBreachDays}d</span>
          </div>
        </article>

        {/* 4. TAT PERFORMANCE */}
        <div className="csd-tat-position">
          <TatPerformanceCard />
        </div>

        {/* 5. ASSIGNMENT TREND */}
        <article className="csd-card">
          <SectionHeader
            icon={<TrendingUp size={17} />}
            title="Assignment Trend"
            subtitle="Recent movement in assigned claims"
          />

          <div className="csd-trend-top">
            <div>
              <span>Assignments in view</span>
              <strong>{claims?.length ?? 0}</strong>
            </div>

            <span className="csd-trend-badge">
              <TrendingUp size={12} />
              Activity
            </span>
          </div>

          <div className="csd-trend-chart">
            <Sparkline points={assignmentTrend} />
          </div>

          <div className="csd-trend-footer">
            <span>
              <span className="csd-dot-blue" />
              Claim assignment movement
            </span>
            <strong>Last 8 points</strong>
          </div>
        </article>

        {/* 6. ALERTS & ATTENTION */}
        <article className="csd-card csd-alerts-wide">
          <SectionHeader
            icon={<Bell size={17} />}
            title="Alerts & Attention"
            subtitle="Priority items needing awareness"
            action={
              <button
                type="button"
                className="csd-view-all"
                onClick={() => navigate('/handler/notifications')}
              >
                View all
                <ArrowRight size={12} />
              </button>
            }
          />

          <div className="csd-alert-list">
            {alerts.map((alert) => (
              <button
                type="button"
                className="csd-alert"
                key={alert.title}
                onClick={() => navigate('/handler/claims')}
              >
                <span className={`csd-alert-icon ${alert.tone}`}>
                  {alert.icon}
                </span>

                <span className="csd-alert-copy">
                  <strong>{alert.title}</strong>
                  <small>{alert.text}</small>
                </span>

                <span className="csd-alert-count">
                  {alert.value}
                </span>

                <ArrowRight
                  size={14}
                  className="csd-alert-arrow"
                />
              </button>
            ))}
          </div>

          <div
            className={`csd-attention ${slaRiskCount > 0
              ? 'csd-attention-risk'
              : 'csd-attention-good'
              }`}
          >
            <Gauge size={15} />
            <span>
              {slaRiskCount > 0
                ? `${slaRiskCount} SLA-risk items should be prioritized before routine work.`
                : 'No immediate SLA-risk items are visible.'}
            </span>
          </div>
        </article>

      </section>
    </div>
  )
}

const DASHBOARD_CSS = `
.csd-page {
  width: 100%;
  max-width: 1600px;
  margin: 0 auto;
  padding: 14px 22px 18px;
  box-sizing: border-box;
  color: #172033;
  overflow-x: hidden;
}

.csd-hero {
  min-height: 110px;
  box-sizing: border-box;
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 28px;
  padding: 16px 22px;
  border-radius: 16px;
  position: relative;
  overflow: hidden;
  color: white;
  background:
    radial-gradient(circle at 88% 15%, rgba(96,165,250,.25), transparent 28%),
    radial-gradient(circle at 72% 90%, rgba(45,212,191,.15), transparent 27%),
    linear-gradient(135deg, #102b52 0%, #173f73 52%, #0d5b6d 100%);
  box-shadow: 0 14px 35px rgba(16,42,76,.16);
}

.csd-hero:after {
  content: "";
  position: absolute;
  width: 240px;
  height: 240px;
  right: -80px;
  bottom: -145px;
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 50%;
  box-shadow:
    0 0 0 32px rgba(255,255,255,.035),
    0 0 0 64px rgba(255,255,255,.025);
}

.csd-hero-main {
  min-width: 0;
  position: relative;
  z-index: 1;
}

.csd-eyebrow {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 8px;
  color: rgba(255,255,255,.66);
  font-size: 9px;
  font-weight: 850;
  letter-spacing: 1.4px;
}

.csd-live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #45e39a;
  box-shadow: 0 0 0 4px rgba(69,227,154,.12);
}

.csd-hero h1 {
  margin: 0;
  color: #fff;
  font-size: clamp(18px, 1.6vw, 22px);
  line-height: 1.15;
  letter-spacing: -0.4px;
  font-weight: 600;
}

.csd-hero-subtitle {
  margin: 4px 0 0;
  color: rgba(255,255,255,.72);
  font-size: 11px;
  line-height: 1.4;
}

.csd-hero-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 16px;
}

.csd-hero-pill {
  min-height: 31px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  border: 1px solid rgba(255,255,255,.17);
  border-radius: 999px;
  color: rgba(255,255,255,.82);
  background: rgba(255,255,255,.075);
  font-size: 9px;
  font-weight: 650;
  backdrop-filter: blur(8px);
}

.csd-hero-pill strong {
  color: white;
  font-size: 11px;
  font-weight: 850;
}

.csd-hero-pill-good {
  border-color: rgba(73,222,151,.25);
  background: rgba(47,196,125,.11);
}

.csd-hero-pill-denied {
  border-color: rgba(248,113,113,.3);
  background: rgba(220,38,38,.13);
}

.csd-hero-side {
  flex: 0 0 170px;
  min-width: 170px;
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: space-between;
}

.csd-hero-side > div {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  text-align: right;
}

.csd-hero-side > div span {
  color: rgba(255,255,255,.53);
  font-size: 8px;
  font-weight: 650;
}

.csd-hero-side > div strong {
  color: #fff;
  font-size: 11px;
  font-weight: 820;
}

.csd-button {
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 12px;
  border: 1px solid #d7dee8;
  border-radius: 9px;
  color: #344054;
  background: #fff;
  font-size: 10px;
  font-weight: 800;
  cursor: pointer;
}

.csd-button-light {
  border-color: rgba(255,255,255,.22);
  color: #fff;
  background: rgba(255,255,255,.09);
  backdrop-filter: blur(8px);
}

.csd-button:disabled {
  opacity: .65;
  cursor: default;
}

.csd-spin {
  animation: csd-spin .8s linear infinite;
}

@keyframes csd-spin {
  to { transform: rotate(360deg); }
}

.csd-inline-error,
.csd-error {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-top: 11px;
  padding: 10px 12px;
  border: 1px solid #f3c5c5;
  border-radius: 10px;
  color: #a21caf;
  color: #991b1b;
  background: #fff7f7;
  font-size: 10px;
}

.csd-error {
  max-width: 700px;
  margin: 60px auto;
  padding: 18px;
}

.csd-error-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.csd-error-copy strong {
  color: #7f1d1d;
  font-size: 12px;
}

.csd-error-copy span {
  color: #991b1b;
  font-size: 10px;
}

.csd-five-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: stretch;
  gap: 12px;
  margin-top: 13px;
}

.csd-tat-position {
  grid-column: 1 / -1;
  width: 100%;
  min-width: 0;
}

/* Alerts & Attention - widened to use 2 of the 3 grid columns instead
   of just 1, since it's the last card in the row and was otherwise
   sitting alone next to unused space. */
.csd-alerts-wide {
  grid-column: span 2;
}

.csd-tat-position > * {
  width: 100%;
  min-width: 0;
}

.csd-card {
  min-width: 0;
  min-height: 200px;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  padding: 10px;
  border: 1px solid #e5e9ef;
  border-radius: 14px;
  background: #fff;
  box-shadow:
    0 3px 12px rgba(15,23,42,.045),
    0 1px 2px rgba(15,23,42,.025);
  transition:
    transform .16s ease,
    box-shadow .16s ease,
    border-color .16s ease;
}

.csd-card:hover {
  transform: translateY(-2px);
  border-color: #d6dee9;
  box-shadow:
    0 14px 28px rgba(15,23,42,.075),
    0 2px 4px rgba(15,23,42,.035);
}

.csd-section-header {
  min-height: 38px;
  box-sizing: border-box;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 7px;
  padding-bottom: 8px;
  border-bottom: 1px solid #edf0f4;
}

.csd-section-heading {
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.csd-section-icon {
  width: 29px;
  height: 29px;
  flex: 0 0 29px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #dbe7f8;
  border-radius: 9px;
  color: #2563eb;
  background: #f1f6ff;
}

.csd-section-heading > div {
  min-width: 0;
}

.csd-section-heading h2 {
  margin: 0;
  color: #172033;
  font-size: 12px;
  line-height: 1.15;
  font-weight: 850;
}

.csd-section-heading p {
  margin: 4px 0 0;
  color: #8791a1;
  font-size: 8px;
  line-height: 1.3;
}

.csd-live-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
  border-radius: 999px;
  color: #087443;
  background: #ecfdf3;
  font-size: 7px;
  font-weight: 850;
}

.csd-live-badge > span {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #16a05a;
}

.csd-chart {
  width: 100%;
}

.csd-workload-chart {
  height: 175px;
  min-height: 175px;
  display: flex;
  align-items: center;
  margin-top: 5px;
}

.csd-workload-chart > * {
  width: 100%;
}

.csd-workload-status-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-top: 8px;
}

.csd-workload-status-row {
  width: 100%;
  display: grid;
  grid-template-columns: minmax(145px, 1.55fr) minmax(80px, 1fr) 28px;
  align-items: center;
  gap: 9px;
  padding: 4px 6px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color .15s ease;
}

.csd-workload-status-row:hover {
  background: var(--color-primary);
}

.csd-workload-status-row:hover .csd-workload-status-label,
.csd-workload-status-row:hover .csd-workload-status-value {
  color: #ffffff;
}

.csd-workload-status-label {
  min-width: 0;
  overflow: hidden;
  color: #667085;
  font-size: 8.5px;
  font-weight: 650;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color .15s ease;
}

.csd-workload-status-track {
  position: relative;
  height: 11px;
  overflow: hidden;
  border-radius: 5px;
  background: #f1f4f8;
}

.csd-workload-status-fill {
  display: block;
  height: 100%;
  min-width: 0;
  border-radius: inherit;
  transition: width .3s ease;
}

.csd-workload-status-value {
  color: #172b4d;
  font-size: 9px;
  font-weight: 850;
  text-align: right;
}

/* Current Workload - larger fonts and fuller use of card width,
   scoped to this one card only via .csd-workload-card so no other
   card that happens to reuse these row/label/value class names is
   affected. */
.csd-workload-card .csd-section-heading h2 {
  font-size: 14px;
}

.csd-workload-card .csd-section-heading p {
  font-size: 9.5px;
}

.csd-workload-card .csd-workload-status-list {
  gap: 3px;
  margin-top: 8px;
}

.csd-workload-card .csd-workload-status-row {
  grid-template-columns: minmax(140px, 1.7fr) minmax(80px, 1fr) 34px;
  min-height: 22px;
  padding: 4px 6px;
}

.csd-workload-card .csd-workload-status-label {
  font-size: 11px;
}

.csd-workload-card .csd-workload-status-track {
  height: 13px;
}

.csd-workload-card .csd-workload-status-value {
  font-size: 12px;
}

.csd-four-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0,1fr));
  gap: 4px;
  margin-top: auto;
  padding-top: 9px;
}

.csd-four-stats > div {
  min-width: 0;
  padding: 7px 3px;
  border: 1px solid #edf0f4;
  border-radius: 8px;
  text-align: center;
  background: #fafbfd;
}

.csd-four-stats strong {
  display: block;
  color: #172033;
  font-size: 14px;
  line-height: 1;
  font-weight: 900;
}

.csd-four-stats span {
  display: block;
  margin-top: 4px;
  overflow: hidden;
  color: #8b95a5;
  font-size: 6.5px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.csd-card-link,
.csd-view-all {
  border: 0;
  padding: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #2168c2;
  background: transparent;
  font-size: 8px;
  font-weight: 800;
  cursor: pointer;
}

.csd-card-link {
  margin-top: 10px;
  align-self: flex-end;
}

.csd-age-summary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-top: 11px;
}

.csd-age-summary > div {
  padding: 9px;
  border: 1px solid #edf0f4;
  border-radius: 9px;
  background: #fafbfd;
}

.csd-age-summary span {
  display: block;
  color: #7c8797;
  font-size: 7px;
  font-weight: 650;
}

.csd-age-summary strong {
  display: block;
  margin-top: 5px;
  color: #172033;
  font-size: 19px;
  line-height: 1;
  font-weight: 900;
}

.csd-age-warning {
  border-color: #f5e4c1 !important;
  background: #fffaf1 !important;
}

.csd-age-warning strong {
  color: #b54708;
}

/* Full-card Age-wise Claim vertical bar chart */
.csd-age-card {
  overflow: hidden;
}

.csd-age-full-chart {
  width: 100%;
  flex: 1 1 auto;
  min-height: 165px;
  display: flex;
  gap: 7px;
  margin-top: 10px;
  box-sizing: border-box;
}

.csd-age-chart-scale {
  width: 25px;
  min-width: 25px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 1px 0 30px;
  box-sizing: border-box;
}

.csd-age-chart-scale span {
  color: #98a2b3;
  font-size: 6.5px;
  line-height: 1;
  font-weight: 700;
  text-align: right;
}

.csd-age-full-plot {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  height: 165px;
  border-bottom: 1px solid #dfe4eb;
  box-sizing: border-box;
}

.csd-age-grid {
  position: absolute;
  inset: 0 0 30px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  pointer-events: none;
}

.csd-age-grid span {
  width: 100%;
  border-top: 1px dashed #e8ecf1;
}

.csd-age-grid span:last-child {
  border-top-style: solid;
}

.csd-age-full-bars {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: stretch;
  justify-content: space-around;
  gap: 10px;
}

.csd-age-full-bar-item {
  position: relative;
  flex: 1 1 0;
  min-width: 38px;
  max-width: 72px;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
}

.csd-age-full-bar-item > strong {
  height: 16px;
  color: #172033;
  font-size: 8.5px;
  line-height: 1;
  font-weight: 900;
  white-space: nowrap;
}

.csd-age-full-track {
  width: min(44px, 72%);
  height: calc(100% - 45px);
  display: flex;
  align-items: flex-end;
  overflow: hidden;
  border-radius: 6px 6px 0 0;
  background: #f0f3f7;
}

.csd-age-full-fill {
  display: block;
  width: 100%;
  min-height: 2px;
  border-radius: 6px 6px 0 0;
  transition: height .3s ease;
}

.csd-age-full-label {
  min-height: 23px;
  margin-top: 6px;
  color: #4f5d73;
  font-size: 7px;
  line-height: 1.15;
  font-weight: 800;
  text-align: center;
  white-space: nowrap;
}

.csd-age-callout {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: auto;
  padding: 8px;
  border: 1px solid #f5e4c1;
  border-radius: 9px;
  color: #8b5e10;
  background: #fffaf1;
  font-size: 7.5px;
  line-height: 1.3;
  font-weight: 700;
}

.csd-sla-center {
  display: flex;
  justify-content: center;
  margin-top: 8px;
}

.csd-sla-ring {
  width: 76px;
  height: 76px;
  position: relative;
}

.csd-sla-ring svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.csd-sla-bg {
  fill: none;
  stroke: #edf1f5;
  stroke-width: 9;
}

.csd-sla-progress {
  fill: none;
  stroke: #19a05a;
  stroke-width: 9;
  stroke-linecap: round;
  transition: stroke-dasharray .45s ease;
}

.csd-sla-label {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
}

.csd-sla-label strong {
  color: #172033;
  font-size: 16px;
  line-height: 1;
  font-weight: 900;
}

.csd-sla-label span {
  margin-top: 5px;
  color: #16a05a;
  font-size: 8px;
  font-weight: 850;
}

.csd-sla-grid {
  display: grid;
  grid-template-columns: repeat(3,1fr);
  gap: 5px;
  margin-top: 7px;
}

.csd-sla-stat {
  padding: 7px 3px;
  border: 1px solid #edf0f4;
  border-radius: 8px;
  text-align: center;
  background: #fafbfd;
}

.csd-sla-stat > span {
  width: 6px;
  height: 6px;
  display: block;
  margin: 0 auto 4px;
  border-radius: 50%;
}

.csd-sla-stat strong {
  display: block;
  color: #172033;
  font-size: 14px;
  line-height: 1;
  font-weight: 900;
}

.csd-sla-stat small {
  display: block;
  margin-top: 3px;
  color: #7c8797;
  font-size: 6.5px;
  font-weight: 700;
}

.csd-sla-stat.danger > span { background: #dc3545; }
.csd-sla-stat.warning > span { background: #f59e0b; }
.csd-sla-stat.success > span { background: #16a05a; }

.csd-sla-progress {
  margin-top: auto;
  padding-top: 9px;
}

.csd-sla-progress > div:first-child {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #7c8797;
  font-size: 7px;
  font-weight: 650;
}

.csd-sla-progress strong {
  color: #172033;
  font-weight: 850;
}

.csd-progress-track {
  height: 6px;
  overflow: hidden;
  margin-top: 5px;
  border-radius: 999px;
  background: #edf1f5;
}

.csd-progress-track > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg,#18a05a,#55cf8a);
}

.csd-thresholds {
  display: flex;
  justify-content: space-between;
  gap: 3px;
  margin-top: 6px;
  color: #98a2b3;
  font-size: 6.5px;
  font-weight: 650;
}

.csd-trend-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-top: 12px;
}

.csd-trend-top > div span {
  display: block;
  color: #7c8797;
  font-size: 7px;
  font-weight: 650;
}

.csd-trend-top > div strong {
  display: block;
  margin-top: 4px;
  color: #172033;
  font-size: 22px;
  line-height: 1;
  font-weight: 900;
}

.csd-trend-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 7px;
  border-radius: 999px;
  color: #087443;
  background: #ecfdf3;
  font-size: 7px;
  font-weight: 800;
}

.csd-trend-chart {
  height: 70px;
  min-height: 70px;
  display: flex;
  align-items: center;
  margin-top: 18px;
}

.csd-trend-chart > * {
  width: 100%;
}

.csd-trend-footer {
  display: flex;
  justify-content: space-between;
  gap: 5px;
  margin-top: auto;
  padding-top: 10px;
  color: #7c8797;
  font-size: 7px;
  font-weight: 650;
}

.csd-trend-footer > span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.csd-dot-blue {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #2563eb;
}

.csd-trend-footer strong {
  color: #344054;
  font-weight: 800;
}

.csd-view-all {
  font-size: 7px;
}

.csd-alert-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin-top: 10px;
}

.csd-alert {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: 29px minmax(0,1fr) 22px 12px;
  align-items: center;
  gap: 7px;
  padding: 8px;
  border: 1px solid #edf0f4;
  border-radius: 10px;
  text-align: left;
  background: #fbfcfe;
  cursor: pointer;
  transition: transform .14s ease, border-color .14s ease, background .14s ease;
}

.csd-alert:hover {
  transform: translateX(2px);
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.csd-alert:hover .csd-alert-copy strong,
.csd-alert:hover .csd-alert-copy small,
.csd-alert:hover .csd-alert-count,
.csd-alert:hover .csd-alert-arrow {
  color: #ffffff;
}

.csd-alert:hover .csd-alert-count {
  background: rgba(255,255,255,.22);
}

.csd-alert-icon {
  width: 29px;
  height: 29px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}

.csd-alert-icon.danger {
  color: #b42318;
  background: #fee4e2;
}

.csd-alert-icon.warning {
  color: #b54708;
  background: #fef0c7;
}

.csd-alert-icon.info {
  color: #175cd3;
  background: #dbeafe;
}

.csd-alert-icon.success {
  color: #067647;
  background: #dcfae6;
}

.csd-alert-copy {
  min-width: 0;
}

.csd-alert-copy strong {
  display: block;
  overflow: hidden;
  color: #172033;
  font-size: 8px;
  line-height: 1.25;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.csd-alert-copy small {
  display: block;
  overflow: hidden;
  margin-top: 3px;
  color: #8993a3;
  font-size: 6.5px;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.csd-alert-count {
  min-width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  color: #172033;
  background: #f1f4f8;
  font-size: 8px;
  font-weight: 900;
}

.csd-alert-arrow {
  color: #a0a9b6;
}

.csd-attention {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: auto;
  padding: 8px;
  border: 1px solid;
  border-radius: 9px;
  font-size: 7px;
  line-height: 1.35;
  font-weight: 700;
}

.csd-attention-risk {
  color: #8a4b0a;
  border-color: #f4dfb7;
  background: #fffaf0;
}

.csd-attention-good {
  color: #087443;
  border-color: #ccebd9;
  background: #f0fdf4;
}

@media (max-width: 1350px) {
  .csd-five-grid {
    grid-template-columns: repeat(3, minmax(0,1fr));
  }
}

@media (max-width: 1050px) {
  .csd-five-grid {
    grid-template-columns: repeat(2, minmax(0,1fr));
  }
}

@media (max-width: 720px) {
  .csd-age-full-chart {
    min-height: 220px;
  }

  .csd-age-full-plot {
    height: 220px;
  }

  .csd-age-full-bars {
    gap: 5px;
  }

  .csd-age-full-track {
    width: min(40px, 68%);
  }

  .csd-age-full-label {
    font-size: 6.5px;
  }

  .csd-page {
    padding: 12px;
  }

  .csd-hero {
    flex-direction: column;
    min-height: auto;
    padding: 16px 18px;
    gap: 14px;
  }

  .csd-hero h1 {
    font-size: 20px;
  }

  .csd-hero-side {
    width: 100%;
    min-width: 0;
    flex-basis: auto;
    flex-direction: row;
    align-items: center;
  }

  .csd-hero-side > div {
    align-items: flex-start;
    text-align: left;
  }

  .csd-five-grid {
    grid-template-columns: 1fr;
  }

  .csd-card {
    min-height: 195px;
  }
}

@media (max-width: 460px) {
  .csd-hero-metrics {
    flex-direction: column;
    align-items: stretch;
  }

  .csd-hero-pill {
    justify-content: flex-start;
  }

  .csd-hero-side {
    flex-direction: column;
    align-items: stretch;
  }

  .csd-hero-side > div {
    align-items: flex-start;
  }

  .csd-button-light {
    width: 100%;
  }
}

/* Accessible focus rings - this hero/grid is built entirely from
   clickable <button> elements with bespoke backgrounds, so the
   browser's default focus ring is either invisible (white-on-white
   pills) or missing entirely once a background is set. */
.csd-button:focus-visible,
.csd-workload-status-row:focus-visible,
.csd-card-link:focus-visible,
.csd-view-all:focus-visible,
.csd-alert:focus-visible {
  outline: 2.5px solid #2563c7;
  outline-offset: 2px;
}

.csd-button-light:focus-visible {
  outline-color: #ffffff;
}
`

export default ClaimsHandlerDashboardPage