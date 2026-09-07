import { supabase } from './supabaseClient'
import type {
  AiChatRequest,
  AiChatResponse,
  AuditLogResponseDto,
  AuthorityLimitResponseDto,
  ClaimDecisionResponseDto,
  ClaimDocumentResponseDto,
  ClaimQueueItemResponseDto,
  ClaimResponseDto,
  ClaimSettlementResponseDto,
  ClaimsHandlerDashboardSummaryDto,
  CustomerClaimScoreDto,
  CustomerResponseDto,
  DashboardSummaryDto,
  DecisionSupportSummaryDto,
  EstimateOrNotEligibleResponse,
  InstantClaimEligibilityResponseDto,
  InstantClaimPartsPricingResponseDto,
  InstantClaimRateCardResponseDto,
  InternalClaimScoringDto,
  OtpSendResultDto,
  OtpVerifyResultDto,
  PaymentResponseDto,
  OcrExtractionResultDto,
  InvoiceResponseDto,
  TatPerformanceResponseDto,
  PolicyResponseDto,
  RaiseStep1Request,
  RaiseStep1ResponseDto,
  RaiseStep2Request,
  RaiseStep2ResponseDto,
  ReassessmentCommentResponseDto,
  RepairAssignmentResponseDto,
  RepairEstimateResponseDto,
  RoleResponseDto,
  SaveSurveyAssessmentRequest,
  ScoringRuleResponseDto,
  ScoringThresholdResponseDto,
  StaffRegisterClaimRequest,
  UpdateClaimDetailsRequest,
  UpdateRepairAuthorizationRequest,
  UpdateApprovedAmountRequest,
  LiabilityDamageItemResponseDto,
  UpdateLiabilityDamageItemsRequest,
  UpdateLiabilityFiguresRequest,
  UpdatePolicyRequest,
  UpdateVehicleRequest,
  UpdateCustomerRequest,
  SurveyAssessmentResponseDto,
  SurveyAssignmentResponseDto,
  UserResponseDto,
  VehicleResponseDto,
} from './types'

// Trailing slash stripped so `${apiBaseUrl}${path}` never produces a
// double slash regardless of how VITE_API_BASE_URL happens to be set
// (e.g. a dev tunnel URL saved with a trailing slash) - a double
// slash right after the host doesn't match any ASP.NET Core route,
// silently producing 404s on every request.
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string).replace(/\/+$/, '')

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const headers: Record<string, string> = {}

  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`
  }

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  const text = await response.text()
  const parsed = text ? JSON.parse(text) : null

  if (!response.ok) {
    const message =
      (parsed && typeof parsed === 'object' && 'message' in parsed
        ? String((parsed as { message: unknown }).message)
        : null) ?? `Request failed with status ${response.status}`

    throw new ApiError(response.status, message)
  }

  return parsed as T
}

async function requestForm<T>(path: string, formData: FormData): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const headers: Record<string, string> = {}

  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    headers,
    body: formData,
  })

  const text = await response.text()
  const parsed = text ? JSON.parse(text) : null

  if (!response.ok) {
    const message =
      (parsed && typeof parsed === 'object' && 'message' in parsed
        ? String((parsed as { message: unknown }).message)
        : null) ?? `Request failed with status ${response.status}`

    throw new ApiError(response.status, message)
  }

  return parsed as T
}

// fetch() has no upload-progress API, so the animated per-file progress
// bar (Phase 12's UploadCard) needs XMLHttpRequest specifically for
// this one call - requestForm above stays as the fetch-based default
// for every other multipart upload in the app.
function requestFormWithProgress<T>(
  path: string,
  formData: FormData,
  onProgress: (percent: number) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', `${apiBaseUrl}${path}`)

      if (session?.access_token) {
        xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`)
      }

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100))
        }
      }

      xhr.onload = () => {
        const parsed = xhr.responseText ? JSON.parse(xhr.responseText) : null

        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(parsed as T)
        } else {
          const message =
            (parsed && typeof parsed === 'object' && 'message' in parsed
              ? String((parsed as { message: unknown }).message)
              : null) ?? `Request failed with status ${xhr.status}`
          reject(new ApiError(xhr.status, message))
        }
      }

      xhr.onerror = () => reject(new ApiError(0, 'Network error during upload.'))

      xhr.send(formData)
    })
  })
}

// =================================================================
// Claims
// =================================================================

export const getClaim = (claimId: string) =>
  request<ClaimResponseDto>(`/api/Claims/${claimId}`)

