using System.ComponentModel.DataAnnotations;

namespace ClaimShield.Api.Models.DTOs.SurveyReports
{
    public class DamageAssessmentItemRequest
    {
        [Required]
        [MaxLength(200)]
        public string ComponentName { get; set; } = string.Empty;

        public int? DamageCategoryId { get; set; }

        public int? SeverityId { get; set; }

        public bool RepairRequired { get; set; }

        public bool ReplacementRequired { get; set; }

        [MaxLength(500)]
        public string? Remarks { get; set; }

        public decimal? LabourAmount { get; set; }

        public decimal? PartsAmount { get; set; }
    }
}