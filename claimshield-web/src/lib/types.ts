// Mirrors the response/request DTOs under ClaimShield.Api/Models/DTOs/.
// ASP.NET Core's default JSON serializer emits camelCase property names.

export interface ClaimResponseDto {
  claimId: string
  policyId: string
  customerId: string
  vehicleId: string
  claimNumber: string
  incidentDate: string
  reportedDate: string | null
  incidentLocation: string | null
  incidentDescription: string | null
  estimatedLossAmount: number | null
  approvedAmount: number | null
  isFraudSuspected: boolean | null
  statusId: number | null
  createdDate: string | null
  updatedDate: string | null
  // Phase 13 - denormalized display fields for the claim detail header.
  customerName: string | null
  policyNumber: string | null
  vehicleRegistrationNumber: string | null
  lossTypeId: number | null
  instantClaimToggle: boolean | null
  instantClaimParts: string | null
}

// Two-stage rules-based scoring engine (Phase 9). Band: 1 = Green,
// 2 = Amber, 3 = Red. Stage: 1 = Stage1_FNOL, 2 = Stage2_Survey.

export interface ScoringStageDto {
  stage: number
  stageName: string
  scoreValue: number
  hardFlagTriggered: boolean
  band: number
  bandName: string
  triggeredRuleIds: string[]
  reasonText: string
  ruleSetVersion: string
  scoredAt: string
}

// Customer-facing view: band + score only, never rule-level detail.
export interface CustomerClaimScoreDto {
  claimId: string
  compositeScore: number
  compositeBand: number
  compositeBandName: string
  lastScoredAt: string | null
}

// Surveyor/Approver/Admin view: full rule-level detail per stage.
export interface InternalClaimScoringDto {
  claimId: string
  compositeScore: number
  compositeBand: number
  compositeBandName: string
  lastScoredAt: string | null
  stages: ScoringStageDto[]
}

export interface ScoringRuleResponseDto {
  ruleId: string
  stage: number
  category: string
  conditionField: string
  conditionOperator: string
  conditionThreshold: string
  severity: number
  points: number
  isActive: boolean
  version: number
  effectiveFrom: string
}

export interface ScoringThresholdResponseDto {
  thresholdSet: string
  amberMin: number
  redMin: number
  isActive: boolean
}

export const ScoringBand = {
  Green: 1,
  Amber: 2,
  Red: 3,
} as const

export const ScoringSeverity = {
  Hard: 1,
  Soft: 2,
} as const

export interface ClaimDecisionResponseDto {
  claimDecisionId: string
  claimId: string
  decidedBy: string
  decidedByName: string
  roleId: number
  roleName: string
  decision: number
  decisionName: string
  reasoning: string
  aiScoresSnapshot: string | null
  decisionDate: string
  escalated: boolean
}

export interface ClaimQueueItemResponseDto {
  claimId: string
  claimNumber: string
  statusId: number
  estimatedLossAmount: number | null
  queueReason: 'AwaitingSurveyorDecision' | 'AwaitingApproverDecision'
  pendingDecisionId: string | null
}

export interface ReassessmentCommentResponseDto {
  reassessmentCommentId: string
  claimId: string
  authorId: string
  authorName: string
  comment: string
  createdDate: string
}

export interface ClaimDocumentResponseDto {
  claimDocumentId: string
  claimId: string
  documentTypeId: number
  fileName: string
  originalFileName: string
  fileExtension: string
  fileSize: number
  filePath: string
  contentType: string
  uploadedBy: string
  uploadedDate: string | null
  isVerified: boolean | null
  verifiedBy: string | null
  verifiedDate: string | null
  remarks: string | null
}

export interface OcrExtractionResult {
  rawText: string
  registrationNumber: string | null
  ownerName: string | null
  chassisNumber: string | null
  engineNumber: string | null
  drivingLicenceNumber: string | null
  confidence: number
}

export interface RepairAssignmentResponseDto {
  repairAssignmentId: string
  claimId: string
  repairerId: string
  assignedBy: string
  assignedDate: string | null
  expectedCompletionDate: string | null
  assignmentStatusId: number
  remarks: string | null
  createdDate: string | null
  updatedDate: string | null
}

export interface RepairEstimateResponseDto {
  repairEstimateId: string
  repairAssignmentId: string
  claimId: string
  estimatedAmount: number
  estimatedCompletionDays: number | null
  estimateRemarks: string | null
  submittedDate: string | null
  approvedAmount: number | null
  approvalDate: string | null
  approvalStatusId: number | null
  approvalStatus: string | null
  approvalRemarks: string | null
  createdDate: string | null
}

