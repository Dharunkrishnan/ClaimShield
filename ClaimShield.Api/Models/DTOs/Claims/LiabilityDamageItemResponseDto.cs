namespace ClaimShield.Api.Models.DTOs.Claims
{
    // Liability stage - one row per DamageAssessmentItem on the
    // claim's latest SurveyReport, merged with that item's
    // LiabilityDamageItemAdjustment row if one has been saved yet
    // (null/0 adjustment fields otherwise - see
    // LiabilityDamageItemAdjustment for why no row means "not
    // adjusted yet", not an error).
    public class LiabilityDamageItemResponseDto
    {
        public Guid DamageAssessmentItemId { get; set; }

        public string ComponentName { get; set; } = string.Empty;

        public int? DamageCategoryId { get; set; }

        public bool RepairRequired { get; set; }

        public bool ReplacementRequired { get; set; }

        public decimal? LabourAmount { get; set; }

        public decimal? PartsAmount { get; set; }

        public decimal? DepreciationAmount { get; set; }

        public decimal? RRAmount { get; set; }

        public decimal? TDAmount { get; set; }

        public decimal? PaintingAmount { get; set; }

        public decimal? OthersAmount { get; set; }
    }
}