export const getMyClaims = (customerId: string) =>
  request<ClaimResponseDto[]>(`/api/Claims/customer/${customerId}`)

export const getAllClaims = () => request<ClaimResponseDto[]>('/api/Claims')

export const sendAiChatMessage = (input: AiChatRequest) =>
  request<AiChatResponse>('/api/Ai/chat', {
    method: 'POST',
    body: input,
  })

export const createClaim = (input: {
  policyId: string
  vehicleId: string
  incidentDate: string
  incidentLocation: string
  incidentDescription: string
  estimatedLossAmount: number | null
}) =>
  request<ClaimResponseDto>('/api/Claims', {
    method: 'POST',
    body: {
      ...input,
      // CustomerId is ignored/overridden server-side for a Customer
      // caller, but the DTO still requires a value be present.
      customerId: '00000000-0000-0000-0000-000000000000',
    },
  })

export const closeClaim = (claimId: string, closureReasonId: number, remarks: string) =>
  request<{ success: boolean; message: string }>(`/api/Claims/${claimId}/close`, {
    method: 'POST',
    body: { closureReasonId, remarks },
  })

// Closes or denies a claim directly from the Repair Authorization
// stage, bypassing Liability entirely - distinct from closeClaim
// above, which only works once a claim is already Settled/Rejected.
export const closeOrDenyFromRepairAuthorization = (
  claimId: string,
  action: 'Closure' | 'Denial',
  reasonId: number,
  remarks: string,
) =>
  request<{ success: boolean; message: string }>(
    `/api/Claims/${claimId}/repair-authorization/close-or-deny`,
    {
      method: 'POST',
      body: {
        action,
        closureReasonId: action === 'Closure' ? reasonId : null,
        denialReasonId: action === 'Denial' ? reasonId : null,
        remarks,
      },
    },
  )

// Claim 360 - narrower than a full claim update (see
// UpdateClaimDetailsRequest on the backend for why): only touches
// incident-detail fields, never status/approved amount/policy/
// customer/vehicle linkage, so it's safe for Surveyor/Approver too.
export const updateClaimDetails = (request_: UpdateClaimDetailsRequest) =>
  request<{ success: boolean; message: string }>(
    `/api/Claims/${request_.claimId}/details`,
    { method: 'PATCH', body: request_ },
  )

// Repair Authorization stage - see UpdateRepairAuthorizationRequest.
export const updateRepairAuthorization = (request_: UpdateRepairAuthorizationRequest) =>
  request<{ success: boolean; message: string }>(
    `/api/Claims/${request_.claimId}/repair-authorization`,
    { method: 'PATCH', body: request_ },
  )

// Liability stage - see UpdateApprovedAmountRequest.
export const updateApprovedAmount = (request_: UpdateApprovedAmountRequest) =>
  request<{ success: boolean; message: string }>(
    `/api/Claims/${request_.claimId}/approved-amount`,
    { method: 'PATCH', body: request_ },
  )

// Liability stage - see UpdateLiabilityFiguresRequest.
export const updateLiabilityFigures = (request_: UpdateLiabilityFiguresRequest) =>
  request<{ success: boolean; message: string }>(
    `/api/Claims/${request_.claimId}/liability-figures`,
    { method: 'PATCH', body: request_ },
  )

// Liability stage - the "I'm done, unlock Approval" action.
export const submitLiability = (claimId: string) =>
  request<{ success: boolean; message: string }>(
    `/api/Claims/${claimId}/submit-liability`,
    { method: 'POST' },
  )

// Liability stage - per-component damage table.
export const getLiabilityDamageItems = (claimId: string) =>
  request<LiabilityDamageItemResponseDto[]>(
    `/api/Claims/${claimId}/liability-damage-items`,
  )

export const updateLiabilityDamageItems = (request_: UpdateLiabilityDamageItemsRequest) =>
  request<{ success: boolean; message: string }>(
    `/api/Claims/${request_.claimId}/liability-damage-items`,
    { method: 'PATCH', body: request_ },
  )

// =================================================================
// Customers / Policies / Vehicles
// =================================================================

export const getMyCustomerProfile = () =>
  request<CustomerResponseDto>('/api/Customers/me')

export const getMyPolicies = (customerId: string) =>
  request<PolicyResponseDto[]>(`/api/Policies/customer/${customerId}`)

