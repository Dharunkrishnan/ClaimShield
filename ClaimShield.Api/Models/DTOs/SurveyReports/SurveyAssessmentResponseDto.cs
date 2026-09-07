namespace ClaimShield.Api.Models.DTOs.SurveyReports
{
    public class SurveyAssessmentResponseDto
    {
        public Guid SurveyReportId { get; set; }

        public Guid SurveyAssignmentId { get; set; }

        public Guid ClaimId { get; set; }

        public Guid SurveyorId { get; set; }

        public string? SurveyorName { get; set; }

        // ---- Survey Information ----

        public DateTime InspectionDate { get; set; }

        public string? SurveyLocation { get; set; }

        public string? SurveyRemarks { get; set; }

        public int? SurveyTypeId { get; set; }

        public int AssessmentStatusId { get; set; }

        // ---- Vehicle Inspection Details ----

        public int? VehicleConditionId { get; set; }

        public int? OdometerReading { get; set; }

        public string? PreExistingDamageNotes { get; set; }

        public bool? SurveyorFlaggedSuspicious { get; set; }

        public bool? PreExistingDamageSuspected { get; set; }

        public int DamageTypeId { get; set; }

        public string? DamageDescription { get; set; }

        public int? RepairabilityStatusId { get; set; }

        public bool? TotalLoss { get; set; }

        // ---- Damage Assessment ----

        public List<DamageAssessmentItemResponseDto> DamageAssessmentItems { get; set; } = new();

        // ---- Repair Estimate Details ----

        public string? EstimatedRepairerName { get; set; }

        public int? RepairerTypeId { get; set; }

        public decimal? LabourCost { get; set; }

        public decimal? PartsCost { get; set; }

        public decimal? TowingCharges { get; set; }

        public decimal? PaintCost { get; set; }

        public int? EstimatedDurationDays { get; set; }

        public decimal? EstimatedRepairCost { get; set; }

        // ---- Assessment Computation ----

        public decimal? TaxAmount { get; set; }

        public decimal? DepreciationAmount { get; set; }

        public decimal? CompulsoryExcess { get; set; }

        public decimal? SalvageAmount { get; set; }

        public decimal? GrossAssessmentAmount { get; set; }

        public decimal? NetAssessmentAmount { get; set; }

        // ---- Assessment Recommendation ----

        public bool? RepairRecommended { get; set; }

        public bool? ReplaceRecommended { get; set; }

        public bool? CashSettlementRecommended { get; set; }

        public bool? TotalLossRecommended { get; set; }

        public int? OverallRecommendationId { get; set; }

        public string? AssessmentRemarks { get; set; }

        public DateTime? CreatedDate { get; set; }

        public DateTime? UpdatedDate { get; set; }
    }
}
