namespace ClaimShield.Api.Models.DTOs.ClaimsHandlerDashboard
{
    // Phase 15 - real aggregation over the same tables GetMyQueueAsync and
    // SurveyAssessment already use, scoped to "claims I have a
    // SurveyAssignment for" (my portfolio), not every claim in the
    // system. Mirrors DashboardService's own "read-only aggregation, no
    // new data collection" principle.
    public class ClaimsHandlerDashboardSummaryDto
    {
        public int TotalMyClaims { get; set; }

        public int AwaitingSurveyCount { get; set; }

        public int AwaitingDecisionCount { get; set; }

        public int InRepairCount { get; set; }

        public int AwaitingSettlementCount { get; set; }

        public int ClosedThisMonthCount { get; set; }

        public int SlaBreachedCount { get; set; }

        public int SlaNearBreachCount { get; set; }

        public double? AverageOpenClaimAgeDays { get; set; }

        // Checkpoint 5 (Module 5) additions.
        public int OnHoldCount { get; set; }

        public int InfoRequestedCount { get; set; }
    }
}
