import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  ShieldCheck,
  LayoutDashboard,
  FileText,
  Car,
  FilePlus2,
  ClipboardList,
  ListChecks,
  Wrench,
  CreditCard,
  Users,
  SlidersHorizontal,
  Gauge,
  LogOut,
  Bell,
  HelpCircle,
  FolderKanban,
  Radar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { RoleId } from '../lib/roles'
import { ChatAssistant } from '../components/ChatAssistant'

const SUPPORTED_ROLE_IDS: number[] = [
  RoleId.Customer,
  RoleId.Surveyor,
  RoleId.Approver,
  RoleId.Repairer,
  RoleId.Admin,
]

const SIDEBAR_ROLE_IDS: number[] = [
  RoleId.Surveyor,
  RoleId.Approver,
  RoleId.Repairer,
  RoleId.Admin,
]

interface SidebarLinkProps {
  href: string
  icon: ReactNode
  label: string
  collapsed?: boolean
  // Accessible name for icon-only links (e.g. the header's notification
  // bell, which intentionally renders no visible label) - without this,
  // a screen reader has nothing to announce for the link at all.
  ariaLabel?: string
}

function SidebarLink(props: SidebarLinkProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const current = location.pathname + location.search
  const isActive = current === props.href
  const hasVisibleLabel = !props.collapsed && props.label !== ''

  function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault()
    navigate(props.href)
  }

  return (
    <a
      href={props.href}
      className={isActive ? 'active' : ''}
      onClick={handleClick}
      title={props.collapsed ? props.label : undefined}
      aria-label={hasVisibleLabel ? undefined : props.ariaLabel || props.label || undefined}
      aria-current={isActive ? 'page' : undefined}
    >
      {props.icon}
      {!props.collapsed && <span>{props.label}</span>}
    </a>
  )
}