export interface PaymentResponseDto {
  paymentId: string
  claimId: string
  amount: number
  paymentStatusId: number
  paymentStatus: string
  transactionReference: string | null
  paymentDate: string | null
  remarks: string | null
  createdDate: string | null
}

export interface CustomerResponseDto {
  customerId: string
  userId: string
  customerCode: string
  dateOfBirth: string | null
  gender: string | null
  aadhaarNumber: string | null
  drivingLicenseNumber: string | null
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  state: string | null
  pincode: string | null
  phoneNumber: string | null
  email: string | null
}

export interface PolicyResponseDto {
  policyId: string
  customerId: string
  vehicleId: string
  policyNumber: string
  coverageAmount: number
  premiumAmount: number
  startDate: string
  endDate: string
  policyTypeId: number | null
  policyStatusId: number | null
  idv: number | null
  excess: number | null
  addOns: string | null
}

export interface VehicleResponseDto {
  vehicleId: string
  customerId: string
  registrationNumber: string
  chassisNumber: string
  engineNumber: string
  variant: string | null
  manufacturingYear: number
  vehicleColor: string | null
  rcNumber: string | null
  isActive: boolean
  makeId: number | null
  modelId: number | null
  fuelTypeId: number | null
  rcStatus: string | null
}

export interface UserResponseDto {
  userId: string
  roleId: number
  firstName: string
  lastName: string | null
  email: string
  phoneNumber: string | null
  isActive: boolean
}

export interface RoleResponseDto {
  roleId: number
  roleName: string
  description: string | null
  isActive: boolean
  createdDate: string
}

export interface AuthorityLimitResponseDto {
  roleId: number
  roleName: string
  maxApprovalAmount: number | null
  maxRiskScore: number | null
  updatedDate: string
  updatedBy: string | null
}

export interface StatusCountDto {
  statusId: number
  statusName: string
  count: number
}

export interface DailyCountDto {
  date: string
  count: number
}

export interface BandCountDto {
  bandName: string
  count: number
}

export interface DashboardSummaryDto {
  totalClaims: number
  totalCustomers: number
  totalPaidAmount: number
  averageClaimAmount: number
  averageApprovalTurnaroundDays: number | null
  claimsByStatus: StatusCountDto[]
  claimsOverTime: DailyCountDto[]
  riskBandDistribution: BandCountDto[]
  paymentsByStatus: StatusCountDto[]
  repairEstimateOutcomes: StatusCountDto[]
}

// =================================================================
// Phase 12 - Customer Raise Claim Journey
// =================================================================

export interface InstantClaimPartsSelection {
  windshieldFront: boolean
  windshieldRear: boolean
  glass: boolean
  tyre: boolean
}

export interface RaiseStep1Request {
  policyId: string
  vehicleId: string
  vehicleLocationAtLoss: number
  lossType: number
  dateOfLoss: string
  locationOfLoss: string
  description: string
  instantClaimToggle: boolean
  instantClaimParts: InstantClaimPartsSelection | null
  customerEstimatedAmount: number | null
}

export interface RaiseStep1ResponseDto {
  claimId: string
  claimNumber: string
  message: string
  assignedHandlerName: string | null
}

export interface RaiseStep2Request {
  vehicleParkedSafely: boolean
  deathOccurred: boolean
}

export interface RaiseStep2ResponseDto {
  matchStatus: number
  routedToSurveyor: boolean
  message: string
}

export interface EstimateLineItemsDto {
  removeRefitCharge: number
  dentingCharge: number
  paintingCharge: number
  totalLabourCharges: number
  totalPartsAmount: number
  policyExcess: number
  salvageAmount: number
  otherDeductions: number
}

export interface ClaimEstimateResultDto {
  claimId: string
  lineItems: EstimateLineItemsDto
  netAssessmentAmount: number
  ruleSetVersion: string
  generatedAt: string
  customerDecision: number | null
}

export interface NotEligibleResultDto {
  eligible: false
  reason: string
}

export type EstimateOrNotEligibleResponse =
  | ({ eligible: true } & Omit<ClaimEstimateResultDto, 'claimId'>)
  | NotEligibleResultDto

export interface OtpSendResultDto {
  success: boolean
  message: string
  expiresAt: string
  devModeCode: string | null
}

export interface OtpVerifyResultDto {
  success: boolean
  resultCode: number
  message: string
}

export interface InstantClaimRateCardResponseDto {
  rateCardId: string
  partType: string
  removeRefitCharge: number
  dentingCharge: number
  paintingCharge: number
  salvagePercent: number
  isActive: boolean
  version: number
  effectiveFrom: string
}

