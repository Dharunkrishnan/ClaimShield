namespace ClaimShield.Api.AI.Models
{
    // Phase 16 - Decision & Review surfacing. Deliberately rule-based
    // (templated composition of already-real, already-stored data) - no
    // LLM call, no invented numbers, matching MockAiService's own
    // honesty-first design. "AI insights" here means the same thing it
    // means everywhere else in this codebase: a structured summary a
    // human still has to read and decide from, not an auto-decision.
    public class DecisionSupportSummaryDto
    {
        public Guid ClaimId { get; set; }

        public string Summary { get; set; } = string.Empty;

        public List<string> KeyPoints { get; set; } = new();

        public string? RiskBandName { get; set; }

        public decimal? NetAssessmentAmount { get; set; }

        public decimal? RepairEstimateAmount { get; set; }

        public bool HasVarianceFlag { get; set; }

        public bool IsRuleBased { get; set; } = true;
    }
}
