import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  X,
  Bell,
  Clock,
  FileText,
  ClipboardList,
  ShieldCheck,
  Car,
  Palette,
  CheckCircle2,
  XCircle,
  Wallet,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { RoleId } from '../lib/roles'
import { ClaimStatus, ClaimStatusName } from '../lib/statuses'
import {
  getMyClaims,
  getMyCustomerProfile,
  getMyPolicies,
} from '../lib/api'
import type { ClaimResponseDto, PolicyResponseDto } from '../lib/types'

interface PageLink {
  label: string
  path: string
  roles: number[]
}

const PAGE_LINKS: PageLink[] = [
  { label: 'Dashboard', path: '/dashboard', roles: [RoleId.Customer] },
  { label: 'My Policy', path: '/my-policy', roles: [RoleId.Customer] },
  { label: 'Raise Claim', path: '/my-claims/new', roles: [RoleId.Customer] },
  { label: 'My Claims', path: '/my-claims', roles: [RoleId.Customer] },
  { label: 'Track Claim', path: '/track-claim', roles: [RoleId.Customer] },
  { label: 'My Queue', path: '/queue', roles: [RoleId.Surveyor, RoleId.Approver, RoleId.Admin] },
  { label: 'My Repairs', path: '/repairs', roles: [RoleId.Repairer, RoleId.Admin] },
  { label: 'Payments', path: '/admin/payments', roles: [RoleId.Approver, RoleId.Admin] },
  { label: 'Admin Dashboard', path: '/admin/dashboard', roles: [RoleId.Admin] },
  { label: 'All Claims', path: '/admin/claims', roles: [RoleId.Admin] },
  { label: 'Users', path: '/admin/users', roles: [RoleId.Admin] },
  { label: 'Authority Limits', path: '/admin/authority-limits', roles: [RoleId.Admin] },
  { label: 'Scoring Rules', path: '/admin/scoring-rules', roles: [RoleId.Admin] },
]

// =====================================================================
// Notifications
// =====================================================================
//
// There is no Notifications table or event log in the backend - these
// are DERIVED live from each claim's current status, not a persisted
// history of what happened. That means: only the claim's CURRENT
// state produces a notification (not every status it passed through),
// "read" tracking is a local per-browser marker (not server-side), and
// the "time" shown is the claim's last-updated timestamp, not the
// actual moment that specific status was reached. This is real,
// data-driven content - just not a true notification/event system.
// =====================================================================

const NOTIF_SEEN_KEY = 'claimshield.notifSeen'

function statusMessage(claim: ClaimResponseDto): string {
  const statusId = claim.statusId ?? 0

  switch (statusId) {
    case ClaimStatus.Submitted:
      return `Claim ${claim.claimNumber} has been registered.`
    case ClaimStatus.UnderReview:
      return `Claim ${claim.claimNumber} is under review.`
    case ClaimStatus.SurveyAssigned:
      return `A surveyor has been assigned to claim ${claim.claimNumber}.`
    case ClaimStatus.SurveyCompleted:
      return `Survey completed for claim ${claim.claimNumber}.`
    case ClaimStatus.RepairAssigned:
    case ClaimStatus.RepairInProgress:
      return `Claim ${claim.claimNumber} is under process.`
    case ClaimStatus.Approved:
      return `Claim ${claim.claimNumber} has been approved.`
    case ClaimStatus.Rejected:
      return `Claim ${claim.claimNumber} was rejected.`
    case ClaimStatus.Settled:
      return claim.approvedAmount
        ? `Claim ${claim.claimNumber} settled — ₹${claim.approvedAmount.toLocaleString('en-IN')} credited.`
        : `Claim ${claim.claimNumber} has been settled.`
    case ClaimStatus.Closed:
      return `Claim ${claim.claimNumber} has been closed.`
    default:
      return `Claim ${claim.claimNumber}: ${ClaimStatusName[statusId] ?? 'status updated'}.`
  }
}