export interface InstantClaimPartsPricingResponseDto {
  partsPricingId: string
  partType: string
  makeId: number | null
  modelId: number | null
  partsAmount: number
  isActive: boolean
  version: number
  effectiveFrom: string
}

export interface InstantClaimEligibilityResponseDto {
  eligibilitySet: string
  minEligibleBand: number
  isActive: boolean
}

// AI chat assistant (ClaimShield.Api/AI/) - a real, rule-based lookup
// service today (MockAiService), not a paid LLM. Answers are resolved
// server-side from the caller's own claims/assignments at question-time.
export interface AiChatRequest {
  message: string
  claimId?: string | null
  confirmed?: boolean
}

export interface AiChatResponse {
  success: boolean
  message: string
  intent?: string | null
  requiresConfirmation: boolean
  action?: string | null
  claimId?: string | null
}

export const Decision = {
  Approve: 1,
  Review: 2,
  Deny: 3,
} as const

export const DecisionName: Record<number, string> = {
  [Decision.Approve]: 'Approve',
  [Decision.Review]: 'Review',
  [Decision.Deny]: 'Deny',
}

// =====================================================================
// Phase 13 - Surveyor Survey & Assessment screen
// =====================================================================

export interface DamageAssessmentItemRequest {
  componentName: string
  damageCategoryId: number | null
  severityId: number | null
  repairRequired: boolean
  replacementRequired: boolean
  remarks: string | null
}

export interface DamageAssessmentItemResponseDto {
  damageAssessmentItemId: string
  componentName: string
  damageCategoryId: number | null
  severityId: number | null
  repairRequired: boolean
  replacementRequired: boolean
  remarks: string | null
}

export interface SaveSurveyAssessmentRequest {
  surveyAssignmentId: string
  claimId: string
  surveyorId: string

  inspectionDate: string
  surveyLocation: string | null
  surveyRemarks: string | null
  assessmentStatusId: number | null

  vehicleConditionId: number | null
  odometerReading: number | null
  preExistingDamageNotes: string | null
  damageTypeId: number
  damageDescription: string | null
  repairabilityStatusId: number | null
  totalLoss: boolean | null

  damageAssessmentItems: DamageAssessmentItemRequest[]

  estimatedRepairerName: string | null
  labourCost: number | null
  partsCost: number | null
  towingCharges: number | null
  paintCost: number | null
  estimatedDurationDays: number | null

  taxAmount: number | null
  depreciationAmount: number | null
  compulsoryExcess: number | null
  salvageAmount: number | null

  repairRecommended: boolean | null
  replaceRecommended: boolean | null
  cashSettlementRecommended: boolean | null
  totalLossRecommended: boolean | null
  overallRecommendationId: number | null
  assessmentRemarks: string | null
}

export interface SurveyAssessmentResponseDto {
  surveyReportId: string
  surveyAssignmentId: string
  claimId: string
  surveyorId: string
  surveyorName: string | null

  inspectionDate: string
  surveyLocation: string | null
  surveyRemarks: string | null
  surveyTypeId: number | null
  assessmentStatusId: number

  vehicleConditionId: number | null
  odometerReading: number | null
  preExistingDamageNotes: string | null
  damageTypeId: number
  damageDescription: string | null
  repairabilityStatusId: number | null
  totalLoss: boolean | null

  damageAssessmentItems: DamageAssessmentItemResponseDto[]

  estimatedRepairerName: string | null
  labourCost: number | null
  partsCost: number | null
  towingCharges: number | null
  paintCost: number | null
  estimatedDurationDays: number | null
  estimatedRepairCost: number | null

  taxAmount: number | null
  depreciationAmount: number | null
  compulsoryExcess: number | null
  salvageAmount: number | null
  grossAssessmentAmount: number | null
  netAssessmentAmount: number | null

  repairRecommended: boolean | null
  replaceRecommended: boolean | null
  cashSettlementRecommended: boolean | null
  totalLossRecommended: boolean | null
  overallRecommendationId: number | null
  assessmentRemarks: string | null

  createdDate: string | null
  updatedDate: string | null
}

export interface SurveyAssignmentResponseDto {
  surveyAssignmentId: string
  claimId: string
  surveyorId: string
  assignedBy: string
  assignedDate: string
  dueDate: string | null
  assignmentStatusId: number
  inspectionMode: number
  remarks: string | null
  createdDate: string | null
  updatedDate: string | null
}

export interface AuditLogResponseDto {
  auditLogId: string
  userId: string | null
  userName: string
  action: string
  entityType: string
  entityId: string
  timestamp: string
}