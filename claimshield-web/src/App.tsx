import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from './routes/LoginPage'
import { LoginOtpPage } from './routes/LoginOtpPage'
import { ProtectedLayout } from './routes/ProtectedLayout'
import { QueuePage } from './routes/QueuePage'
import { ClaimDetailPage } from './routes/ClaimDetailPage'
import { RepairQueuePage } from './routes/RepairQueuePage'
import { RepairAssignmentDetailPage } from './routes/RepairAssignmentDetailPage'
import { MyClaimsPage } from './routes/MyClaimsPage'
import { RaiseClaimPage } from './routes/RaiseClaimPage'
import { MyClaimDetailPage } from './routes/MyClaimDetailPage'
import { MyPolicyPage } from './routes/MyPolicyPage'
import { MyVehiclePage } from './routes/MyVehiclePage'
import { CustomerDashboardPage } from './routes/CustomerDashboardPage'
import { ClaimsHandlerDashboardPage } from './routes/ClaimsHandlerDashboardPage'
import { TrackClaimPage } from './routes/TrackClaimPage'
import { Claim360Page } from './routes/Claim360Page'
import { ClaimsListPage } from './routes/ClaimsListPage'
import { ReportsPage } from './routes/ReportsPage'
import { StaffRegisterClaimPage } from './routes/StaffRegisterClaimPage'
import { HandlerNotificationsPage } from './routes/HandlerNotificationsPage'
import { HandlerHelpPage } from './routes/HandlerHelpPage'
import { AdminOnlyLayout } from './routes/admin/AdminOnlyLayout'
import { UsersPage } from './routes/admin/UsersPage'
import { AdminClaimsPage } from './routes/admin/AdminClaimsPage'
import { AuthorityLimitsPage } from './routes/admin/AuthorityLimitsPage'
import { ScoringRulesPage } from './routes/admin/ScoringRulesPage'
import { AdminPaymentsPage } from './routes/admin/AdminPaymentsPage'
import { DashboardPage } from './routes/admin/DashboardPage'
import { useAuth } from './context/AuthContext'
import { RoleId } from './lib/roles'

function HomeRedirect() {
  const { roleId } = useAuth()
  const target =
    roleId === RoleId.Repairer
      ? '/repairs'
      : roleId === RoleId.Customer
        ? '/dashboard'
        : roleId === RoleId.Admin
          ? '/admin/dashboard'
          : roleId === RoleId.Surveyor
            ? '/handler/dashboard'
            : '/queue'
  return <Navigate to={target} replace />
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/login/otp" element={<LoginOtpPage />} />

      <Route element={<ProtectedLayout />}>
        <Route path="/queue" element={<QueuePage />} />
        <Route path="/claims/:claimId/:stage?" element={<ClaimDetailPage />} />
        <Route path="/repairs" element={<RepairQueuePage />} />
        <Route
          path="/repairs/:repairAssignmentId"
          element={<RepairAssignmentDetailPage />}
        />
        <Route path="/dashboard" element={<CustomerDashboardPage />} />
        <Route path="/handler/dashboard" element={<ClaimsHandlerDashboardPage />} />
        <Route path="/handler/claims" element={<ClaimsListPage />} />
        <Route path="/handler/reports" element={<ReportsPage />} />
        <Route path="/handler/track-claim" element={<TrackClaimPage />} />
        <Route path="/handler/claim-360" element={<Claim360Page />} />
        <Route path="/claims/:claimId/360" element={<Claim360Page />} />
        <Route path="/handler/register-claim" element={<StaffRegisterClaimPage />} />
        <Route path="/handler/notifications" element={<HandlerNotificationsPage />} />
        <Route path="/handler/help" element={<HandlerHelpPage />} />
        <Route path="/my-policy" element={<MyPolicyPage />} />
        <Route path="/my-vehicle" element={<MyVehiclePage />} />
        <Route path="/my-claims" element={<MyClaimsPage />} />
        <Route path="/my-claims/new" element={<RaiseClaimPage />} />
        <Route path="/my-claims/:claimId" element={<MyClaimDetailPage />} />

        {/* Admin + Approver, not Admin-only - gates itself internally */}
        <Route path="/admin/payments" element={<AdminPaymentsPage />} />

        <Route element={<AdminOnlyLayout />}>
          <Route path="/admin/dashboard" element={<DashboardPage />} />
          <Route path="/admin/claims" element={<AdminClaimsPage />} />
          <Route path="/admin/users" element={<UsersPage />} />
          <Route path="/admin/authority-limits" element={<AuthorityLimitsPage />} />
          <Route path="/admin/scoring-rules" element={<ScoringRulesPage />} />
        </Route>

        <Route path="/" element={<HomeRedirect />} />
      </Route>

      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  )
}

export default App