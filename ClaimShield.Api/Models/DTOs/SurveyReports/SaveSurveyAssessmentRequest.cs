using System.ComponentModel.DataAnnotations;

namespace ClaimShield.Api.Models.DTOs.SurveyReports
{
    // Used for both the first save (creates the SurveyReport row) and
    // every subsequent "Save as Draft" - the surveyor's own identity is
    // still required in the payload (matching CreateSurveyReportRequest's
    // existing convention) but the controller rejects any value that
    // doesn't match the authenticated caller, exactly like
    // SurveyReportsController.Create already does.
    public class SaveSurveyAssessmentRequest
    {
        [Required]
        public Guid SurveyAssignmentId { get; set; }

        [Required]
        public Guid ClaimId { get; set; }

        [Required]
        public Guid SurveyorId { get; set; }

        // ---- Survey Information ----

        [Required]
        public DateTime InspectionDate { get; set; }

        [MaxLength(500)]
        public string? SurveyLocation { get; set; }

        [MaxLength(2000)]
        public string? SurveyRemarks { get; set; }

        // Reachable values are Assigned..AssessmentCompleted - reaching
        // SubmittedForReview requires the dedicated Complete Assessment
        // action, not a draft save (enforced server-side).
        public int? AssessmentStatusId { get; set; }

        // ---- Vehicle Inspection Details ----

        public int? VehicleConditionId { get; set; }

        public int? OdometerReading { get; set; }

        [MaxLength(2000)]
        public string? PreExistingDamageNotes { get; set; }

        public bool? SurveyorFlaggedSuspicious { get; set; }

        public bool? PreExistingDamageSuspected { get; set; }

        [Required]
        public int DamageTypeId { get; set; }

        public string? DamageDescription { get; set; }

        public int? RepairabilityStatusId { get; set; }

        public bool? TotalLoss { get; set; }

        // ---- Damage Assessment ----

        public List<DamageAssessmentItemRequest> DamageAssessmentItems { get; set; } = new();

        // ---- Repair Estimate Details ----

        [MaxLength(300)]
        public string? EstimatedRepairerName { get; set; }

        public int? RepairerTypeId { get; set; }

        public decimal? LabourCost { get; set; }

        public decimal? PartsCost { get; set; }

        public decimal? TowingCharges { get; set; }

        public decimal? PaintCost { get; set; }

        public int? EstimatedDurationDays { get; set; }

        // ---- Assessment Computation (inputs only - Gross/Net are
        // always recomputed server-side, never trusted from the client) ----

        public decimal? TaxAmount { get; set; }

        public decimal? DepreciationAmount { get; set; }

        public decimal? CompulsoryExcess { get; set; }

        public decimal? SalvageAmount { get; set; }

        // ---- Assessment Recommendation ----

        public bool? RepairRecommended { get; set; }

        public bool? ReplaceRecommended { get; set; }

        public bool? CashSettlementRecommended { get; set; }

        public bool? TotalLossRecommended { get; set; }

        public int? OverallRecommendationId { get; set; }

        [MaxLength(2000)]
        public string? AssessmentRemarks { get; set; }
    }
}