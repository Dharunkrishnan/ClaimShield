import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import {
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
  ChevronLeft,
  ChevronRight,
  Menu,
  ArrowLeft,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { RoleId } from '../lib/roles'
import { ChatAssistant } from '../components/ChatAssistant'
import { getClaim, getPaymentsByClaim, getClaimDecisionStageTimestamps } from '../lib/api'
import type { ClaimResponseDto, PaymentResponseDto } from '../lib/types'
import { Decision } from '../lib/types'
import { ClaimStatus } from '../lib/statuses'
import {
  STAGE_PATHS,
  getClaimStageStates,
} from '../components/ClaimLifecycleStepper'

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

// Same six stages/labels/icons as ClaimLifecycleStepper.tsx - kept as
// a separate list here (rather than importing STAGES directly, which
// isn't exported) since the sidebar's vertical list needs its own
// icon set anyway. STAGE_PATHS and getReachableStageIndex ARE reused
// directly from that file so the "which stage is reachable" logic
// lives in exactly one place, not duplicated.
const SIDEBAR_STAGE_LABELS = [
  'Inspection',
  'Decision Support Risk',
  'Repair Authorization',
  'Liability',
  'Approval',
  'Closure',
] as const

function formatStageTimestamp(value: string | null | undefined): string | null {
  if (!value) return null
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// Minimal shape actually needed for stage timestamps - deliberately
// NOT the full ClaimDecisionResponseDto. getClaimDecisionStageTimestamps
// is a narrower endpoint (role/decision/date only, no reasoning text
// or AI scores - see the privacy note where it's called below), so
// its real return type is very likely named/shaped differently. Using
// this minimal structural type here means it works correctly whatever
// that type is actually called, as long as it has these three fields.
interface StageDecisionInfo {
  roleId: number
  decision: number
  decisionDate: string
}

// Same isMakerCheckerDecision filter used in ClaimDetailPage.tsx -
// administrative rows (Hold/Resume/Return-for-Rework/Request Info)
// share the same ClaimDecisions table but aren't real
// Approve/Review/Deny decisions, so they're excluded here too for
// the same reason: an admin action shouldn't be mistaken for the
// actual stage-completing decision.
function isMakerCheckerDecision(d: StageDecisionInfo) {
  return d.decision === Decision.Approve || d.decision === Decision.Review || d.decision === Decision.Deny
}

// One timestamp per stage, from whichever real field/record actually
// represents that stage completing - not every stage has a direct
// field on the claim itself:
// - Inspection: claim.surveyDate
// - Decision Support Risk: the Surveyor's own maker-checker decision
// - Repair Authorization / Liability: direct claim fields
// - Approval: the Approver's maker-checker decision
// - Closure: claim.updatedDate as a last-resort proxy, and ONLY when
//   the claim is actually Closed - updatedDate changes on any edit,
//   so it's not trustworthy as "closure time" otherwise.
function getStageTimestamps(
  claim: ClaimResponseDto,
  decisions: StageDecisionInfo[],
): (string | null)[] {
  const surveyorDecision = decisions.find(
    (d) => isMakerCheckerDecision(d) && d.roleId === RoleId.Surveyor,
  )
  const approverDecision = decisions.find(
    (d) => isMakerCheckerDecision(d) && d.roleId === RoleId.Approver,
  )

  return [
    claim.surveyDate,
    surveyorDecision?.decisionDate ?? null,
    claim.repairAuthorizationDate,
    claim.liabilitySubmittedDate,
    approverDecision?.decisionDate ?? null,
    claim.statusId === ClaimStatus.Closed ? claim.updatedDate : null,
  ]
}

interface SidebarLinkProps {
  href: string
  icon: ReactNode
  label: string
  collapsed?: boolean
  index?: number
}

// Modern sidebar nav link: a Framer Motion layoutId-based "morphing
// pill" background that smoothly slides and reshapes from whichever
// item was previously active to this one, instead of the active
// background just instantly appearing/disappearing on click. Every
// SidebarLink sharing the same layoutId ("sidebar-active-pill") is
// treated as the same underlying element by Framer Motion, so it
// automatically animates the transition between whichever one is
// currently rendering it. The icon-scale-on-hover and row-slide-on-
// hover effects are plain CSS (see .app-sidebar nav a in index.css)
// since those don't need any shared state between elements.
function SidebarLink(props: SidebarLinkProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const current = location.pathname + location.search
  const isActive = current === props.href

  function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault()
    navigate(props.href)
  }

  return (
    <motion.a
      href={props.href}
      className={isActive ? 'active' : ''}
      onClick={handleClick}
      title={props.collapsed ? props.label : undefined}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: (props.index ?? 0) * 0.04 }}
    >
      {isActive && (
        <motion.span
          layoutId="sidebar-active-pill"
          className="sidebar-active-pill"
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        />
      )}
      <span className="sidebar-link-content">
        {props.icon}
        {!props.collapsed && <span>{props.label}</span>}
      </span>
    </motion.a>
  )
}

