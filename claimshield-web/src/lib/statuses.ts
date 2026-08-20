// Mirrors ClaimShield.Api/Constants/StatusConstants.cs
// (ClaimStatusConstants / AssignmentStatusConstants).

export const ClaimStatus = {
  Submitted: 1,
  UnderReview: 2,
  SurveyAssigned: 3,
  SurveyCompleted: 4,
  RepairAssigned: 5,
  RepairInProgress: 6,
  Approved: 7,
  Rejected: 8,
  Settled: 9,
  Closed: 10,
} as const

export const ClaimStatusName: Record<number, string> = {
  [ClaimStatus.Submitted]: 'Submitted',
  [ClaimStatus.UnderReview]: 'Under Review',
  [ClaimStatus.SurveyAssigned]: 'Survey Assigned',
  [ClaimStatus.SurveyCompleted]: 'Survey Completed',
  [ClaimStatus.RepairAssigned]: 'Repair Assigned',
  [ClaimStatus.RepairInProgress]: 'Repair In Progress',
  [ClaimStatus.Approved]: 'Approved',
  [ClaimStatus.Rejected]: 'Rejected',
  [ClaimStatus.Settled]: 'Settled',
  [ClaimStatus.Closed]: 'Closed',
}

export const AssignmentStatus = {
  Assigned: 1,
  Accepted: 2,
  InProgress: 3,
  Completed: 4,
  Cancelled: 5,
} as const

export const AssignmentStatusName: Record<number, string> = {
  [AssignmentStatus.Assigned]: 'Assigned',
  [AssignmentStatus.Accepted]: 'Accepted',
  [AssignmentStatus.InProgress]: 'In Progress',
  [AssignmentStatus.Completed]: 'Completed',
  [AssignmentStatus.Cancelled]: 'Cancelled',
}

export const InspectionMode = {
  Virtual: 1,
  Physical: 2,
} as const

export const InspectionModeName: Record<number, string> = {
  [InspectionMode.Virtual]: 'Virtual',
  [InspectionMode.Physical]: 'Physical',
}

export const PaymentStatus = {
  Pending: 1,
  Processing: 2,
  Paid: 3,
  Failed: 4,
  Cancelled: 5,
} as const

export const PaymentStatusName: Record<number, string> = {
  [PaymentStatus.Pending]: 'Pending',
  [PaymentStatus.Processing]: 'Processing',
  [PaymentStatus.Paid]: 'Paid',
  [PaymentStatus.Failed]: 'Failed',
  [PaymentStatus.Cancelled]: 'Cancelled',
}

export const RepairEstimateApprovalStatus = {
  Approved: 1,
  Rejected: 2,
} as const

export const RepairEstimateApprovalStatusName: Record<number, string> = {
  [RepairEstimateApprovalStatus.Approved]: 'Approved',
  [RepairEstimateApprovalStatus.Rejected]: 'Rejected',
}

// Phase 12 - Customer Raise Claim Journey

export const VehicleLocation = {
  Home: 1,
  AccidentSpot: 2,
  Workshop: 3,
  Others: 4,
} as const

export const VehicleLocationName: Record<number, string> = {
  [VehicleLocation.Home]: 'Home',
  [VehicleLocation.AccidentSpot]: 'Accident Spot',
  [VehicleLocation.Workshop]: 'Workshop',
  [VehicleLocation.Others]: 'Others',
}

export const LossType = {
  MinorAccident: 1,
  PartsTheft: 2,
  NaturalCalamities: 3,
  FullLossTheft: 4,
  MajorAccident: 5,
  Fire: 6,
} as const

export const LossTypeName: Record<number, string> = {
  [LossType.MinorAccident]: 'Minor Accident',
  [LossType.PartsTheft]: 'Parts Theft',
  [LossType.NaturalCalamities]: 'Natural Calamities',
  [LossType.FullLossTheft]: 'Full Loss / Theft',
  [LossType.MajorAccident]: 'Major Accident',
  [LossType.Fire]: 'Fire',
}

export const RcMatchStatus = {
  Matched: 1,
  Mismatched: 2,
  Pending: 3,
} as const

export const InstantClaimDecision = {
  Accepted: 1,
  Declined: 2,
} as const

export const PolicyType = {
  Comprehensive: 1,
  ThirdParty: 2,
  StandaloneFire: 3,
} as const

export const PolicyTypeName: Record<number, string> = {
  [PolicyType.Comprehensive]: 'Comprehensive',
  [PolicyType.ThirdParty]: 'Third Party',
  [PolicyType.StandaloneFire]: 'Standalone Fire',
}