export const getMyVehicles = (customerId: string) =>
  request<VehicleResponseDto[]>(`/api/Vehicles/customer/${customerId}`)

// Claim 360 - these PUT endpoints already existed (Admin-only, used by
// admin CRUD pages elsewhere) and were widened to Surveyor/Approver
// specifically so Claim 360 can genuinely persist edits, not just
// display data. Unlike Claim.StatusId/ApprovedAmount, these Policy/
// Vehicle/Customer fields aren't gated by any workflow engine, so
// there's no bypass risk in opening them up the same way.
export const updatePolicy = (request_: UpdatePolicyRequest) =>
  request<{ message: string }>('/api/Policies', { method: 'PUT', body: request_ })

export const updateVehicle = (request_: UpdateVehicleRequest) =>
  request<{ message: string }>('/api/Vehicles', { method: 'PUT', body: request_ })

export const updateCustomer = (request_: UpdateCustomerRequest) =>
  request<{ message: string }>('/api/Customers', { method: 'PUT', body: request_ })

// Checkpoint 5 (Module 3) - staff-assisted claim registration lookups.
export const getAllCustomers = () =>
  request<CustomerResponseDto[]>('/api/Customers')

// Checkpoint 9 - lets the Register Claim form auto-fill customer/policy/
// vehicle from a single Policy Number lookup instead of separate
// dropdowns.
export const getAllPoliciesForLookup = () =>
  request<PolicyResponseDto[]>('/api/Policies')

export const getRepairers = () =>
  request<UserResponseDto[]>('/api/ClaimRegistration/repairers')

// =================================================================
// Scoring (Phase 9 two-stage rules-based engine)
//
// Same endpoint for every caller - the API shapes the response by
// role. Typed separately per caller since each page already knows
// its own role; a Customer must never receive rule-level detail.
// =================================================================

export const getMyClaimScore = (claimId: string) =>
  request<CustomerClaimScoreDto>(`/api/Claims/${claimId}/scoring-results`)

export const getInternalClaimScoring = (claimId: string) =>
  request<InternalClaimScoringDto>(`/api/Claims/${claimId}/scoring-results`)

export const getScoringRules = (stage?: number) =>
  request<ScoringRuleResponseDto[]>(
    stage ? `/api/ScoringRules?stage=${stage}` : '/api/ScoringRules',
  )

export const createScoringRule = (input: {
  stage: number
  category: string
  conditionField: string
  conditionOperator: string
  conditionThreshold: string
  severity: number
  points: number
}) =>
  request<{ success: boolean; message: string; rule: ScoringRuleResponseDto }>(
    '/api/ScoringRules',
    { method: 'POST', body: input },
  )

export const updateScoringRule = (
  ruleId: string,
  input: {
    category: string
    conditionField: string
    conditionOperator: string
    conditionThreshold: string
    severity: number
    points: number
  },
) =>
  request<{ success: boolean; message: string; rule: ScoringRuleResponseDto }>(
    `/api/ScoringRules/${ruleId}`,
    { method: 'PUT', body: input },
  )

export const toggleScoringRule = (ruleId: string) =>
  request<{ success: boolean; message: string; rule: ScoringRuleResponseDto }>(
    `/api/ScoringRules/${ruleId}/toggle-active`,
    { method: 'PATCH' },
  )

export const getScoringThresholds = () =>
  request<ScoringThresholdResponseDto>('/api/ScoringThresholds').catch(
    (error: unknown) => {
      if (error instanceof ApiError && error.status === 404) {
        return null
      }
      throw error
    },
  )

export const updateScoringThresholds = (amberMin: number, redMin: number) =>
  request<{
    success: boolean
    message: string
    threshold: ScoringThresholdResponseDto
  }>('/api/ScoringThresholds', {
    method: 'PUT',
    body: { amberMin, redMin },
  })

// =================================================================
// Decisions
// =================================================================

export const getMyQueue = () =>
  request<ClaimQueueItemResponseDto[]>('/api/ClaimDecisions/my-queue')

export const getLatestDecision = (claimId: string) =>
  request<ClaimDecisionResponseDto | null>(
    `/api/ClaimDecisions/claim/${claimId}`,
  ).catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 404) {
      return null
    }
    throw error
  })

export const getDecisionHistory = (claimId: string) =>
  request<ClaimDecisionResponseDto[]>(
    `/api/ClaimDecisions/claim/${claimId}/history`,
  )

