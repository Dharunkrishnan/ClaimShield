using System.ComponentModel.DataAnnotations;

namespace ClaimShield.Api.Models.DTOs.Claims
{
    public class LiabilityDamageItemAdjustmentRequest
    {
        [Required]
        public Guid DamageAssessmentItemId { get; set; }

        public decimal? DepreciationAmount { get; set; }

        public decimal? RRAmount { get; set; }

        public decimal? TDAmount { get; set; }

        public decimal? PaintingAmount { get; set; }

        public decimal? OthersAmount { get; set; }
    }

    // Liability stage - saves the whole per-component adjustment
    // table as one unit, same "replace all children" pattern used for
    // the Survey Assessment's own DamageAssessmentItems save.
    public class UpdateLiabilityDamageItemsRequest
    {
        [Required]
        public Guid ClaimId { get; set; }

        public List<LiabilityDamageItemAdjustmentRequest> Items { get; set; } = new();
    }
}
