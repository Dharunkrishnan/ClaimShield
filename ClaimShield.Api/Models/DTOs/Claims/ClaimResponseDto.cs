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

        // Populated only by GetClaimByIdAsync, same as LossTypeId above -
        // powers the "these are covered under Instant Claim" panel on
        // the customer's claim summary page.
        public bool? InstantClaimToggle { get; set; }

        public string? InstantClaimParts { get; set; }
    }
}