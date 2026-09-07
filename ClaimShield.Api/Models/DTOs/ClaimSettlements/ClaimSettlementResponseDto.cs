namespace ClaimShield.Api.Models.DTOs.ClaimSettlements
{
    public class ClaimSettlementResponseDto
    {
        public Guid ClaimId { get; set; }

        public decimal? AssessedAmount { get; set; }

        public decimal? RepairApprovedAmount { get; set; }

        public decimal BaseAmount { get; set; }

        public decimal ZeroDepreciationWaiverAmount { get; set; }

        public decimal GrossSettlementAmount { get; set; }

        public decimal PolicyExcessDeducted { get; set; }

        public decimal? PolicyIdvCap { get; set; }

        public bool IdvCapApplied { get; set; }

        public decimal NetSettlementAmount { get; set; }

        public string? Notes { get; set; }

        public DateTime ComputedAt { get; set; }
    }
}
