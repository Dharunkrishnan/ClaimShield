namespace ClaimShield.Api.Models.DTOs.Claims
{
    public class ClaimResponseDto
    {
        public Guid ClaimId { get; set; }

        public Guid PolicyId { get; set; }

        public Guid CustomerId { get; set; }

        public Guid VehicleId { get; set; }

        public string ClaimNumber { get; set; } = string.Empty;

        public DateTime IncidentDate { get; set; }

        public DateTime? ReportedDate { get; set; }

        public string? IncidentLocation { get; set; }

        public string? IncidentDescription { get; set; }

        public decimal? EstimatedLossAmount { get; set; }

        public decimal? ApprovedAmount { get; set; }

        public bool? IsFraudSuspected { get; set; }

        public string? ClosureRemarks { get; set; }

        public int? ClosureReasonId { get; set; }

        public int? PriorStatusId { get; set; }

        public string? HoldReason { get; set; }

        public DateTime? OnHoldDate { get; set; }

        public string? InfoRequestReason { get; set; }

        public DateTime? InfoRequestedDate { get; set; }

        public int? InfoRequestedFromRoleId { get; set; }

        public Guid? PreferredRepairerId { get; set; }

        public string? PreferredRepairerName { get; set; }

        public Guid? RegisteredByUserId { get; set; }

        public decimal? InitialReserveAmount { get; set; }

        public int? StatusId { get; set; }

        public DateTime? CreatedDate { get; set; }

        public DateTime? UpdatedDate { get; set; }

        // Phase 13 - denormalized display fields for the Surveyor's Claim
        // Information header (and anywhere else that wants them without a
        // separate round trip). LossTypeId is nullable because ClaimIntake
        // only exists for claims raised via the Phase 12 wizard.
        public string? CustomerName { get; set; }

        public string? PolicyNumber { get; set; }

        public string? VehicleRegistrationNumber { get; set; }

        public int? LossTypeId { get; set; }

        // Added for Claim 360 - these existed on the Claim entity
        // (DriverName from the original staff-registration flow,
        // DriverDob/WorkshopRecommendation added alongside it) but
        // were never actually exposed for reading anywhere until now.
        public string? DriverName { get; set; }

        public DateTime? DriverDob { get; set; }

        public string? WorkshopRecommendation { get; set; }

        public int? PreferredRepairerTypeId { get; set; }

        public int? RepairAuthorizationStatusId { get; set; }

        public DateTime? RepairAuthorizationDate { get; set; }

        public int? RepairAuthClosureReasonId { get; set; }

        public int? RepairAuthDenialReasonId { get; set; }

        public string? RepairAuthClosureRemarks { get; set; }

        public DateTime? SurveyDate { get; set; }

        public decimal? LiabilityTaxAmount { get; set; }

        public decimal? LiabilityTotalLabour { get; set; }

        public decimal? LiabilityTotalParts { get; set; }

        public decimal? LiabilityDepWaiver { get; set; }

        public decimal? LiabilityDepreciationAmount { get; set; }

        public decimal? LiabilityCompulsoryExcess { get; set; }

        public decimal? LiabilityImposedExcess { get; set; }

        public decimal? LiabilitySalvageDeductions { get; set; }

        public decimal? LiabilityOtherDeduction { get; set; }

        public decimal? LiabilityTowingAmount { get; set; }

        public bool LiabilitySubmitted { get; set; }

        public DateTime? LiabilitySubmittedDate { get; set; }
    }
}