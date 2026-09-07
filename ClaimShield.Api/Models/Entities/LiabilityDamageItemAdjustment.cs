using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ClaimShield.Api.Models.Entities
{
    // Liability stage - per-component Depn/R&R/T&D/Painting/Others
    // amounts, editable at this stage specifically. Kept as its own
    // table (not new columns on DamageAssessmentItem) so editing here
    // never overwrites the surveyor's own historical assessment
    // record - same principle as Claim.Liability* fields. One row per
    // DamageAssessmentItem, created lazily (via the GET endpoint's
    // merge, or on first save) rather than one being required to exist
    // up front for every item.
    [Table("LiabilityDamageItemAdjustments")]
    public class LiabilityDamageItemAdjustment
    {
        [Key]
        public Guid LiabilityDamageItemAdjustmentId { get; set; }

        public Guid ClaimId { get; set; }

        // References the original survey component this adjustment
        // belongs to - ComponentName/Category/Repair-Replace are read
        // from that record, never duplicated here.
        public Guid DamageAssessmentItemId { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? DepreciationAmount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? RRAmount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? TDAmount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? PaintingAmount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? OthersAmount { get; set; }

        public DateTime? UpdatedDate { get; set; }
    }
}