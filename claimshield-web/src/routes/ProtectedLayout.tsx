import { useState } from 'react'
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  LayoutDashboard,
  FileText,
  FilePlus2,
  ClipboardList,
  MapPinned,
  ListChecks,
  Wrench,
  CreditCard,
  Users,
  SlidersHorizontal,
  Gauge,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { RoleId } from '../lib/roles'
import { ChatAssistant } from '../components/ChatAssistant'
import { GlobalTopBar } from '../components/GlobalTopBar'
import { ClaimShieldLogo } from '../components/ClaimShieldLogo'

const SUPPORTED_ROLE_IDS: number[] = [
  RoleId.Customer,
  RoleId.Surveyor,
  RoleId.Approver,
  RoleId.Repairer,
  RoleId.Admin,
]

const SIDEBAR_STATE_KEY = 'claimshield.sidebarCollapsed'

export function ProtectedLayout() {
  const {
    session,
    loading,
    roleId,
    roleName,
    displayName,
    signOut,
  } = useAuth()

  const location = useLocation()

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_STATE_KEY) === '1'
    } catch {
      return false
    }
  })

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(SIDEBAR_STATE_KEY, next ? '1' : '0')
      } catch {
        // ignore storage failures (private browsing, etc.)
      }
      return next
    })
  }

  if (loading) {
    return <div className="centered-page">Loading…</div>
  }

  if (!session) {
    return (
      <Navigate
        to="/login"
        state={{ from: location.pathname }}
        replace
      />
    )
  }

  if (!roleId || !SUPPORTED_ROLE_IDS.includes(roleId)) {
    return (
      <div className="centered-page">
        <div className="card">
          <h1>ClaimShield</h1>

          <p>
            This portal currently only supports the Customer, Surveyor,
            Approver, and Repairer workflows. Your account role
            {roleName ? ` (${roleName})` : ''} isn't covered here yet.
          </p>

          <button
            type="button"
            onClick={() => void signOut()}
          >
            Sign out
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`app-shell${collapsed ? ' sidebar-collapsed' : ''}`}>
      <aside className="app-sidebar">
        <div className="sidebar-top">
          <span className="brand">
            <motion.span
              className="brand-icon"
              whileHover={{
                scale: 1.15,
                rotate: -8,
              }}
              transition={{
                type: 'spring',
                stiffness: 400,
                damping: 12,
              }}
            >
              <ClaimShieldLogo size={28} />
            </motion.span>

            <span className="brand-label">ClaimShield</span>
          </span>

          <button
            type="button"
            className="sidebar-toggle"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        </div>

        <nav className="sidebar-nav">
          {roleId === RoleId.Customer && (
            <>
              <NavLink
                to="/dashboard"
                className={({ isActive }) => (isActive ? 'active' : '')}
                title="Dashboard"
              >
                <LayoutDashboard size={17} />
                <span className="nav-label">Dashboard</span>
              </NavLink>

              <NavLink
                to="/my-policy"
                className={({ isActive }) => (isActive ? 'active' : '')}
                title="My Policy"
              >
                <FileText size={17} />
                <span className="nav-label">My Policy</span>
              </NavLink>

              <NavLink
                to="/my-claims/new"
                className={({ isActive }) => (isActive ? 'active' : '')}
                title="Raise Claim"
              >
                <FilePlus2 size={17} />
                <span className="nav-label">Raise Claim</span>
              </NavLink>

              <NavLink
                to="/my-claims"
                end
                className={({ isActive }) => (isActive ? 'active' : '')}
                title="My Claims"
              >
                <ClipboardList size={17} />
                <span className="nav-label">My Claims</span>
              </NavLink>

              <NavLink
                to="/track-claim"
                className={({ isActive }) => (isActive ? 'active' : '')}
                title="Track Claim"
              >
                <MapPinned size={17} />
                <span className="nav-label">Track Claim</span>
              </NavLink>
            </>
          )}

          {(roleId === RoleId.Surveyor ||
            roleId === RoleId.Approver ||
            roleId === RoleId.Admin) && (
            <NavLink
              to="/queue"
              className={({ isActive }) => (isActive ? 'active' : '')}
              title="My Queue"
            >
              <ListChecks size={17} />
              <span className="nav-label">My Queue</span>
            </NavLink>
          )}

          {(roleId === RoleId.Repairer ||
            roleId === RoleId.Admin) && (
            <NavLink
              to="/repairs"
              className={({ isActive }) => (isActive ? 'active' : '')}
              title="My Repairs"
            >
              <Wrench size={17} />
              <span className="nav-label">My Repairs</span>
            </NavLink>
          )}

          {(roleId === RoleId.Approver ||
            roleId === RoleId.Admin) && (
            <NavLink
              to="/admin/payments"
              className={({ isActive }) => (isActive ? 'active' : '')}
              title="Payments"
            >
              <CreditCard size={17} />
              <span className="nav-label">Payments</span>
            </NavLink>
          )}

          {roleId === RoleId.Admin && (
            <>
              <NavLink
                to="/admin/dashboard"
                className={({ isActive }) => (isActive ? 'active' : '')}
                title="Dashboard"
              >
                <Gauge size={17} />
                <span className="nav-label">Dashboard</span>
              </NavLink>

              <NavLink
                to="/admin/claims"
                className={({ isActive }) => (isActive ? 'active' : '')}
                title="All Claims"
              >
                <ClipboardList size={17} />
                <span className="nav-label">All Claims</span>
              </NavLink>

              <NavLink
                to="/admin/users"
                className={({ isActive }) => (isActive ? 'active' : '')}
                title="Users"
              >
                <Users size={17} />
                <span className="nav-label">Users</span>
              </NavLink>

              <NavLink
                to="/admin/authority-limits"
                className={({ isActive }) => (isActive ? 'active' : '')}
                title="Authority Limits"
              >
                <SlidersHorizontal size={17} />
                <span className="nav-label">Authority Limits</span>
              </NavLink>

              <NavLink
                to="/admin/scoring-rules"
                className={({ isActive }) => (isActive ? 'active' : '')}
                title="Scoring Rules"
              >
                <SlidersHorizontal size={17} />
                <span className="nav-label">Scoring Rules</span>
              </NavLink>
            </>
          )}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-user">
            <span className="sidebar-user-name">{displayName}</span>
            <span className="sidebar-user-role">{roleName}</span>
          </div>

          <button
            type="button"
            className="sidebar-signout"
            onClick={() => void signOut()}
            title="Sign out"
          >
            <LogOut size={16} />
            <span className="nav-label">Sign out</span>
          </button>
        </div>
      </aside>

      <div className="app-content">
        <GlobalTopBar roleId={roleId} />

        <main className="app-main">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{
                opacity: 0,
                y: 12,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              exit={{
                opacity: 0,
                y: -8,
              }}
              transition={{
                duration: 0.22,
                ease: 'easeOut',
              }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {roleId === RoleId.Customer && <ChatAssistant />}
    </div>
  )
}