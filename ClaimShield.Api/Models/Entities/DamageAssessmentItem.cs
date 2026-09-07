using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ClaimShield.Api.Models.Entities
{
    [Table("DamageAssessmentItems")]
    public class DamageAssessmentItem
    {
        [Key]
        public Guid DamageAssessmentItemId { get; set; }

        public Guid SurveyReportId { get; set; }

        [MaxLength(200)]
        public string ComponentName { get; set; } = string.Empty;

        public int? DamageCategoryId { get; set; }

        public int? SeverityId { get; set; }

        public bool RepairRequired { get; set; }

        public bool ReplacementRequired { get; set; }

        [MaxLength(500)]
        public string? Remarks { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? LabourAmount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? PartsAmount { get; set; }

        public DateTime CreatedDate { get; set; }
    }
}