function statusIcon(statusId: number | null) {
  if (statusId === ClaimStatus.Settled) return CheckCircle2
  if (statusId === ClaimStatus.Rejected) return XCircle
  if (statusId === ClaimStatus.Approved) return Wallet
  return ClipboardList
}

function relativeTime(value: string | null): string {
  if (!value) return ''
  const diffMs = Date.now() - new Date(value).getTime()
  const minutes = Math.round(diffMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

function loadSeenIds(): Set<string> {
  try {
    const raw = localStorage.getItem(NOTIF_SEEN_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch {
    return new Set()
  }
}

function saveSeenIds(ids: Set<string>) {
  try {
    localStorage.setItem(NOTIF_SEEN_KEY, JSON.stringify([...ids]))
  } catch {
    // Non-critical.
  }
}

export function GlobalTopBar({ roleId }: { roleId: number }) {
  const navigate = useNavigate()
  const { session } = useAuth()
  const { theme, toggleTheme } = useTheme()

  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [notifOpen, setNotifOpen] = useState(false)

  const [claims, setClaims] = useState<ClaimResponseDto[]>([])
  const [policies, setPolicies] = useState<PolicyResponseDto[]>([])
  const [dataLoaded, setDataLoaded] = useState(false)

  const [seenIds, setSeenIds] = useState<Set<string>>(() => loadSeenIds())

  const searchRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const lastLoginAt = session?.user.last_sign_in_at

  // Loaded eagerly (not just when search opens) so the notification
  // bell can show an unread badge without requiring a click first.
  useEffect(() => {
    if (dataLoaded || roleId !== RoleId.Customer) return

    getMyCustomerProfile()
      .then((customer) =>
        Promise.all([getMyClaims(customer.customerId), getMyPolicies(customer.customerId)]),
      )
      .then(([claimData, policyData]) => {
        setClaims(claimData)
        setPolicies(policyData)
        setDataLoaded(true)
      })
      .catch(() => {
        setDataLoaded(true)
      })
  }, [dataLoaded, roleId])

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus()
  }, [searchOpen])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const matchedPages = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return []
    return PAGE_LINKS.filter(
      (p) => p.roles.includes(roleId) && p.label.toLowerCase().includes(term),
    )
  }, [query, roleId])

  const matchedClaims = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return []
    return claims
      .filter(
        (c) =>
          c.claimNumber?.toLowerCase().includes(term) ||
          c.policyNumber?.toLowerCase().includes(term) ||
          c.vehicleRegistrationNumber?.toLowerCase().includes(term),
      )
      .slice(0, 5)
  }, [query, claims])

  const matchedPolicies = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return []
    return policies.filter((p) => p.policyNumber?.toLowerCase().includes(term)).slice(0, 5)
  }, [query, policies])

  const hasResults =
    matchedPages.length > 0 || matchedClaims.length > 0 || matchedPolicies.length > 0

  const closeSearch = () => {
    setSearchOpen(false)
    setQuery('')
  }

  const notifications = useMemo(() => {
    return [...claims]
      .sort((a, b) => {
        const aTime = new Date(a.updatedDate ?? a.reportedDate ?? a.incidentDate).getTime()
        const bTime = new Date(b.updatedDate ?? b.reportedDate ?? b.incidentDate).getTime()
        return bTime - aTime
      })
      .slice(0, 8)
      .map((claim) => ({
        id: `${claim.claimId}:${claim.statusId}`,
        claimId: claim.claimId,
        message: statusMessage(claim),
        time: relativeTime(claim.updatedDate ?? claim.reportedDate),
        Icon: statusIcon(claim.statusId),
      }))
  }, [claims])

  const unreadCount = notifications.filter((n) => !seenIds.has(n.id)).length

  const handleOpenNotifications = () => {
    setNotifOpen((o) => {
      const next = !o
      if (next) {
        const updated = new Set(seenIds)
        notifications.forEach((n) => updated.add(n.id))
        setSeenIds(updated)
        saveSeenIds(updated)
      }
      return next
    })
  }

  return (
    <header className="global-topbar">
      <div className="global-topbar-marquee">
        <div className="global-topbar-marquee-track">
          <span className="global-topbar-marquee-item">
            <Car size={14} />
            From Accident to Claim Decision in Under 30 Minutes
            <span className="global-topbar-marquee-dot">•</span>
            Submit. Track. Settle.
          </span>
          <span className="global-topbar-marquee-item" aria-hidden="true">
            <Car size={14} />
            From Accident to Claim Decision in Under 30 Minutes
            <span className="global-topbar-marquee-dot">•</span>
            Submit. Track. Settle.
          </span>
        </div>
      </div>

      <div className="global-topbar-actions">
        <div className="global-search" ref={searchRef}>
          {searchOpen ? (
            <div className="global-search-box">
              <Search size={15} className="global-search-icon" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') closeSearch()
                }}
                placeholder="Search pages, claims, policies…"
              />
              <button
                type="button"
                className="global-search-close"
                onClick={closeSearch}
                aria-label="Close search"
              >
                <X size={14} />
              </button>

              {query.trim() && (
                <div className="global-search-results">
                  {!hasResults && <p className="global-search-empty">No matches for "{query}".</p>}

                  {matchedPages.length > 0 && (
                    <div className="global-search-group">
                      <span className="global-search-group-label">Pages</span>
                      {matchedPages.map((p) => (
                        <button
                          key={p.path}
                          type="button"
                          onClick={() => {
                            navigate(p.path)
                            closeSearch()
                          }}
                        >
                          <ShieldCheck size={14} />
                          {p.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {matchedClaims.length > 0 && (
                    <div className="global-search-group">
                      <span className="global-search-group-label">Claims</span>
                      {matchedClaims.map((c) => (
                        <button
                          key={c.claimId}
                          type="button"
                          onClick={() => {
                            navigate(`/my-claims/${c.claimId}`)
                            closeSearch()
                          }}
                        >
                          <ClipboardList size={14} />
                          {c.claimNumber}
                        </button>
                      ))}
                    </div>
                  )}

                  {matchedPolicies.length > 0 && (
                    <div className="global-search-group">
                      <span className="global-search-group-label">Policies</span>
                      {matchedPolicies.map((p) => (
                        <button
                          key={p.policyId}
                          type="button"
                          onClick={() => {
                            navigate('/my-policy')
                            closeSearch()
                          }}
                        >
                          <FileText size={14} />
                          {p.policyNumber}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              className="global-topbar-icon-button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
              title="Search"
            >
              <Search size={17} />
            </button>
          )}
        </div>

        <button
          type="button"
          className={`global-topbar-icon-button${theme === 'green' ? ' is-active-theme' : ''}`}
          onClick={toggleTheme}
          aria-label={theme === 'orange' ? 'Switch to Green & Blue theme' : 'Switch to Orange theme'}
          title={theme === 'orange' ? 'Switch to Green & Blue theme' : 'Switch to Orange theme'}
        >
          <Palette size={16} />
        </button>

        <div className="global-notif" ref={notifRef}>
          <button
            type="button"
            className="global-topbar-icon-button"
            onClick={handleOpenNotifications}
            aria-label="Notifications"
            title="Notifications"
          >
            <Bell size={17} />
            {unreadCount > 0 && (
              <span className="global-notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
          </button>

          {notifOpen && (
            <div className="global-notif-panel">
              <span className="global-notif-panel-title">Notifications</span>

              {notifications.length === 0 ? (
                <p className="global-notif-empty">You're all caught up — no new notifications.</p>
              ) : (
                <div className="global-notif-list">
                  {notifications.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      className="global-notif-item"
                      onClick={() => {
                        navigate(`/my-claims/${n.claimId}`)
                        setNotifOpen(false)
                      }}
                    >
                      <n.Icon size={15} />
                      <span className="global-notif-item-text">
                        {n.message}
                        {n.time && <span className="global-notif-item-time">{n.time}</span>}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {lastLoginAt && (
          <div className="global-topbar-login">
            <Clock size={14} />
            Last login: {new Date(lastLoginAt).toLocaleString('en-IN')}
          </div>
        )}
      </div>
    </header>
  )
}