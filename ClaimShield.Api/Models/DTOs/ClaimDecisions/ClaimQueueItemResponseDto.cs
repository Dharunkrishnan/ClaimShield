namespace ClaimShield.Api.Models.DTOs.ClaimDecisions
{
    public class ClaimQueueItemResponseDto
    {
        public Guid ClaimId { get; set; }

        public string ClaimNumber { get; set; } = string.Empty;

        public int StatusId { get; set; }

        public decimal? EstimatedLossAmount { get; set; }

        // "AwaitingSurvey", "AwaitingSurveyorDecision", or "AwaitingApproverDecision"
        public string QueueReason { get; set; } = string.Empty;

        // Populated only when QueueReason is AwaitingApproverDecision.
        public Guid? PendingDecisionId { get; set; }

        // Phase 15 - Claims Handler dashboard. The date this item entered
        // its current queue bucket (assignment date for AwaitingSurvey,
        // survey-completion date for AwaitingSurveyorDecision, latest
        // decision date for AwaitingApproverDecision) - used client-side
        // to compute ageing/SLA badges, and the customer's display name
        // so the work queue table doesn't need a second round trip per row.
        public DateTime? RelevantDate { get; set; }

        public string? CustomerName { get; set; }
    }
}
