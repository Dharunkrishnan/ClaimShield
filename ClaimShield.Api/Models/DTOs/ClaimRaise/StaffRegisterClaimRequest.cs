using System.ComponentModel.DataAnnotations;

namespace ClaimShield.Api.Models.DTOs.ClaimRaise
{
    // Checkpoint 5 (Module 3) - staff-assisted claim registration/
    // intimation, for a Claims Handler (Surveyor) or Admin registering a
    // claim on a customer's behalf (phone-in/walk-in intake), as opposed
    // to RaiseStep1Request which is the customer's own self-service
    // wizard. No Instant Claim shortcut here - that's a customer-
    // initiated convenience, not relevant to staff intake.
    public class StaffRegisterClaimRequest
    {
        [Required]
        public Guid CustomerId { get; set; }

        [Required]
        public Guid PolicyId { get; set; }

        [Required]
        public Guid VehicleId { get; set; }

        [Required]
        [Range(1, int.MaxValue, ErrorMessage = "Vehicle location is required.")]
        public int VehicleLocationAtLoss { get; set; }

        [Required]
        [Range(1, int.MaxValue, ErrorMessage = "Loss type is required.")]
        public int LossType { get; set; }

        [Required]
        public DateTime DateOfLoss { get; set; }

        [Required]
        [MaxLength(500)]
        public string LocationOfLoss { get; set; } = string.Empty;

        [Required]
        [MinLength(10, ErrorMessage = "Please provide a bit more detail (at least 10 characters).")]
        public string Description { get; set; } = string.Empty;

        public decimal? EstimatedLossAmount { get; set; }

        // Repositioned in the UI as "Repair Recommendation" (still
        // optional) - a specific Repairer user selected from the
        // system's repairer list, distinct from WorkshopRecommendation
        // below which is freehand text.
        public Guid? RepairerId { get; set; }

        [MaxLength(200)]
        public string? WorkshopRecommendation { get; set; }

        public int? PreferredRepairerTypeId { get; set; }

        // Checkpoint 8 - only set when the vehicle was NOT parked
        // safely at the time of loss (i.e. someone was driving it).
        // Frontend requires DriverDob and a license upload whenever
        // this is non-empty; not re-validated server-side since the
        // upload itself is a separate authenticated call.
        [MaxLength(200)]
        public string? DriverName { get; set; }

        public DateTime? DriverDob { get; set; }

        // Checkpoint 9 - the three intake toggles plus a real Date of
        // Intimation, so staff registration can set ReportedDate to
        // when the customer actually called in, not just "now".
        public bool VehicleParkedSafely { get; set; }

        public bool ThirdPartyDamage { get; set; }

        public bool PoliceReported { get; set; }

        public DateTime? DateOfIntimation { get; set; }

        // Declared on the frontend's request type but had no matching
        // property here, so it was being silently dropped by model
        // binding on every staff-registered claim despite
        // ClaimIntake.ContactMobileNumber existing in the database.
        [MaxLength(20)]
        public string? ContactMobileNumber { get; set; }
    }
}