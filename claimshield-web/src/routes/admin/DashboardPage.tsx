import { useEffect, useState } from 'react'
import { ApiError, getDashboardSummary } from '../../lib/api'
import type { DashboardSummaryDto } from '../../lib/types'
import { BarChart } from '../../components/BarChart'
import { DonutChart } from '../../components/DonutChart'
import { Sparkline } from '../../components/Sparkline'

const BAND_COLORS: Record<string, string> = {
  Green: '#16834B',
  Amber: '#D99000',
  Red: '#D64545',
  Unknown: '#8a8a8a',
}

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  Pending: '#8a8a8a',
  Processing: '#2563C7',
  Paid: '#16834B',
  Failed: '#D64545',
  Cancelled: '#D99000',
}

const APPROVAL_COLORS: Record<string, string> = {
  Pending: '#8a8a8a',
  Approved: '#16834B',
  Rejected: '#D64545',
}

function formatCurrency(amount: number) {
  return `₹ ${Math.round(amount).toLocaleString('en-IN')}`
}

function formatShortDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummaryDto | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getDashboardSummary()
      .then(setSummary)
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Failed to load dashboard.'),
      )
  }, [])

  if (error) {
    return <p className="error-text">{error}</p>
  }

  if (!summary) {
    return <p>Loading…</p>
  }

  return (
    <div>
      <h1>Dashboard</h1>

      <div className="stat-cards">
        <div className="stat-card">
          <p className="stat-card-label">Total claims</p>
          <p className="stat-card-value">{summary.totalClaims}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card-label">Total customers</p>
          <p className="stat-card-value">{summary.totalCustomers}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card-label">Total paid out</p>
          <p className="stat-card-value">{formatCurrency(summary.totalPaidAmount)}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card-label">Average claim amount</p>
          <p className="stat-card-value">{formatCurrency(summary.averageClaimAmount)}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card-label">Avg. approval turnaround</p>
          <p className="stat-card-value">
            {summary.averageApprovalTurnaroundDays != null
              ? `${summary.averageApprovalTurnaroundDays.toFixed(1)} days`
              : '—'}
          </p>
        </div>
      </div>

      <div className="dashboard-grid">
        <section className="card">
          <h2>Claims by status</h2>
          {summary.claimsByStatus.length === 0 ? (
            <p>No claims yet.</p>
          ) : (
            <BarChart
              items={summary.claimsByStatus.map((s) => ({
                label: s.statusName,
                value: s.count,
              }))}
            />
          )}
        </section>

        <section className="card">
          <h2>Claims over the last 30 days</h2>
          <Sparkline
            points={summary.claimsOverTime.map((d) => ({
              label: formatShortDate(d.date),
              value: d.count,
            }))}
          />
        </section>

        <section className="card">
          <h2>Risk band distribution</h2>
          {summary.riskBandDistribution.length === 0 ? (
            <p>No scored claims yet.</p>
          ) : (
            <DonutChart
              items={summary.riskBandDistribution.map((b) => ({
                label: b.bandName,
                value: b.count,
                color: BAND_COLORS[b.bandName] ?? BAND_COLORS.Unknown,
              }))}
            />
          )}
        </section>

        <section className="card">
          <h2>Payments by status</h2>
          {summary.paymentsByStatus.length === 0 ? (
            <p>No payments yet.</p>
          ) : (
            <BarChart
              items={summary.paymentsByStatus.map((s) => ({
                label: s.statusName,
                value: s.count,
                color: PAYMENT_STATUS_COLORS[s.statusName],
              }))}
            />
          )}
        </section>

        <section className="card">
          <h2>Repair estimate outcomes</h2>
          {summary.repairEstimateOutcomes.length === 0 ? (
            <p>No repair estimates yet.</p>
          ) : (
            <DonutChart
              items={summary.repairEstimateOutcomes.map((s) => ({
                label: s.statusName,
                value: s.count,
                color: APPROVAL_COLORS[s.statusName] ?? APPROVAL_COLORS.Pending,
              }))}
            />
          )}
        </section>
      </div>
    </div>
  )
}
