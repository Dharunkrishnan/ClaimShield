import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, ExternalLink } from 'lucide-react'
import { ApiError, getPaymentsByClaim } from '../lib/api'
import type { ClaimsHandlerClaimListItem } from '../lib/api'
import type { PaymentResponseDto } from '../lib/types'
import { ClaimLifecycleStepper, STAGE_PATHS } from './ClaimLifecycleStepper'
import { ClaimStatusBadge } from './StatusBadge'

// Checkpoint 11 - a standalone "Track Claim" widget on the Claims
// Handler Dashboard. Searches the claims list already loaded for the
// dashboard (no extra API call for the search itself), and only fetches
// payments (needed for the stepper's Liability-vs-Approval split) once
// a specific claim is actually selected.
export function TrackClaimCard({ claims }: { claims: ClaimsHandlerClaimListItem[] }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selected, setSelected] = useState<ClaimsHandlerClaimListItem | null>(null)
  const [payments, setPayments] = useState<PaymentResponseDto[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q || selected) return []
    return claims
      .filter(
        (c) =>
          c.claimNumber.toLowerCase().includes(q) ||
          (c.customerName ?? '').toLowerCase().includes(q),
      )
      .slice(0, 8)
  }, [query, claims, selected])

  const handleSelect = (claim: ClaimsHandlerClaimListItem) => {
    setSelected(claim)
    setQuery(claim.claimNumber)
    setShowSuggestions(false)
    setError(null)
    setLoading(true)

    getPaymentsByClaim(claim.claimId)
      .then(setPayments)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : 'Failed to load claim status.')
      })
      .finally(() => setLoading(false))
  }

  const handleQueryChange = (value: string) => {
    setQuery(value)
    setShowSuggestions(true)
    if (selected) {
      setSelected(null)
      setPayments(null)
    }
  }

  return (
    <section className="card">
      <h2>
        <Search size={17} style={{ verticalAlign: '-3px', marginRight: '0.4rem' }} />
        Track Claim
      </h2>
      <p className="subtitle">Search any claim to see exactly where it stands right now.</p>

      <div className="survey-field" style={{ position: 'relative', maxWidth: '420px' }}>
        <input
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder="Claim number or customer name…"
          autoComplete="off"
        />
        {showSuggestions && suggestions.length > 0 && (
          <ul className="register-claim-suggestions">
            {suggestions.map((c) => (
              <li key={c.claimId} onMouseDown={() => handleSelect(c)}>
                <strong>{c.claimNumber}</strong>
                <span>{c.customerName ?? 'Unknown customer'}</span>
              </li>
            ))}
          </ul>
        )}
        {showSuggestions && query.trim() && !selected && suggestions.length === 0 && (
          <ul className="register-claim-suggestions">
            <li className="register-claim-suggestions-empty">No matching claim found.</li>
          </ul>
        )}
      </div>

      {loading && <p className="subtitle">Loading…</p>}
      {error && <p className="error-text">{error}</p>}

      {selected && payments && !loading && (
        <div style={{ marginTop: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
            <ClaimStatusBadge statusId={selected.statusId} />
            <span>{selected.customerName ?? 'Unknown customer'}</span>
            <Link to={`/claims/${selected.claimId}`} className="inline-link">
              Open full claim <ExternalLink size={13} />
            </Link>
          </div>
          <ClaimLifecycleStepper
            statusId={selected.statusId}
            payments={payments}
            onStepClick={(index) =>
              navigate(`/claims/${selected.claimId}/${STAGE_PATHS[index]}`)
            }
          />
        </div>
      )}
    </section>
  )
}