export const submitSurveyorDecision = (
  claimId: string,
  decision: number,
  reasoning: string,
) =>
  request<{ success: boolean; message: string; escalated: boolean }>(
    `/api/ClaimDecisions/${claimId}/surveyor-decision`,
    { method: 'POST', body: { decision, reasoning } },
  )

export const submitApproverDecision = (
  claimId: string,
  decision: number,
  reasoning: string,
) =>
  request<{ success: boolean; message: string }>(
    `/api/ClaimDecisions/${claimId}/approver-decision`,
    { method: 'POST', body: { decision, reasoning } },
  )

// =================================================================
// Checkpoint 5 (Module 5) - On Hold / Resume, Return for Rework,
// Request Additional Information
// =================================================================

export const holdClaim = (claimId: string, reason: string) =>
  request<{ success: boolean; message: string; claimStatusId: number }>(
    `/api/ClaimDecisions/${claimId}/hold`,
    { method: 'POST', body: { reason } },
  )

export const resumeClaim = (claimId: string) =>
  request<{ success: boolean; message: string; claimStatusId: number }>(
    `/api/ClaimDecisions/${claimId}/resume`,
    { method: 'POST' },
  )

export const returnForRework = (claimId: string, remarks: string) =>
  request<{ success: boolean; message: string; claimStatusId: number }>(
    `/api/ClaimDecisions/${claimId}/return-for-rework`,
    { method: 'POST', body: { remarks } },
  )

export const requestAdditionalInfo = (
  claimId: string,
  reason: string,
  fromRoleId: number,
) =>
  request<{ success: boolean; message: string }>(
    `/api/ClaimDecisions/${claimId}/request-info`,
    { method: 'POST', body: { reason, fromRoleId } },
  )

export const clearInfoRequest = (claimId: string) =>
  request<{ success: boolean; message: string }>(
    `/api/ClaimDecisions/${claimId}/clear-info-request`,
    { method: 'POST' },
  )

// =================================================================
// Reassessment comments
// =================================================================

export const getReassessmentComments = (claimId: string) =>
  request<ReassessmentCommentResponseDto[]>(
    `/api/ReassessmentComments/claim/${claimId}`,
  )

export const postReassessmentComment = (claimId: string, comment: string) =>
  request<ReassessmentCommentResponseDto>('/api/ReassessmentComments', {
    method: 'POST',
    body: { claimId, comment },
  })

// =================================================================
// Documents
// =================================================================

export const getClaimDocuments = (claimId: string) =>
  request<ClaimDocumentResponseDto[]>(`/api/ClaimDocuments/claim/${claimId}`)

export const getDocumentDownloadUrl = (claimDocumentId: string) =>
  request<{ url: string; expiresInSeconds: number }>(
    `/api/ClaimDocuments/${claimDocumentId}/download-url`,
  )

export const uploadClaimDocument = (
  claimId: string,
  documentTypeId: number,
  file: File,
) => {
  const formData = new FormData()
  formData.append('claimId', claimId)
  formData.append('documentTypeId', String(documentTypeId))
  formData.append('file', file)

  return requestForm<ClaimDocumentResponseDto>('/api/ClaimDocuments/upload', formData)
}

// Lightweight OCR extraction for the staff Register Claim flow - runs
// on a document that isn't attached to any claim yet (the claim
// doesn't exist until the form is submitted), so this just returns
// whatever the document contains rather than persisting anything.
export const extractDocumentOcr = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)

  return requestForm<OcrExtractionResultDto>('/api/Ocr/extract', formData)
}

// Liability stage - Invoice Particulars
export const getClaimInvoices = (claimId: string) =>
  request<InvoiceResponseDto[]>(`/api/ClaimInvoices/claim/${claimId}`)

export const createClaimInvoice = (
  claimId: string,
  input: {
    invoiceDate: string
    invoiceNumber: string
    invoiceAmount: number
    invoiceFavour: number
  },
) =>
  request<InvoiceResponseDto>(`/api/ClaimInvoices/claim/${claimId}`, {
    method: 'POST',
    body: input,
  })

export const updateClaimInvoice = (
  claimInvoiceId: string,
  input: {
    invoiceDate: string
    invoiceNumber: string
    invoiceAmount: number
    invoiceFavour: number
  },
) =>
  request<InvoiceResponseDto>(`/api/ClaimInvoices/${claimInvoiceId}`, {
    method: 'PUT',
    body: input,
  })