export const DocumentType = {
  VehicleFront: 1,
  VehicleLeft: 2,
  VehicleBack: 3,
  VehicleRight: 4,
  NumberPlate: 5,
  RegistrationCertificate: 6,
  Other: 7,
  DamagePhoto: 8,
  RepairEstimateDocument: 9,
  WorkshopQuotation: 10,
  SurveyReportDocument: 11,
  DrivingLicense: 12,
} as const

export const OtpPurpose = {
  Login: 'Login',
  InstantClaimAccept: 'InstantClaimAccept',
} as const

// Phase 13 - Surveyor Survey & Assessment screen

export const AssessmentStatus = {
  Assigned: 1,
  SurveyScheduled: 2,
  SurveyInProgress: 3,
  SurveyCompleted: 4,
  AssessmentInProgress: 5,
  AssessmentCompleted: 6,
  SubmittedForReview: 7,
} as const

export const AssessmentStatusName: Record<number, string> = {
  [AssessmentStatus.Assigned]: 'Assigned',
  [AssessmentStatus.SurveyScheduled]: 'Survey Scheduled',
  [AssessmentStatus.SurveyInProgress]: 'Survey In Progress',
  [AssessmentStatus.SurveyCompleted]: 'Survey Completed',
  [AssessmentStatus.AssessmentInProgress]: 'Assessment In Progress',
  [AssessmentStatus.AssessmentCompleted]: 'Assessment Completed',
  [AssessmentStatus.SubmittedForReview]: 'Submitted for Review',
}

export const ASSESSMENT_STEP_LABELS = [
  'Assigned',
  'Survey Scheduled',
  'Survey In Progress',
  'Survey Completed',
  'Assessment In Progress',
  'Assessment Completed',
  'Submitted for Review',
]

export const VehicleCondition = {
  Excellent: 1,
  Good: 2,
  Fair: 3,
  Poor: 4,
  TotalWreck: 5,
} as const

export const VehicleConditionName: Record<number, string> = {
  [VehicleCondition.Excellent]: 'Excellent',
  [VehicleCondition.Good]: 'Good',
  [VehicleCondition.Fair]: 'Fair',
  [VehicleCondition.Poor]: 'Poor',
  [VehicleCondition.TotalWreck]: 'Total Wreck',
}

export const RepairabilityStatus = {
  Repairable: 1,
  RepairableMajorWork: 2,
  EconomicallyNotViable: 3,
  NotRepairable: 4,
} as const

export const RepairabilityStatusName: Record<number, string> = {
  [RepairabilityStatus.Repairable]: 'Repairable',
  [RepairabilityStatus.RepairableMajorWork]: 'Repairable (Major Work)',
  [RepairabilityStatus.EconomicallyNotViable]: 'Economically Not Viable',
  [RepairabilityStatus.NotRepairable]: 'Not Repairable',
}

export const SurveyorRecommendation = {
  Repair: 1,
  Replace: 2,
  CashSettlement: 3,
  TotalLoss: 4,
  ReferToApprover: 5,
} as const

export const SurveyorRecommendationName: Record<number, string> = {
  [SurveyorRecommendation.Repair]: 'Repair',
  [SurveyorRecommendation.Replace]: 'Replace',
  [SurveyorRecommendation.CashSettlement]: 'Cash Settlement',
  [SurveyorRecommendation.TotalLoss]: 'Total Loss',
  [SurveyorRecommendation.ReferToApprover]: 'Refer to Approver',
}

export const DamageCategory = {
  Dent: 1,
  Scratch: 2,
  Crack: 3,
  Broken: 4,
  Missing: 5,
  Other: 6,
} as const

export const DamageCategoryName: Record<number, string> = {
  [DamageCategory.Dent]: 'Dent',
  [DamageCategory.Scratch]: 'Scratch',
  [DamageCategory.Crack]: 'Crack',
  [DamageCategory.Broken]: 'Broken',
  [DamageCategory.Missing]: 'Missing',
  [DamageCategory.Other]: 'Other',
}

export const DamageSeverity = {
  Minor: 1,
  Moderate: 2,
  Major: 3,
  Severe: 4,
} as const

export const DamageSeverityName: Record<number, string> = {
  [DamageSeverity.Minor]: 'Minor',
  [DamageSeverity.Moderate]: 'Moderate',
  [DamageSeverity.Major]: 'Major',
  [DamageSeverity.Severe]: 'Severe',
}