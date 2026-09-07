using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ClaimShield.Api.Models.Entities
{
    // =================================================================
    // Phase 16 - Claims Processing & Settlement. Deterministic,
    // server-computed only (see ClaimSettlementService) - ties together
    // the Survey & Assessment's NetAssessmentAmount, the Repairer's
    // approved RepairEstimate, and the policy's own Excess/IDV/AddOns
    // (previously unused anywhere in this codebase). One row per claim,
    // overwritten on recompute - same "always reflects the latest
    // inputs, snapshot the version" principle as ClaimEstimateResult.
    // =================================================================

    [Table("ClaimSettlements", Schema = "dbo")]
    public class ClaimSettlement
    {
        [Key]
        public Guid ClaimId { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? AssessedAmount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? RepairApprovedAmount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal BaseAmount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal ZeroDepreciationWaiverAmount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal GrossSettlementAmount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal PolicyExcessDeducted { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? PolicyIdvCap { get; set; }

        public bool IdvCapApplied { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal NetSettlementAmount { get; set; }

        [MaxLength(500)]
        public string? Notes { get; set; }

        public DateTime ComputedAt { get; set; }
    }
}