export const deleteClaimInvoice = (claimInvoiceId: string) =>
  request<{ success: boolean }>(`/api/ClaimInvoices/${claimInvoiceId}`, {
    method: 'DELETE',
  })

// Used by UploadCard (Phase 12) for a live per-file progress bar.
export const uploadClaimDocumentWithProgress = (
  claimId: string,
  documentTypeId: number,
  file: File,
  onProgress: (percent: number) => void,
) => {
  const formData = new FormData()
  formData.append('claimId', claimId)
  formData.append('documentTypeId', String(documentTypeId))
  formData.append('file', file)

  return requestFormWithProgress<ClaimDocumentResponseDto>(
    '/api/ClaimDocuments/upload',
    formData,
    onProgress,
  )
}

// =================================================================
// Repair assignments / estimates
// =================================================================

export const getMyRepairAssignments = (repairerId: string) =>
  request<RepairAssignmentResponseDto[]>(
    `/api/RepairAssignments/repairer/${repairerId}`,
  )

export const getRepairAssignmentsByClaim = (claimId: string) =>
  request<RepairAssignmentResponseDto[]>(
    `/api/RepairAssignments/claim/${claimId}`,
  )

export const getRepairAssignment = (repairAssignmentId: string) =>
  request<RepairAssignmentResponseDto>(
    `/api/RepairAssignments/${repairAssignmentId}`,
  )

export const getRepairEstimatesByAssignment = (repairAssignmentId: string) =>
  request<RepairEstimateResponseDto[]>(
    `/api/RepairEstimates/assignment/${repairAssignmentId}`,
  )

export const getRepairEstimatesByClaim = (claimId: string) =>
  request<RepairEstimateResponseDto[]>(`/api/RepairEstimates/claim/${claimId}`)

export const submitRepairEstimate = (
  repairAssignmentId: string,
  claimId: string,
  estimatedAmount: number,
  estimatedCompletionDays: number | null,
  estimateRemarks: string,
) =>
  request<RepairEstimateResponseDto>('/api/RepairEstimates', {
    method: 'POST',
    body: {
      repairAssignmentId,
      claimId,
      estimatedAmount,
      estimatedCompletionDays,
      estimateRemarks,
    },
  })

export const approveRepairEstimate = (
  repairEstimateId: string,
  approvedAmount: number,
  remarks: string,
) =>
  request<{ success: boolean; message: string }>(
    `/api/RepairEstimates/${repairEstimateId}/approve`,
    { method: 'POST', body: { approvedAmount, remarks } },
  )

export const rejectRepairEstimate = (repairEstimateId: string, remarks: string) =>
  request<{ success: boolean; message: string }>(
    `/api/RepairEstimates/${repairEstimateId}/reject`,
    { method: 'POST', body: { remarks } },
  )

// Full-object PUT, matching RepairAssignmentService.UpdateAsync's
// existing overwrite-every-field convention - only assignmentStatusId
// actually changes.
export const updateRepairAssignmentStatus = (
  assignment: RepairAssignmentResponseDto,
  assignmentStatusId: number,
) =>
  request<{ success: boolean; message: string }>('/api/RepairAssignments', {
    method: 'PUT',
    body: {
      repairAssignmentId: assignment.repairAssignmentId,
      claimId: assignment.claimId,
      repairerId: assignment.repairerId,
      assignedBy: assignment.assignedBy,
      assignedDate: assignment.assignedDate,
      expectedCompletionDate: assignment.expectedCompletionDate,
      assignmentStatusId,
      remarks: assignment.remarks,
    },
  })

// =================================================================
// Payments
//
// fail/cancel bind against the API's [FromBody] string? remarks - a
// raw JSON string, not an object - so body must be the bare string.
// =================================================================

export const getAllPayments = () => request<PaymentResponseDto[]>('/api/Payments')

export const getPayment = (paymentId: string) =>
  request<PaymentResponseDto>(`/api/Payments/${paymentId}`)

export const getPaymentsByClaim = (claimId: string) =>
  request<PaymentResponseDto[]>(`/api/Payments/claim/${claimId}`)

