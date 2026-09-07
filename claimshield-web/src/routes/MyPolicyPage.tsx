import { useEffect, useState } from 'react'
import { ApiError, getMyCustomerProfile, getMyPolicies } from '../lib/api'
import type { PolicyResponseDto } from '../lib/types'
import { PolicyTypeName } from '../lib/statuses'
import { SkeletonBlock } from '../components/Skeleton'

function formatCurrency(amount: number | null) {
  return amount != null ? `₹ ${amount.toLocaleString('en-IN')}` : '—'
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-IN')
}

// Policy.EndDate is stored as the exclusive cutoff (coverage renews
// starting that day), so the last real day of cover - and what a
// person expects to read as "expires on" - is the day before it.
function formatPolicyEndDate(value: string) {
  const d = new Date(value)
  d.setDate(d.getDate() - 1)
  return d.toLocaleDateString('en-IN')
}

export function MyPolicyPage() {
  const [policies, setPolicies] = useState<PolicyResponseDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    getMyCustomerProfile()
      .then((customer) => getMyPolicies(customer.customerId))
      .then((data) => {
        if (!cancelled) setPolicies(data)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Failed to load your policies.')
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div>
      <h1>My Policy</h1>

      {error && <p className="error-text">{error}</p>}

      {!error && !policies && (
        <section className="card">
          <SkeletonBlock lines={5} />
        </section>
      )}

      {policies && policies.length === 0 && (
        <p>No policies are linked to your account yet.</p>
      )}

      {policies?.map((policy) => {
        const isActive = new Date(policy.endDate) >= new Date()

        return (
          <section className="card" key={policy.policyId}>
            <h2>
              {policy.policyNumber}{' '}
              <span className={`badge ${isActive ? '' : 'error-text'}`}>
                {isActive ? 'Active' : 'Expired'}
              </span>
            </h2>
            <dl className="fact-grid">
              <dt>Coverage type</dt>
              <dd>{policy.policyTypeId ? PolicyTypeName[policy.policyTypeId] ?? 'Unknown' : '—'}</dd>

              <dt>Coverage amount</dt>
              <dd>{formatCurrency(policy.coverageAmount)}</dd>

              <dt>IDV</dt>
              <dd>{formatCurrency(policy.idv)}</dd>

              <dt>Premium</dt>
              <dd>{formatCurrency(policy.premiumAmount)}</dd>

              <dt>Excess</dt>
              <dd>{formatCurrency(policy.excess)}</dd>

              <dt>Policy period</dt>
              <dd>
                {formatDate(policy.startDate)} – {formatPolicyEndDate(policy.endDate)}
              </dd>

              <dt>Add-ons</dt>
              <dd>{policy.addOns ?? 'None'}</dd>
            </dl>
          </section>
        )
      })}
    </div>
  )
}