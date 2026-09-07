import { useEffect, useState } from 'react'
import { ApiError, getClaimsHandlerAllClaims } from '../lib/api'
import type { ClaimsHandlerClaimListItem } from '../lib/api'
import { SkeletonBlock } from '../components/Skeleton'
import { TrackClaimCard } from '../components/TrackClaimCard'

// Track Claim used to be a widget embedded partway down the Claims
// Handler Dashboard, reached by scrolling (or a ?view=track query
// param that auto-scrolled to it). Pulled out into its own page so the
// sidebar's "Track Claim" link goes straight to a dedicated screen
// instead of scrolling within the dashboard.
export function TrackClaimPage() {
  const [claims, setClaims] = useState<ClaimsHandlerClaimListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    getClaimsHandlerAllClaims()
      .then((claimsData) => {
        if (!cancelled) setClaims(claimsData)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Failed to load claims.')
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div>
      <h1>Track Claim</h1>
      <p className="subtitle">Look up any claim and see exactly where it stands right now.</p>

      {error && <p className="error-text">{error}</p>}

      {!claims && !error && (
        <section className="card">
          <SkeletonBlock lines={4} />
        </section>
      )}

      {claims && <TrackClaimCard claims={claims} />}
    </div>
  )
}