export const createPayment = (input: {
  claimId: string
  amount: number
  transactionReference: string
  remarks: string
  paymentMethodId: number
  payeeType: number
  payeeCode: string
  beneficiaryName: string
  bankAccountNumber: string
  ifscCode: string
  bankName: string
  branchName: string
  mobileNumber: string
}) =>
  request<PaymentResponseDto>('/api/Payments', {
    method: 'POST',
    body: {
      claimId: input.claimId,
      amount: input.amount,
      transactionReference: input.transactionReference || null,
      remarks: input.remarks || null,
      paymentMethodId: input.paymentMethodId,
      payeeType: input.payeeType,
      payeeCode: input.payeeCode,
      beneficiaryName: input.beneficiaryName,
      bankAccountNumber: input.bankAccountNumber || null,
      ifscCode: input.ifscCode || null,
      bankName: input.bankName || null,
      branchName: input.branchName || null,
      mobileNumber: input.mobileNumber || null,
    },
  })

export const processPayment = (paymentId: string) =>
  request<{ success: boolean; message: string }>(
    `/api/Payments/${paymentId}/process`,
    { method: 'POST' },
  )

export const completePayment = (paymentId: string) =>
  request<{ success: boolean; message: string }>(
    `/api/Payments/${paymentId}/complete`,
    { method: 'POST' },
  )

export const failPayment = (paymentId: string, remarks: string) =>
  request<{ success: boolean; message: string }>(
    `/api/Payments/${paymentId}/fail`,
    { method: 'POST', body: remarks },
  )

export const cancelPayment = (paymentId: string, remarks: string) =>
  request<{ success: boolean; message: string }>(
    `/api/Payments/${paymentId}/cancel`,
    { method: 'POST', body: remarks },
  )

export const deletePayment = (paymentId: string) =>
  request<{ success: boolean; message: string }>(`/api/Payments/${paymentId}`, {
    method: 'DELETE',
  })

// =================================================================
// Admin: dashboard
// =================================================================

export const getDashboardSummary = () =>
  request<DashboardSummaryDto>('/api/Dashboard/summary')

// =================================================================
// Admin: users / roles
// =================================================================

export const getAllUsers = () => request<UserResponseDto[]>('/api/Users')

export const createUser = (input: {
  roleId: number
  firstName: string
  lastName: string
  email: string
  password: string
  phoneNumber: string
}) =>
  request<UserResponseDto>('/api/Users', {
    method: 'POST',
    body: input,
  })

export const updateUser = (user: UserResponseDto) =>
  request<{ message: string }>('/api/Users', {
    method: 'PUT',
    body: user,
  })

export const getAllRoles = () => request<RoleResponseDto[]>('/api/Roles')

// =================================================================
// Admin: assigning Surveyors / Repairers to a claim
// =================================================================

export const getSurveyAssignmentsByClaim = (claimId: string) =>
  request<SurveyAssignmentResponseDto[]>(`/api/SurveyAssignments/claim/${claimId}`)

export const createSurveyAssignment = (
  claimId: string,
  surveyorId: string,
  inspectionMode: number,
) =>
  request('/api/SurveyAssignments', {
    method: 'POST',
    body: {
      claimId,
      surveyorId,
      assignedBy: '00000000-0000-0000-0000-000000000000', // forced server-side
      assignmentStatusId: 1, // Assigned
      inspectionMode,
    },
  })

export const createRepairAssignment = (claimId: string, repairerId: string) =>
  request('/api/RepairAssignments', {
    method: 'POST',
    body: {
      claimId,
      repairerId,
      assignedBy: '00000000-0000-0000-0000-000000000000', // forced server-side
      assignmentStatusId: 1, // Assigned
    },
  })

// =================================================================
// Admin: authority limits
// =================================================================

export const getAuthorityLimit = (roleId: number) =>
  request<AuthorityLimitResponseDto>(`/api/AuthorityLimits/${roleId}`).catch(
    (error: unknown) => {
      if (error instanceof ApiError && error.status === 404) {
        return null
      }
      throw error
    },
  )

export const upsertAuthorityLimit = (
  roleId: number,
  maxApprovalAmount: number | null,
  maxRiskScore: number | null,
) =>
  request<{ success: boolean; message: string; limit: AuthorityLimitResponseDto }>(
    `/api/AuthorityLimits/${roleId}`,
    {
      method: 'PUT',
      body: { maxApprovalAmount, maxRiskScore },
    },
  )

// =================================================================
// Otp (Phase 12 - shared by Login and Instant Claim Accept)
// =================================================================

export const sendOtp = (purpose: string, claimId?: string) =>
  request<OtpSendResultDto>('/api/Otp/send', {
    method: 'POST',
    body: { purpose, claimId },
  })

