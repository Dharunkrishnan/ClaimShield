using ClaimShield.Api.AI.Interfaces;
using ClaimShield.Api.AI.Models;
using ClaimShield.Api.Constants;
using ClaimShield.Api.Interfaces.Services;

namespace ClaimShield.Api.AI.Services
{
    // =================================================================
    // Phase 16 - Decision & Review. Composes a "Decision Support
    // Summary" for the Claims Handler entirely from real, already-
    // fetched data (Claim, Survey & Assessment, Stage 1/2 risk scoring,
    // RepairEstimates) - a template, not an LLM call. Lives in AI/
    // alongside MockAiService because it follows the exact same design
    // philosophy that service established: honest, rule-based, never
    // fabricated, clearly labeled as such (IsRuleBased on the DTO).
    // =================================================================

    public class DecisionSupportService : IDecisionSupportService
    {
        private readonly IClaimService _claimService;
        private readonly ISurveyReportService _surveyReportService;
        private readonly IClaimScoringService _claimScoringService;
        private readonly IRepairEstimateService _repairEstimateService;

        public DecisionSupportService(
            IClaimService claimService,
            ISurveyReportService surveyReportService,
            IClaimScoringService claimScoringService,
            IRepairEstimateService repairEstimateService)
        {
            _claimService = claimService;
            _surveyReportService = surveyReportService;
            _claimScoringService = claimScoringService;
            _repairEstimateService = repairEstimateService;
        }

        public async Task<DecisionSupportSummaryDto> GetSummaryAsync(Guid claimId)
        {
            var claim = await _claimService.GetClaimByIdAsync(claimId);

            if (claim == null)
            {
                throw new InvalidOperationException("Claim not found.");
            }

            var assessment = await _surveyReportService.GetAssessmentByClaimAsync(claimId);
            var scoring = await _claimScoringService.GetInternalScoringAsync(claimId);
            var repairEstimates = await _repairEstimateService.GetByClaimAsync(claimId);

            var latestRepairEstimate =
                repairEstimates
                    .OrderByDescending(x => x.SubmittedDate)
                    .FirstOrDefault();

            var keyPoints = new List<string>();

            // ---- Risk band ----
            if (scoring != null)
            {
                keyPoints.Add(
                    $"Composite risk band is {scoring.CompositeBandName} " +
                        $"(score {scoring.CompositeScore}).");

                if (scoring.CompositeBandName != "Green")
                {
                    keyPoints.Add(
                        "Risk band is not Green - review the triggered rules before deciding.");
                }
            }
            else
            {
                keyPoints.Add("No risk scoring result is available for this claim yet.");
            }

            // ---- Survey assessment ----
            if (assessment != null)
            {
                var recommendationName =
                    assessment.OverallRecommendationId switch
                    {
                        SurveyorRecommendationConstants.Repair => "Repair",
                        SurveyorRecommendationConstants.Replace => "Replace",
                        SurveyorRecommendationConstants.CashSettlement => "Cash Settlement",
                        SurveyorRecommendationConstants.TotalLoss => "Total Loss",
                        SurveyorRecommendationConstants.ReferToApprover => "Refer to Approver",
                        _ => null
                    };

                if (recommendationName != null)
                {
                    keyPoints.Add(
                        $"Surveyor {assessment.SurveyorName ?? "assigned"} recommends: " +
                            $"{recommendationName}.");
                }

                if (assessment.NetAssessmentAmount.HasValue)
                {
                    keyPoints.Add(
                        $"Net Assessment Amount from the survey: " +
                            $"₹{assessment.NetAssessmentAmount.Value:N2}.");
                }

                if (assessment.TotalLoss == true)
                {
                    keyPoints.Add(
                        "Total loss was flagged during the vehicle inspection.");
                }
            }
            else
            {
                keyPoints.Add("No completed survey assessment is available for this claim yet.");
            }

            // ---- Repair estimate ----
            if (latestRepairEstimate != null)
            {
                var amount =
                    latestRepairEstimate.ApprovedAmount ?? latestRepairEstimate.EstimatedAmount;

                keyPoints.Add(
                    $"Latest repair estimate: ₹{amount:N2} " +
                        $"({latestRepairEstimate.ApprovalStatus ?? "Pending"}).");
            }

            // ---- Variance flag ----
            var hasVarianceFlag = false;

            if (assessment?.NetAssessmentAmount.HasValue == true &&
                latestRepairEstimate != null)
            {
                var repairAmount =
                    latestRepairEstimate.ApprovedAmount ?? latestRepairEstimate.EstimatedAmount;

                var assessed = assessment.NetAssessmentAmount.Value;

                if (assessed > 0)
                {
                    var variance = Math.Abs(repairAmount - assessed) / assessed;

                    if (variance > 0.2m)
                    {
                        hasVarianceFlag = true;
                        keyPoints.Add(
                            $"The repair estimate differs from the survey's assessed amount " +
                                $"by more than 20% ({variance:P0}) - worth a closer look before " +
                                "approving.");
                    }
                }
            }

            var summary =
                $"Claim {claim.ClaimNumber} for {claim.CustomerName ?? "the customer"}: " +
                string.Join(" ", keyPoints);

            return new DecisionSupportSummaryDto
            {
                ClaimId = claimId,
                Summary = summary,
                KeyPoints = keyPoints,
                RiskBandName = scoring?.CompositeBandName,
                NetAssessmentAmount = assessment?.NetAssessmentAmount,
                RepairEstimateAmount =
                    latestRepairEstimate?.ApprovedAmount ?? latestRepairEstimate?.EstimatedAmount,
                HasVarianceFlag = hasVarianceFlag,
                IsRuleBased = true
            };
        }
    }
}
