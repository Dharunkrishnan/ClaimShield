using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ClaimShield.Api.Models.Entities
{
    [Table("SurveyReports")]
    public class SurveyReport
    {
        [Key]
        public Guid SurveyReportId { get; set; }

        public Guid SurveyAssignmentId { get; set; }

        public Guid ClaimId { get; set; }

        public Guid SurveyorId { get; set; }

        public DateTime InspectionDate { get; set; }

        public int? OdometerReading { get; set; }

        public int DamageTypeId { get; set; }

        public string? DamageDescription { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? EstimatedRepairCost { get; set; }

        public bool? TotalLoss { get; set; }

        public string? SurveyRemarks { get; set; }

        public DateTime? CreatedDate { get; set; }

        public DateTime? UpdatedDate { get; set; }

        // =====================================================
        // Phase 13 - Surveyor Assessment screen. All additive;
        // the fields above (InspectionDate, OdometerReading,
        // DamageTypeId, DamageDescription, EstimatedRepairCost,
        // TotalLoss, SurveyRemarks) keep their exact original
        // meaning since ClaimScoringService reads EstimatedRepairCost
        // and TotalLoss for Stage 2 scoring facts.
        // =====================================================

        // ---- Survey Information ----

        public string? SurveyLocation { get; set; }

        // ---- Vehicle Inspection Details ----

        public int? VehicleConditionId { get; set; }

        public string? PreExistingDamageNotes { get; set; }

        // Explicit surveyor checkboxes for fraud-scoring rules S2-R01
        // and S2-R05 - deliberately separate from the free-text
        // SurveyRemarks/PreExistingDamageNotes fields above, since
        // free text can't be safely thresholded by the scoring engine.
        public bool? SurveyorFlaggedSuspicious { get; set; }

        public bool? PreExistingDamageSuspected { get; set; }

        public int? RepairabilityStatusId { get; set; }

        // ---- Repair Estimate Details ----

        public string? EstimatedRepairerName { get; set; }

        // Shown in the Survey Information section (not grouped with the
        // Repair Estimate fields above) - see RepairerTypeConstants.
        public int? RepairerTypeId { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? LabourCost { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? PartsCost { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? TowingCharges { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? PaintCost { get; set; }

        public int? EstimatedDurationDays { get; set; }

        // ---- Assessment Computation ----

        [Column(TypeName = "decimal(18,2)")]
        public decimal? TaxAmount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? DepreciationAmount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? CompulsoryExcess { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? SalvageAmount { get; set; }

        // Server-computed only - never trust a client-submitted total,
        // same principle as EstimateEngineService's NetAssessmentAmount.
        [Column(TypeName = "decimal(18,2)")]
        public decimal? GrossAssessmentAmount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? NetAssessmentAmount { get; set; }

        // ---- Assessment Recommendation ----

        public bool? RepairRecommended { get; set; }

        public bool? ReplaceRecommended { get; set; }

        public bool? CashSettlementRecommended { get; set; }

        public bool? TotalLossRecommended { get; set; }

        public int? OverallRecommendationId { get; set; }

        public string? AssessmentRemarks { get; set; }

        // ---- Assessment status lifecycle (7-step stepper) ----
        // Distinct from the coarser Claim.StatusId - see
        // Constants.AssessmentStatusConstants.

        public int AssessmentStatusId { get; set; } = 1;
    }
}