export const verifyOtp = (purpose: string, code: string, claimId?: string) =>
  request<OtpVerifyResultDto>('/api/Otp/verify', {
    method: 'POST',
    body: { purpose, code, claimId },
  })

// =================================================================
// Raise Claim wizard (Phase 12)
// =================================================================

export const raiseClaimStep1 = (request_: RaiseStep1Request) =>
  request<RaiseStep1ResponseDto>('/api/Claims/raise/step1', {
    method: 'POST',
    body: request_,
  })

export const raiseClaimStep2 = (claimId: string, request_: RaiseStep2Request) =>
  request<RaiseStep2ResponseDto>(`/api/Claims/${claimId}/raise/step2`, {
    method: 'PUT',
    body: request_,
  })

// Checkpoint 5 (Module 3) - staff-assisted registration (Claims
// Handler/Admin), distinct from the customer's own wizard above.
export const registerClaimByStaff = (request_: StaffRegisterClaimRequest) =>
  request<RaiseStep1ResponseDto>('/api/ClaimRegistration', {
    method: 'POST',
    body: request_,
  })

export const generateEstimate = (claimId: string) =>
  request<EstimateOrNotEligibleResponse>(`/api/Claims/${claimId}/raise/estimate`, {
    method: 'POST',
  })

export const acceptInstantClaim = (claimId: string) =>
  request<{ success: boolean; message: string }>(
    `/api/Claims/${claimId}/instant-claim/accept`,
    { method: 'POST' },
  )

export const declineInstantClaim = (claimId: string) =>
  request<{ success: boolean; message: string }>(
    `/api/Claims/${claimId}/instant-claim/decline`,
    { method: 'POST' },
  )

// =================================================================
// Admin: Instant Claim config (rate cards / parts pricing / eligibility)
// =================================================================

export const getInstantClaimRateCards = () =>
  request<InstantClaimRateCardResponseDto[]>('/api/InstantClaimConfig/rate-cards')

export const createInstantClaimRateCard = (input: {
  partType: string
  removeRefitCharge: number
  dentingCharge: number
  paintingCharge: number
  salvagePercent: number
}) =>
  request<{ success: boolean; message: string; rateCard: InstantClaimRateCardResponseDto }>(
    '/api/InstantClaimConfig/rate-cards',
    { method: 'POST', body: input },
  )

export const updateInstantClaimRateCard = (
  rateCardId: string,
  input: {
    removeRefitCharge: number
    dentingCharge: number
    paintingCharge: number
    salvagePercent: number
  },
) =>
  request<{ success: boolean; message: string; rateCard: InstantClaimRateCardResponseDto }>(
    `/api/InstantClaimConfig/rate-cards/${rateCardId}`,
    { method: 'PUT', body: input },
  )

export const toggleInstantClaimRateCard = (rateCardId: string) =>
  request<{ success: boolean; message: string; rateCard: InstantClaimRateCardResponseDto }>(
    `/api/InstantClaimConfig/rate-cards/${rateCardId}/toggle-active`,
    { method: 'PATCH' },
  )

export const getInstantClaimPartsPricing = () =>
  request<InstantClaimPartsPricingResponseDto[]>('/api/InstantClaimConfig/parts-pricing')

export const createInstantClaimPartsPricing = (input: {
  partType: string
  makeId: number | null
  modelId: number | null
  partsAmount: number
}) =>
  request<{
    success: boolean
    message: string
    partsPricing: InstantClaimPartsPricingResponseDto
  }>('/api/InstantClaimConfig/parts-pricing', { method: 'POST', body: input })

export const updateInstantClaimPartsPricing = (
  partsPricingId: string,
  input: { makeId: number | null; modelId: number | null; partsAmount: number },
) =>
  request<{
    success: boolean
    message: string
    partsPricing: InstantClaimPartsPricingResponseDto
  }>(`/api/InstantClaimConfig/parts-pricing/${partsPricingId}`, {
    method: 'PUT',
    body: input,
  })

export const toggleInstantClaimPartsPricing = (partsPricingId: string) =>
  request<{
    success: boolean
    message: string
    partsPricing: InstantClaimPartsPricingResponseDto
  }>(`/api/InstantClaimConfig/parts-pricing/${partsPricingId}/toggle-active`, {
    method: 'PATCH',
  })

export const getInstantClaimEligibility = () =>
  request<InstantClaimEligibilityResponseDto>('/api/InstantClaimConfig/eligibility').catch(
    (error: unknown) => {
      if (error instanceof ApiError && error.status === 404) {
        return null
      }
      throw error
    },
  )

