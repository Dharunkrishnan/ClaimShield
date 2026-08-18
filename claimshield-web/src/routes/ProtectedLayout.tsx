import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
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
    <div className="app-shell">
      <header className="app-header">
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
            <ShieldCheck
              size={22}
              strokeWidth={2.2}
            />
          </motion.span>

          ClaimShield
        </span>

        <nav>
          {roleId === RoleId.Customer && (
            <>
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  isActive ? 'active' : ''
                }
              >
                <LayoutDashboard size={17} />
                Dashboard
              </NavLink>

              <NavLink
                to="/my-policy"
                className={({ isActive }) =>
                  isActive ? 'active' : ''
                }
              >
                <FileText size={17} />
                My Policy
              </NavLink>

              <NavLink
                to="/my-vehicle"
                className={({ isActive }) =>
                  isActive ? 'active' : ''
                }
              >
                <Car size={17} />
                My Vehicle
              </NavLink>

              <NavLink
                to="/my-claims/new"
                className={({ isActive }) =>
                  isActive ? 'active' : ''
                }
              >
                <FilePlus2 size={17} />
                Raise Claim
              </NavLink>

              <NavLink
                to="/my-claims"
                end
                className={({ isActive }) =>
                  isActive ? 'active' : ''
                }
              >
                <ClipboardList size={17} />
                My Claims
              </NavLink>
            </>
          )}

          {(roleId === RoleId.Surveyor ||
            roleId === RoleId.Approver ||
            roleId === RoleId.Admin) && (
            <NavLink
              to="/queue"
              className={({ isActive }) =>
                isActive ? 'active' : ''
              }
            >
              <ListChecks size={17} />
              My Queue
            </NavLink>
          )}

          {(roleId === RoleId.Repairer ||
            roleId === RoleId.Admin) && (
            <NavLink
              to="/repairs"
              className={({ isActive }) =>
                isActive ? 'active' : ''
              }
            >
              <Wrench size={17} />
              My Repairs
            </NavLink>
          )}

          {(roleId === RoleId.Approver ||
            roleId === RoleId.Admin) && (
            <NavLink
              to="/admin/payments"
              className={({ isActive }) =>
                isActive ? 'active' : ''
              }
            >
              <CreditCard size={17} />
              Payments
            </NavLink>
          )}

          {roleId === RoleId.Admin && (
            <>
              <NavLink
                to="/admin/dashboard"
                className={({ isActive }) =>
                  isActive ? 'active' : ''
                }
              >
                <Gauge size={17} />
                Dashboard
              </NavLink>

              <NavLink
                to="/admin/claims"
                className={({ isActive }) =>
                  isActive ? 'active' : ''
                }
              >
                <ClipboardList size={17} />
                All Claims
              </NavLink>

              <NavLink
                to="/admin/users"
                className={({ isActive }) =>
                  isActive ? 'active' : ''
                }
              >
                <Users size={17} />
                Users
              </NavLink>

              <NavLink
                to="/admin/authority-limits"
                className={({ isActive }) =>
                  isActive ? 'active' : ''
                }
              >
                <SlidersHorizontal size={17} />
                Authority Limits
              </NavLink>

              <NavLink
                to="/admin/scoring-rules"
                className={({ isActive }) =>
                  isActive ? 'active' : ''
                }
              >
                <SlidersHorizontal size={17} />
                Scoring Rules
              </NavLink>
            </>
          )}
        </nav>

        <div className="header-right">
          <span>
            {displayName} · {roleName}
          </span>

          <button
            type="button"
            onClick={() => void signOut()}
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </header>

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

      {roleId === RoleId.Customer && <ChatAssistant />}
    </div>
  )
}