// Matches a claim detail URL (e.g. /claims/<uuid> or
// /claims/<uuid>/liability) and extracts the claim id - parsed
// directly from the path rather than via useParams(), since
// ProtectedLayout is a parent layout and shouldn't need to know the
// exact :claimId param name used by whichever nested route actually
// matches underneath it.
const CLAIM_ROUTE_PATTERN =
  /^\/claims\/([0-9a-fA-F-]{36})(?:\/([a-z0-9-]+))?/

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
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  // ----------------------------------------------------------------
  // CLAIM WORKFLOW SIDEBAR MODE
  //
  // While inside a specific claim's pages (matched purely from the
  // URL - /claims/<id>...), the sidebar swaps from the normal
  // role-based navigation to a vertical list of that claim's six
  // lifecycle stages, with an "Exit claim" link back to normal
  // navigation. Leaving the claim (URL no longer matches) reverts the
  // sidebar automatically on the next render, since claimIdInRoute
  // simply becomes null again - no separate "exit" state to manage.
  // ----------------------------------------------------------------

  const claimRouteMatch = location.pathname.match(CLAIM_ROUTE_PATTERN)
  const claimIdInRoute = claimRouteMatch?.[1] ?? null
  const stageSlugInRoute = claimRouteMatch?.[2] ?? null
  // Whether this URL genuinely belongs to the workflow: either a real
  // stage segment (inspection, liability, etc.) OR no segment at all -
  // a bare /claims/<id> defaults to Inspection (matching
  // ClaimDetailPage.tsx's own `stage = stageParam ?? 'inspection'`
  // default), which is how most links into a claim actually navigate
  // (Notifications, Reports, Register Claim, Track Claim, Queue, Admin
  // Claims/Payments all link to the bare URL, not an explicit stage).
  // Only an explicitly different, non-stage segment - like Claim 360's
  // /claims/<id>/360 - should be excluded.
  const isActualWorkflowStage =
    stageSlugInRoute === null ||
    STAGE_PATHS.includes(stageSlugInRoute as (typeof STAGE_PATHS)[number])
  // The stage slug currently being viewed (e.g. "inspection"),
  // straight from the URL - this is what determines which stage is
  // highlighted as "active" in the sidebar. Deliberately NOT the same
  // thing as reachableIndex below (the claim's furthest-reached
  // stage) - those can genuinely differ, e.g. viewing "Inspection"
  // on a claim that's already progressed to "Closure" should
  // highlight Inspection, not Closure.
  const currentStageSlug = isActualWorkflowStage
    ? (stageSlugInRoute ?? STAGE_PATHS[0])
    : STAGE_PATHS[0]

  const [workflowClaim, setWorkflowClaim] = useState<ClaimResponseDto | null>(null)
  const [workflowPayments, setWorkflowPayments] = useState<PaymentResponseDto[]>([])
  const [workflowDecisions, setWorkflowDecisions] = useState<StageDecisionInfo[]>([])

  // Reusable so ClaimDetailPage (via Outlet context below) can trigger
  // a refresh after any lifecycle action succeeds there - without
  // this, ClaimDetailPage's own state updates fine after e.g.
  // completing an inspection, but this sidebar has no way to know the
  // claim's status actually changed until a full page reload.
  const refreshClaimWorkflow = useCallback(async () => {
    if (!claimIdInRoute) {
      setWorkflowClaim(null)
      setWorkflowPayments([])
      setWorkflowDecisions([])
      return
    }

    const [claim, payments, decisions] = await Promise.all([
      getClaim(claimIdInRoute).catch(() => null),
      getPaymentsByClaim(claimIdInRoute).catch(() => []),
      // Role/decision/date only, no reasoning text or AI scores -
      // deliberately NOT getDecisionHistory, which is restricted to
      // Approver/Admin and would 403 for a Surveyor viewing their own
      // claim's sidebar. This narrower endpoint exists specifically so
      // the sidebar's stage timestamps work for every role that uses
      // it, without exposing an Approver's private reasoning/scoring
      // data to a Surveyor.
      getClaimDecisionStageTimestamps(claimIdInRoute).catch(() => []),
    ])

    setWorkflowClaim(claim)
    setWorkflowPayments(payments)
    setWorkflowDecisions(decisions)
  }, [claimIdInRoute])

  useEffect(() => {
    void refreshClaimWorkflow()
  }, [refreshClaimWorkflow])

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
  const inClaimWorkflow =
    useSidebar && claimIdInRoute != null && workflowClaim != null && isActualWorkflowStage

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
          <Outlet context={{ refreshClaimWorkflow }} />
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
          <button
            type="button"
            className="app-mobile-menu-toggle"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            <Menu size={22} color="#ffffff" />
          </button>
          <span className="brand">
            <motion.span
              className="brand-icon"
              whileHover={{ scale: 1.15, rotate: -8 }}
              transition={{ type: 'spring', stiffness: 400, damping: 12 }}
            >
              <img src="/favicon.svg" alt="" width={22} height={22} />
            </motion.span>
            ClaimShield+
          </span>
          <div className="header-right">
            {/* Plain link, NOT a SidebarLink: SidebarLink renders the
                shared "sidebar-active-pill" (Framer layoutId). Using it
                here meant that on /handler/notifications two pills with
                the same layoutId existed at once, and the header one
                stretched over the whole header (hiding the brand and
                user name) and fought with the sidebar pill on hover. */}
            <a
              href="/handler/notifications"
              className="header-icon-link"
              aria-label="Notifications"
              title="Notifications"
              onClick={(event) => {
                event.preventDefault()
                navigate('/handler/notifications')
              }}
            >
              <Bell size={19} color="#ffffff" />
            </a>
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
          {mobileMenuOpen && (
            <div
              className="app-mobile-menu-backdrop"
              onClick={() => setMobileMenuOpen(false)}
            />
          )}
          <aside
            className={
              (collapsed ? 'app-sidebar app-sidebar-collapsed' : 'app-sidebar') +
              (mobileMenuOpen ? ' app-sidebar-mobile-open' : '') +
              (inClaimWorkflow ? ' app-sidebar-claim-workflow' : '')
            }
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

            {inClaimWorkflow ? (
              <nav className="app-sidebar-claim-nav">
                <button
                  type="button"
                  className="app-sidebar-exit-claim"
                  onClick={() => navigate(`/claims/${claimIdInRoute}/360`)}
                >
                  <ArrowLeft size={16} />
                  {!collapsed && <span>Exit claim</span>}
                </button>

                {!collapsed && (
                  <p className="app-sidebar-claim-number">
                    {workflowClaim!.claimNumber}
                  </p>
                )}

                {(() => {
                  const stageStates = getClaimStageStates(
                    workflowClaim!.statusId,
                    workflowPayments,
                    workflowClaim!.repairAuthorizationStatusId,
                    workflowClaim!.liabilitySubmitted,
                  )
                  const currentStageIndex = STAGE_PATHS.indexOf(
                    currentStageSlug as (typeof STAGE_PATHS)[number],
                  )
                  const stageTimestamps = getStageTimestamps(workflowClaim!, workflowDecisions)

                  return SIDEBAR_STAGE_LABELS.map((label, index) => {
                    // Uses the real per-stage state array (identical
                    // to what the horizontal stepper itself renders)
                    // rather than deriving "complete" from a single
                    // reachable-index number - that reconstruction is
                    // exactly what produced the earlier bug where a
                    // fully-closed claim's LAST stage never showed as
                    // complete (index < reachableIndex excludes the
                    // stage at reachableIndex itself, but on a Closed
                    // claim every single stage, including the last
                    // one, genuinely is "complete").
                    const stageState = stageStates[index]
                    const isComplete = stageState === 'complete'
                    const isRejected = stageState === 'rejected'
                    const isActive = stageState === 'active'
                    const isReachable = stageState !== 'upcoming'
                    // "Currently viewing this page" - deliberately
                    // separate from the claim's own stage state, since
                    // those answer different questions (see
                    // currentStageSlug above).
                    const isCurrentPage = index === currentStageIndex

                    return (
                      <a
                        key={label}
                        href={`/claims/${claimIdInRoute}/${STAGE_PATHS[index]}`}
                        className={
                          'app-sidebar-claim-stage' +
                          (isCurrentPage ? ' current-page' : '') +
                          (!isReachable ? ' unreachable' : '')
                        }
                        title={collapsed ? label : undefined}
                        onClick={(event) => {
                          event.preventDefault()
                          if (isReachable) {
                            navigate(`/claims/${claimIdInRoute}/${STAGE_PATHS[index]}`)
                          }
                        }}
                      >
                        <span className="app-sidebar-claim-stage-rail">
                          <span
                            className={
                              'app-sidebar-claim-stage-icon' +
                              (isComplete ? ' complete' : '') +
                              (isActive ? ' active' : '') +
                              (isRejected ? ' rejected' : '')
                            }
                          >
                            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                              <path
                                className="app-sidebar-claim-stage-shield-fill"
                                d="M12 2L4 5v6c0 5 3.4 9 8 11 4.6-2 8-6 8-11V5l-8-3z"
                              />
                              {isComplete && (
                                <path
                                  className="app-sidebar-claim-stage-check"
                                  d="M8.5 12l2.5 2.5 5-5"
                                  stroke="white"
                                  strokeWidth="2.2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              )}
                              {isRejected && (
                                <path
                                  className="app-sidebar-claim-stage-check"
                                  d="M9 9l6 6M15 9l-6 6"
                                  stroke="white"
                                  strokeWidth="2.2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              )}
                            </svg>
                            {!isComplete && !isRejected && (
                              <span className="app-sidebar-claim-stage-number">
                                {index + 1}
                              </span>
                            )}
                          </span>
                          {index < SIDEBAR_STAGE_LABELS.length - 1 && (
                            <span
                              className={
                                'app-sidebar-claim-stage-connector' +
                                (isComplete ? ' complete' : '')
                              }
                            >
                              <span className="app-sidebar-claim-stage-arrow" />
                            </span>
                          )}
                        </span>
                        {!collapsed && (
                          <span className="app-sidebar-claim-stage-text">
                            <span>{label}</span>
                            {isComplete && formatStageTimestamp(stageTimestamps[index]) && (
                              <span className="app-sidebar-claim-stage-timestamp">
                                {formatStageTimestamp(stageTimestamps[index])}
                              </span>
                            )}
                            {stageState === 'active' && (
                              <span className="app-sidebar-claim-stage-timestamp">
                                In progress
                              </span>
                            )}
                          </span>
                        )}
                      </a>
                    )
                  })
                })()}
              </nav>
            ) : (
              <nav>
                {roleId === RoleId.Surveyor && (
                  <>
                    <SidebarLink href="/handler/dashboard" icon={<Gauge size={18} />} label="Dashboard" collapsed={collapsed} index={0} />
                    <SidebarLink href="/handler/claims" icon={<FolderKanban size={18} />} label="Claims" collapsed={collapsed} index={1} />
                    <SidebarLink href="/handler/reports" icon={<FileText size={18} />} label="Reports" collapsed={collapsed} index={2} />
                    <SidebarLink href="/handler/register-claim" icon={<FilePlus2 size={18} />} label="Register Claim" collapsed={collapsed} index={3} />
                    <SidebarLink href="/handler/notifications" icon={<Bell size={18} />} label="Notifications" collapsed={collapsed} index={4} />
                    <SidebarLink href="/handler/help" icon={<HelpCircle size={18} />} label="Help" collapsed={collapsed} index={5} />
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
            )}
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
            <img src="/favicon.svg" alt="" width={22} height={22} />
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