export const upsertInstantClaimEligibility = (minEligibleBand: number) =>
  request<{
    success: boolean
    message: string
    eligibility: InstantClaimEligibilityResponseDto
  }>('/api/InstantClaimConfig/eligibility', { method: 'PUT', body: { minEligibleBand } })

// =================================================================
// Phase 13 - Surveyor Survey & Assessment screen
// =================================================================

export const getSurveyAssessment = (claimId: string) =>
  request<SurveyAssessmentResponseDto | null>(
    `/api/SurveyReports/assessment/claim/${claimId}`,
  )

export const saveSurveyAssessmentDraft = (input: SaveSurveyAssessmentRequest) =>
  request<SurveyAssessmentResponseDto>('/api/SurveyReports/assessment/draft', {
    method: 'POST',
    body: input,
  })

export const completeSurveyAssessment = (surveyReportId: string) =>
  request<SurveyAssessmentResponseDto>('/api/SurveyReports/assessment/complete', {
    method: 'POST',
    body: { surveyReportId },
  })

export const getAuditLogsForClaim = (claimId: string) =>
  request<AuditLogResponseDto[]>(`/api/AuditLogs/entity/Claim/${claimId}`)

// =================================================================
// Phase 15 - Claims Handler dashboard
// =================================================================

export const getClaimsHandlerDashboardSummary = () =>
  request<ClaimsHandlerDashboardSummaryDto>('/api/ClaimsHandlerDashboard/summary')

export const getTatPerformance = (year?: number, month?: number) => {
  const params = new URLSearchParams()
  if (year != null) params.set('year', String(year))
  if (month != null) params.set('month', String(month))
  const query = params.toString()

  return request<TatPerformanceResponseDto>(
    `/api/ClaimsHandlerDashboard/tat-performance${query ? `?${query}` : ''}`,
  )
}

// =================================================================
// Phase 16 - Decision & Review, Claims Processing & Settlement
// =================================================================

export const getDecisionSupportSummary = (claimId: string) =>
  request<DecisionSupportSummaryDto>(`/api/DecisionSupport/claim/${claimId}/summary`)

export const getClaimSettlement = (claimId: string) =>
  request<ClaimSettlementResponseDto | null>(`/api/ClaimSettlements/claim/${claimId}`)

export const computeClaimSettlement = (claimId: string) =>
  request<ClaimSettlementResponseDto>(`/api/ClaimSettlements/claim/${claimId}/compute`, {
    method: 'POST',
  })

// =================================================================
// Checkpoint 3 - Claim Closure & Reporting
// =================================================================

// CSV is a file download, not JSON - fetched directly (with the same
// auth header the `request` helper attaches) rather than through it.
export interface ClaimsHandlerClaimListItem {
  claimId: string
  claimNumber: string
  customerName: string | null
  statusId: number
  estimatedLossAmount: number | null
  relevantDate: string | null
  policyNumber: string | null
  vehicleNumber: string | null
  category: string
}

export const getClaimsHandlerAllClaims = () =>
  request<ClaimsHandlerClaimListItem[]>('/api/ClaimsHandlerDashboard/my-claims')

export async function fetchClaimsReportRows(
  status: string,
): Promise<{ headers: string[]; rows: string[][] }> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const headers: Record<string, string> = {}
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`
  }

  const response = await fetch(
    `${apiBaseUrl}/api/ClaimReports/claims/csv?status=${encodeURIComponent(status)}`,
    { headers },
  )

  if (!response.ok) {
    throw new ApiError(response.status, `Report preview failed with status ${response.status}`)
  }

  const text = await response.text()
  const lines = text.trim().split("\n").filter((line) => line.length > 0)
  if (lines.length === 0) {
    return { headers: [], rows: [] }
  }

  const parseLine = (line: string) => line.split(",").map((cell) => cell.trim())
  const [headerLine, ...dataLines] = lines

  return {
    headers: parseLine(headerLine),
    rows: dataLines.map(parseLine),
  }
}

export async function downloadClaimsReportCsv(status: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const headers: Record<string, string> = {}
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`
  }

  const response = await fetch(
    `${apiBaseUrl}/api/ClaimReports/claims/csv?status=${encodeURIComponent(status)}`,
    { headers },
  )

  if (!response.ok) {
    throw new ApiError(response.status, `Report download failed with status ${response.status}`)
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `claims-report-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}