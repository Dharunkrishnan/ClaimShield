import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  FileText,
  FilePlus2,
  ClipboardList,
  MapPinned,
  ListChecks,
  Wrench,
  CreditCard,
  Gauge,
  Users,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react'
import { RoleId } from '../lib/roles'

interface NavItemConfig {
  to: string
  label: string
  icon: LucideIcon
  isPrimaryAction?: boolean
  end?: boolean
}

export function MobileBottomNav({ roleId }: { roleId: number }) {
  let navItems: NavItemConfig[] = []

  if (roleId === RoleId.Customer) {
    navItems = [
      { to: '/dashboard', label: 'Home', icon: LayoutDashboard },
      { to: '/my-policy', label: 'Policy', icon: FileText },
      { to: '/my-claims/new', label: 'New Claim', icon: FilePlus2, isPrimaryAction: true },
      { to: '/my-claims', label: 'Claims', icon: ClipboardList, end: true },
      { to: '/track-claim', label: 'Track', icon: MapPinned },
    ]
  } else if (roleId === RoleId.Surveyor) {
    navItems = [
      { to: '/queue', label: 'Queue', icon: ListChecks },
    ]
  } else if (roleId === RoleId.Repairer) {
    navItems = [
      { to: '/repairs', label: 'Repairs', icon: Wrench },
    ]
  } else if (roleId === RoleId.Approver) {
    navItems = [
      { to: '/queue', label: 'Queue', icon: ListChecks },
      { to: '/admin/payments', label: 'Payments', icon: CreditCard },
    ]
  } else if (roleId === RoleId.Admin) {
    navItems = [
      { to: '/admin/dashboard', label: 'Dashboard', icon: Gauge },
      { to: '/admin/claims', label: 'Claims', icon: ClipboardList },
      { to: '/admin/users', label: 'Users', icon: Users },
      { to: '/admin/payments', label: 'Payments', icon: CreditCard },
      { to: '/admin/authority-limits', label: 'Limits', icon: SlidersHorizontal },
    ]
  }

  if (navItems.length === 0) return null

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
      <div className="mobile-bottom-nav-container">
        {navItems.map((item) => {
          const Icon = item.icon
          const isHighlight = item.isPrimaryAction

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `mobile-bottom-nav-item${isActive ? ' is-active' : ''}${
                  isHighlight ? ' is-primary-action' : ''
                }`
              }
              title={item.label}
            >
              {({ isActive }) => (
                <>
                  <span className="mobile-bottom-nav-icon-wrap">
                    <Icon
                      size={isHighlight ? 22 : 20}
                      strokeWidth={isActive || isHighlight ? 2.3 : 1.8}
                      className="mobile-bottom-nav-icon"
                    />
                    {isActive && !isHighlight && (
                      <span className="mobile-bottom-nav-active-pill" aria-hidden="true" />
                    )}
                  </span>
                  <span className="mobile-bottom-nav-label">{item.label}</span>
                </>
              )}
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
