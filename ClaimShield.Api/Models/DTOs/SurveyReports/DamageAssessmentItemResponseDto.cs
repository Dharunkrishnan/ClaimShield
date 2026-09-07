namespace ClaimShield.Api.Models.DTOs.SurveyReports
{
    public class DamageAssessmentItemResponseDto
    {
        public Guid DamageAssessmentItemId { get; set; }

        public string ComponentName { get; set; } = string.Empty;

        public int? DamageCategoryId { get; set; }

        public int? SeverityId { get; set; }

        public bool RepairRequired { get; set; }

        public bool ReplacementRequired { get; set; }

        public string? Remarks { get; set; }

        public decimal? LabourAmount { get; set; }

        public decimal? PartsAmount { get; set; }
    }
}