export function ProtectedLayout() {
  const auth = useAuth()
  const session = auth.session
  const loading = auth.loading
  const roleId = auth.roleId
  const roleName = auth.roleName
  const displayName = auth.displayName
  const otpVerified = auth.otpVerified
  const signOut = auth.signOut
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)

  if (loading) {
    return <div className="centered-page">Loading…</div>
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  if (roleId === RoleId.Customer && !otpVerified) {
    return <Navigate to="/login/otp" state={{ from: location.pathname }} replace />
  }

  if (!roleId || !SUPPORTED_ROLE_IDS.includes(roleId)) {
    return (
      <div className="centered-page">
        <div className="card">
          <h1>ClaimShield</h1>
          <p>
            This portal currently only supports the Customer, Surveyor,
            Approver, and Repairer workflows. Your account role
            {roleName ? ' (' + roleName + ')' : ''} isn't covered here yet.
          </p>
          <button type="button" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </div>
    )
  }

  const useSidebar = SIDEBAR_ROLE_IDS.includes(roleId)

  const pageContent = (
    <main className="app-main">
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          <Outlet />
        </motion.div>
      </AnimatePresence>
    </main>
  )

  if (useSidebar) {
    return (
      <div
        className="app-shell app-shell-sidebar"
        style={{ '--sidebar-width': collapsed ? '64px' : '240px' } as React.CSSProperties}
      >
        <header
          className="app-header app-header-slim"
          style={{
            flex: '0 0 64px',
            height: '64px',
            minHeight: '64px',
            maxHeight: '64px',
            margin: 0,
            boxSizing: 'border-box',
          }}
        >
          <span className="brand">
            <motion.span
              className="brand-icon"
              whileHover={{ scale: 1.15, rotate: -8 }}
              transition={{ type: 'spring', stiffness: 400, damping: 12 }}
            >
              <ShieldCheck size={22} strokeWidth={2.2} />
            </motion.span>
            ClaimShield+
          </span>
          <div className="header-right">
            <SidebarLink
              href="/handler/notifications"
              icon={<Bell size={19} color="#ffffff" />}
              label=""
              ariaLabel="Notifications"
            />
            <span className="header-user">
              {displayName} · {roleName}
            </span>
            <button type="button" onClick={() => void signOut()}>
              <LogOut size={16} /> Sign out
            </button>
          </div>
        </header>

        <div
          className="app-body-with-sidebar"
          style={{
            flex: '1 1 auto',
            height: 'calc(100vh - 64px)',
            minHeight: 0,
            margin: 0,
            padding: 0,
            overflow: 'hidden',
          }}
        >
          <aside
            className={collapsed ? 'app-sidebar app-sidebar-collapsed' : 'app-sidebar'}
            style={{
              position: 'relative',
              flex: `0 0 ${collapsed ? '64px' : '240px'}`,
              width: collapsed ? '64px' : '240px',
              minWidth: collapsed ? '64px' : '240px',
              maxWidth: collapsed ? '64px' : '240px',
              height: '100%',
              minHeight: 0,
              margin: 0,
              overflow: 'hidden',
              boxSizing: 'border-box',
            }}
          >
            <button
              type="button"
              className="app-sidebar-toggle"
              onClick={() => setCollapsed((c) => !c)}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                left: 'auto',
                transform: 'none',
                zIndex: 60,
              }}
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
            <nav aria-label="Primary">
              {roleId === RoleId.Surveyor && (
                <>
                  <SidebarLink href="/handler/dashboard" icon={<Gauge size={18} />} label="Dashboard" collapsed={collapsed} />
                  <SidebarLink href="/handler/claims" icon={<FolderKanban size={18} />} label="Claims" collapsed={collapsed} />
                  <SidebarLink href="/handler/reports" icon={<FileText size={18} />} label="Reports" collapsed={collapsed} />
                  <SidebarLink href="/handler/track-claim" icon={<Radar size={18} />} label="Track Claim" collapsed={collapsed} />
                  <SidebarLink href="/handler/register-claim" icon={<FilePlus2 size={18} />} label="Register Claim" collapsed={collapsed} />
                  <SidebarLink href="/handler/notifications" icon={<Bell size={18} />} label="Notifications" collapsed={collapsed} />
                  <SidebarLink href="/handler/help" icon={<HelpCircle size={18} />} label="Help" collapsed={collapsed} />
                </>
              )}
              {(roleId === RoleId.Approver || roleId === RoleId.Admin) && (
                <SidebarLink href="/queue" icon={<ListChecks size={18} />} label="My Queue" collapsed={collapsed} />
              )}
              {(roleId === RoleId.Repairer || roleId === RoleId.Admin) && (
                <SidebarLink href="/repairs" icon={<Wrench size={18} />} label="My Repairs" collapsed={collapsed} />
              )}
              {(roleId === RoleId.Approver || roleId === RoleId.Admin) && (
                <SidebarLink href="/admin/payments" icon={<CreditCard size={18} />} label="Payments" collapsed={collapsed} />
              )}
              {roleId === RoleId.Admin && (
                <>
                  <SidebarLink href="/admin/dashboard" icon={<Gauge size={18} />} label="Dashboard" collapsed={collapsed} />
                  <SidebarLink href="/admin/claims" icon={<ClipboardList size={18} />} label="All Claims" collapsed={collapsed} />
                  <SidebarLink href="/handler/register-claim" icon={<FilePlus2 size={18} />} label="Register Claim" collapsed={collapsed} />
                  <SidebarLink href="/admin/users" icon={<Users size={18} />} label="Users" collapsed={collapsed} />
                  <SidebarLink href="/admin/authority-limits" icon={<SlidersHorizontal size={18} />} label="Authority Limits" collapsed={collapsed} />
                  <SidebarLink href="/admin/scoring-rules" icon={<SlidersHorizontal size={18} />} label="Scoring Rules" collapsed={collapsed} />
                </>
              )}
            </nav>
          </aside>
          {pageContent}
        </div>
        {roleId === RoleId.Surveyor && <ChatAssistant />}
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="brand">
          <motion.span
            className="brand-icon"
            whileHover={{ scale: 1.15, rotate: -8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 12 }}
          >
            <ShieldCheck size={22} strokeWidth={2.2} />
          </motion.span>
          ClaimShield
        </span>
        <nav>
          <SidebarLink href="/dashboard" icon={<LayoutDashboard size={17} />} label="Dashboard" />
          <SidebarLink href="/my-policy" icon={<FileText size={17} />} label="My Policy" />
          <SidebarLink href="/my-vehicle" icon={<Car size={17} />} label="My Vehicle" />
          <SidebarLink href="/my-claims/new" icon={<FilePlus2 size={17} />} label="Raise Claim" />
          <SidebarLink href="/my-claims" icon={<ClipboardList size={17} />} label="My Claims" />
        </nav>
        <div className="header-right">
          <span>
            {displayName} · {roleName}
          </span>
          <button type="button" onClick={() => void signOut()}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </header>
      {pageContent}
      <ChatAssistant />
    </div>
  )
}