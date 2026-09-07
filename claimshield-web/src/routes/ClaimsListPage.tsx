import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ClipboardList, Search, ArrowUpDown, ChevronLeft, ChevronRight, Inbox } from 'lucide-react'
import { ApiError, getClaimsHandlerAllClaims } from '../lib/api'
import type { ClaimsHandlerClaimListItem } from '../lib/api'
import { CATEGORY_TABS, computeCategoryCounts } from '../lib/claimCategories'
import { SkeletonBlock } from '../components/Skeleton'
import { ClaimStatusBadge } from '../components/StatusBadge'

type SortKey = 'age' | 'amount' | 'claimNumber'

function daysSince(iso: string | null): number | null {
  if (!iso) return null
  const ms = Date.now() - new Date(iso).getTime()
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)))
}

// The "My Claims" section used to live partway down the Claims Handler
// Dashboard, reached by scrolling (or a ?view=claims / ?view=tasks
// query param that auto-scrolled to it). Pulled into its own page,
// same as Track Claim - the sidebar's "Claims" and "Tasks" links both
// go straight here now instead of scrolling within the dashboard.
// Still accepts an optional ?category= param so the Dashboard's KPI
// tiles can deep-link straight into a specific filtered view.
export function ClaimsListPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialCategory = searchParams.get('category') ?? 'All'

  const [claims, setClaims] = useState<ClaimsHandlerClaimListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>(initialCategory)
  const [sortKey, setSortKey] = useState<SortKey>('age')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  useEffect(() => {
    let cancelled = false

    getClaimsHandlerAllClaims()
      .then((claimsData) => {
        if (!cancelled) setClaims(claimsData)
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

  const loading = !claims

  const categoryCounts = useMemo(() => computeCategoryCounts(claims), [claims])

  const filteredSortedClaims = useMemo(() => {
    if (!claims) return []

    const searchLower = search.trim().toLowerCase()

    let items = claims.filter((item) => {
      if (categoryFilter !== 'All' && item.category !== categoryFilter) return false
      if (!searchLower) return true
      return (
        item.claimNumber.toLowerCase().includes(searchLower) ||
        (item.customerName ?? '').toLowerCase().includes(searchLower)
      )
    })

    items = [...items].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'age') {
        cmp = (daysSince(a.relevantDate) ?? -1) - (daysSince(b.relevantDate) ?? -1)
      } else if (sortKey === 'amount') {
        cmp = (a.estimatedLossAmount ?? 0) - (b.estimatedLossAmount ?? 0)
      } else {
        cmp = a.claimNumber.localeCompare(b.claimNumber)
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return items
  }, [claims, search, categoryFilter, sortKey, sortDir])

  // Reset back to page 1 whenever the filter/search/sort changes, so
  // switching categories doesn't leave you on a page number that may
  // not even exist in the new, different result set.
  useEffect(() => {
    setCurrentPage(1)
  }, [search, categoryFilter, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(filteredSortedClaims.length / pageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const visibleClaims = filteredSortedClaims.slice(
    (safeCurrentPage - 1) * pageSize,
    safeCurrentPage * pageSize,
  )

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  return (
    <div>
      <h1>Claims</h1>
      <p className="subtitle">Search, filter, and open any claim assigned to you.</p>

      {error && <p className="error-text">{error}</p>}

      {!error && loading && (
        <section className="card">
          <SkeletonBlock lines={5} />
        </section>
      )}

      {!loading && (
        <section className="card">
          <div className="handler-queue-header">
            <h2>
              <ClipboardList size={17} style={{ verticalAlign: '-3px', marginRight: '0.4rem' }} />
              My Claims
            </h2>
            <div className="handler-queue-controls">
              <div className="handler-search-wrap">
                <Search size={15} className="handler-search-icon" />
                <input
                  type="search"
                  placeholder="Search claim number or customer…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="handler-queue-search"
                />
              </div>
            </div>
          </div>

          <div className="queue-filter-tabs queue-filter-tabs-grid">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`queue-filter-tab ${categoryFilter === tab.key ? 'active' : ''}`}
                onClick={() => setCategoryFilter(tab.key)}
              >
                {tab.label}
                <span className="queue-filter-tab-count">{categoryCounts[tab.key] ?? 0}</span>
              </button>
            ))}
          </div>

          {filteredSortedClaims.length === 0 && (
            <div className="empty-state">
              <span className="empty-state-icon">
                <Inbox size={20} />
              </span>
              <span className="empty-state-title">No matching claims</span>
              <p>Nothing matches your current search or filter right now — try a different claim number, customer name, or category.</p>
            </div>
          )}

          {filteredSortedClaims.length > 0 && (
            <div className="queue-table-wrap">
              <table className="queue-table">
                <thead>
                  <tr>
                    <th onClick={() => toggleSort('claimNumber')} className="sortable-th">
                      Claim <ArrowUpDown size={12} />
                    </th>
                    <th>Customer</th>
                    <th>Policy Number</th>
                    <th>Vehicle Number</th>
                    <th>Status</th>
                    <th onClick={() => toggleSort('age')} className="sortable-th">
                      Age <ArrowUpDown size={12} />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleClaims.map((item) => (
                    <tr
                      key={item.claimId}
                      className="clickable-row"
                      onClick={() => navigate(`/claims/${item.claimId}/360`)}
                    >
                      <td>
                        <Link
                          to={`/claims/${item.claimId}/360`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {item.claimNumber}
                        </Link>
                      </td>
                      <td>{item.customerName ?? '—'}</td>
                      <td>{item.policyNumber ?? '—'}</td>
                      <td>{item.vehicleNumber ?? '—'}</td>
                      <td>
                        <ClaimStatusBadge statusId={item.statusId} />
                      </td>
                      <td>
                        {(() => {
                          const days = daysSince(item.relevantDate)
                          if (days == null) return '—'
                          const ageClass =
                            days <= 7
                              ? 'claim-age-green'
                              : days < 15
                                ? 'claim-age-amber'
                                : 'claim-age-red'
                          return <span className={ageClass}>{days}d</span>
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="claims-pagination">
              <button
                type="button"
                className="claims-pagination-button"
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft size={13} />
                Prev
              </button>
              <span className="claims-pagination-status">
                Page {safeCurrentPage} of {totalPages}
              </span>
              <button
                type="button"
                className="claims-pagination-button"
                disabled={safeCurrentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
                <ChevronRight size={13} />
              </button>
            </div>
          )}
        </section>)}
    </div>
  )
}