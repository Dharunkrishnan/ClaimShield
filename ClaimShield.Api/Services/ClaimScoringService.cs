using System.Text.Json;

using ClaimShield.Api.Constants;
using ClaimShield.Api.Data.Context;
using ClaimShield.Api.Interfaces.Services;
using ClaimShield.Api.Models.DTOs.ClaimScoring;
using ClaimShield.Api.Models.Entities;

using Microsoft.EntityFrameworkCore;

namespace ClaimShield.Api.Services
{
    // =============================================================
    // Two-stage, rule-repository-driven scoring engine.
    //
    // Stage 1 (FNOL) runs once at claim registration. Stage 2
    // (Survey) runs on every survey report submission/resubmission,
    // each run superseding the prior one rather than overwriting it.
    //
    // Composite = Stage1 + Stage2 scores, re-banded against the same
    // thresholds, forced Red if either stage had a Hard rule fire.
    // =============================================================

    public class ClaimScoringService : IClaimScoringService
    {
        private readonly ClaimShieldDbContext _context;
        private readonly IAuditLogService _auditLogService;

        public ClaimScoringService(
            ClaimShieldDbContext context,
            IAuditLogService auditLogService)
        {
            _context = context;
            _auditLogService = auditLogService;
        }

        // =========================================================
        // SCORE A STAGE
        // =========================================================

        public async Task<ScoringStageDto> ScoreStageAsync(
            Guid claimId,
            int stage)
        {
            var claim =
                await _context.Claims
                    .FirstOrDefaultAsync(
                        x => x.ClaimId == claimId);

            if (claim == null)
            {
                throw new InvalidOperationException(
                    "Claim not found.");
            }

            var facts =
                await BuildFactsAsync(
                    claim,
                    stage);

            var rules =
                await _context.ScoringRules
                    .Where(
                        x =>
                            x.Stage == stage &&
                            x.IsActive)
                    .OrderBy(x => x.RuleId)
                    .ToListAsync();

            var triggeredRuleIds = new List<string>();
            var reasonLines = new List<string>();
            var versionParts = new List<string>();

            var scoreValue = 0;
            var hardFlagTriggered = false;

            foreach (var rule in rules)
            {
                versionParts.Add(
                    $"{rule.RuleId}:v{rule.Version}");

                if (!facts.TryGetValue(
                        rule.ConditionField,
                        out var factValue))
                {
                    continue;
                }

                if (!EvaluateCondition(
                        factValue,
                        rule.ConditionOperator,
                        rule.ConditionThreshold))
                {
                    continue;
                }

                triggeredRuleIds.Add(rule.RuleId);

                reasonLines.Add(
                    $"Flagged: {rule.Category} — " +
                    $"{rule.ConditionField} " +
                    $"{rule.ConditionOperator} " +
                    $"{rule.ConditionThreshold}");

                if (rule.Severity == ScoringSeverityConstants.Hard)
                {
                    hardFlagTriggered = true;
                }
                else
                {
                    scoreValue += rule.Points;
                }
            }

            var band =
                await DetermineBandAsync(
                    scoreValue,
                    hardFlagTriggered);

            var priorResults =
                await _context.ClaimScoringResults
                    .Where(
                        x =>
                            x.ClaimId == claimId &&
                            x.Stage == stage &&
                            x.SupersededBy == null)
                    .ToListAsync();

            var newResult = new ClaimScoringResult
            {
                ClaimScoringResultId = Guid.NewGuid(),

                ClaimId = claimId,

                Stage = stage,

                ScoreValue = scoreValue,

                HardFlagTriggered = hardFlagTriggered,

                Band = band,

                TriggeredRuleIds =
                    JsonSerializer.Serialize(
                        triggeredRuleIds),

                ReasonText =
                    reasonLines.Count > 0
                        ? string.Join(
                            " ",
                            reasonLines)
                        : "No rules triggered.",

                RuleSetVersion =
                    versionParts.Count > 0
                        ? string.Join(
                            ",",
                            versionParts)
                        : "none",

                ScoredAt = DateTime.UtcNow
            };

            _context.ClaimScoringResults.Add(newResult);

            foreach (var prior in priorResults)
            {
                prior.SupersededBy =
                    newResult.ClaimScoringResultId;
            }

            await _context.SaveChangesAsync();

            await _auditLogService.LogAsync(
                null,
                $"ClaimScoring.{GetStageName(stage)}.Scored",
                "Claim",
                claimId,
                null,
                new
                {
                    newResult.ScoreValue,
                    newResult.HardFlagTriggered,
                    newResult.Band,
                    TriggeredRuleIds = triggeredRuleIds
                });

            return MapStageToDto(newResult);
        }

        // =========================================================
        // INTERNAL VIEW
        // =========================================================

        public async Task<InternalClaimScoringDto?> GetInternalScoringAsync(
            Guid claimId)
        {
            var stage1 =
                await GetLatestNonSupersededAsync(
                    claimId,
                    ScoringStageConstants.Stage1_FNOL);

            var stage2 =
                await GetLatestNonSupersededAsync(
                    claimId,
                    ScoringStageConstants.Stage2_Survey);

            if (stage1 == null && stage2 == null)
            {
                return null;
            }

            var (
                compositeScore,
                compositeBand,
                lastScoredAt) =
                await ComputeCompositeAsync(
                    stage1,
                    stage2);

            var stages =
                new List<ScoringStageDto>();

            if (stage1 != null)
            {
                stages.Add(
                    MapStageToDto(stage1));
            }

            if (stage2 != null)
            {
                stages.Add(
                    MapStageToDto(stage2));
            }

            return new InternalClaimScoringDto
            {
                ClaimId = claimId,

                CompositeScore = compositeScore,

                CompositeBand = compositeBand,

                CompositeBandName =
                    GetBandName(compositeBand),

                LastScoredAt = lastScoredAt,

                Stages = stages
            };
        }

        // =========================================================
        // CUSTOMER VIEW
        // =========================================================

        public async Task<CustomerClaimScoreDto?> GetCustomerScoringAsync(
            Guid claimId)
        {
            var internalDto =
                await GetInternalScoringAsync(
                    claimId);

            if (internalDto == null)
            {
                return null;
            }

            return new CustomerClaimScoreDto
            {
                ClaimId = internalDto.ClaimId,

                CompositeScore =
                    internalDto.CompositeScore,

                CompositeBand =
                    internalDto.CompositeBand,

                CompositeBandName =
                    internalDto.CompositeBandName,

                LastScoredAt =
                    internalDto.LastScoredAt
            };
        }

        // =========================================================
        // ROLE-GATED ACCESS
        // =========================================================

        public async Task<ScoringAccessResult> GetScoringForUserAsync(
            Guid claimId,
            Guid userId,
            int roleId)
        {
            var claim =
                await _context.Claims
                    .FirstOrDefaultAsync(
                        x => x.ClaimId == claimId);

            if (claim == null)
            {
                return new ScoringAccessResult
                {
                    ClaimFound = false,
                    Authorized = false
                };
            }

            var authorized = false;

            if (roleId == RoleConstants.AdminId)
            {
                authorized = true;
            }
            else if (roleId == RoleConstants.CustomerId)
            {
                var customer =
                    await _context.Customers
                        .FirstOrDefaultAsync(
                            x =>
                                x.CustomerId ==
                                claim.CustomerId);

                authorized =
                    customer != null &&
                    customer.UserId == userId;
            }
            else if (roleId == RoleConstants.SurveyorId)
            {
                authorized =
                    await _context.SurveyAssignments
                        .AnyAsync(
                            x =>
                                x.ClaimId == claimId &&
                                x.SurveyorId == userId);
            }
            else if (roleId == RoleConstants.ApproverId)
            {
                if (claim.StatusId >=
                    ClaimStatusConstants.RepairInProgress)
                {
                    authorized = true;
                }
                else
                {
                    var latestDecision =
                        await _context.ClaimDecisions
                            .Where(
                                x =>
                                    x.ClaimId == claimId &&
                                    (
                                        x.Decision ==
                                        ClaimDecisionConstants.Approve ||

                                        x.Decision ==
                                        ClaimDecisionConstants.Review ||

                                        x.Decision ==
                                        ClaimDecisionConstants.Deny
                                    ))
                            .OrderByDescending(
                                x => x.DecisionDate)
                            .FirstOrDefaultAsync();

                    authorized =
                        latestDecision != null &&
                        latestDecision.RoleId ==
                            RoleConstants.SurveyorId &&
                        claim.StatusId ==
                            ClaimStatusConstants.SurveyCompleted;
                }
            }

            if (!authorized)
            {
                return new ScoringAccessResult
                {
                    ClaimFound = true,
                    Authorized = false
                };
            }

            if (roleId ==
                RoleConstants.CustomerId)
            {
                return new ScoringAccessResult
                {
                    ClaimFound = true,

                    Authorized = true,

                    CustomerView =
                        await GetCustomerScoringAsync(
                            claimId)
                };
            }

            return new ScoringAccessResult
            {
                ClaimFound = true,

                Authorized = true,

                InternalView =
                    await GetInternalScoringAsync(
                        claimId)
            };
        }

        // =========================================================
        // FACT CATALOG
        //
        // These are the values that Admin scoring rules can evaluate.
        // =========================================================

        private async Task<Dictionary<string, decimal>> BuildFactsAsync(
            Claim claim,
            int stage)
        {
            var facts =
                new Dictionary<string, decimal>();

            // =====================================================
            // EXISTING FNOL FACTS
            // =====================================================

            var intimationDelayDays =
                claim.ReportedDate.HasValue
                    ? (decimal)
                        (
                            claim.ReportedDate.Value -
                            claim.IncidentDate
                        ).TotalDays
                    : 0m;

            facts["IntimationDelayDays"] =
                intimationDelayDays;

            facts["EstimatedLossAmount"] =
                claim.EstimatedLossAmount ?? 0m;

            facts["IsFraudSuspected"] =
                claim.IsFraudSuspected == true
                    ? 1m
                    : 0m;

            var priorClaimsCount =
                await _context.Claims
                    .CountAsync(
                        x =>
                            x.CustomerId ==
                                claim.CustomerId &&
                            x.ClaimId !=
                                claim.ClaimId);

            facts["PriorClaimsCount"] =
                priorClaimsCount;

            // =====================================================
            // POLICY
            // =====================================================

            var policy =
                await _context.Policies
                    .FirstOrDefaultAsync(
                        x =>
                            x.PolicyId ==
                            claim.PolicyId);

            facts["PolicyCoverageRatio"] =
                policy != null &&
                policy.CoverageAmount > 0
                    ? (
                        claim.EstimatedLossAmount ??
                        0m
                      ) /
                      policy.CoverageAmount
                    : 0m;

            // =====================================================
            // S1-R01
            //
            // Policy not active / lapsed on loss date.
            //
            // 1 = active on loss date
            // 0 = not active on loss date
            //
            // We use StartDate and EndDate because the current
            // Policy entity does not expose documented status
            // constants for active/lapsed values.
            // =====================================================

            facts["PolicyActiveOnLossDate"] =
                policy != null &&
                claim.IncidentDate.Date >=
                    policy.StartDate.Date &&
                claim.IncidentDate.Date <=
                    policy.EndDate.Date
                    ? 1m
                    : 0m;

            // =====================================================
            // S1-R03
            //
            // Loss date within X days of policy inception.
            //
            // Example:
            // DaysFromPolicyStart <= 15
            //
            // If there is no policy, return a very large value
            // so the rule cannot accidentally trigger.
            // =====================================================

            facts["DaysFromPolicyStart"] =
                policy != null
                    ? (decimal)
                        (
                            claim.IncidentDate.Date -
                            policy.StartDate.Date
                        ).TotalDays
                    : 999999m;

            // =====================================================
            // CLAIM INTAKE
            // =====================================================

            var intake =
                await _context.ClaimIntakes
                    .FirstOrDefaultAsync(
                        x =>
                            x.ClaimId ==
                            claim.ClaimId);

            // =====================================================
            // S1-R04
            //
            // FIR required but not provided.
            //
            // Current implementation considers FIR required for:
            // - Full loss theft
            // - Major accident
            // - Fire
            // - Death occurred
            // - Third-party damage
            //
            // 1 = FIR required and missing
            // 0 = otherwise
            // =====================================================

            var firRequired =
                intake != null &&
                (
                    intake.LossType ==
                        LossTypeConstants.FullLossTheft ||

                    intake.LossType ==
                        LossTypeConstants.MajorAccident ||

                    intake.LossType ==
                        LossTypeConstants.Fire ||

                    intake.DeathOccurred == true ||

                    intake.ThirdPartyDamage == true
                );

            facts["FirRequiredButMissing"] =
                firRequired &&
                intake?.PoliceReported != true
                    ? 1m
                    : 0m;

            // =====================================================
            // S1-R05
            //
            // Claim frequency for vehicle / claimant.
            //
            // Counts previous claims where either:
            // - Customer is the same
            // OR
            // - Vehicle is the same
            //
            // Current claim is excluded.
            // =====================================================

            var claimFrequency =
                await _context.Claims
                    .CountAsync(
                        x =>
                            x.ClaimId !=
                                claim.ClaimId &&

                            (
                                x.CustomerId ==
                                    claim.CustomerId ||

                                x.VehicleId ==
                                    claim.VehicleId
                            ));

            facts["ClaimFrequency"] =
                claimFrequency;

            // =====================================================
            // S1-R06
            //
            // Driver at loss is not a permitted driver.
            //
            // IMPORTANT:
            // The current Policy model does not contain permitted
            // driver information. Therefore we do NOT invent a
            // driver relationship here.
            //
            // This is temporarily 0 and must be implemented after
            // permitted-driver data is added to Policy/database.
            //
            // 1 = permitted driver
            // 0 = not permitted
            // =====================================================

            facts["IsPermittedDriver"] =
                0m;

            // =====================================================
            // S1-R07
            //
            // Loss location inconsistent with permitted usage area.
            //
            // IMPORTANT:
            // The current Policy/Vehicle models do not contain a
            // permitted usage-area field.
            //
            // Therefore we do NOT guess this value.
            //
            // 1 = location is consistent
            // 0 = location is inconsistent
            // =====================================================

            facts["IsUsageAreaConsistent"] =
                0m;

            // =====================================================
            // EXISTING OPTIONAL FNOL FACTS
            // =====================================================

            facts["DeathOccurred"] =
                intake?.DeathOccurred == true
                    ? 1m
                    : 0m;

            var rcOcrResult =
                await _context.ClaimRcOcrResults
                    .FirstOrDefaultAsync(
                        x =>
                            x.ClaimId ==
                            claim.ClaimId);

            facts["RcMismatch"] =
                rcOcrResult?.MatchStatus ==
                    RcMatchStatusConstants.Mismatched
                    ? 1m
                    : 0m;

            // =====================================================
            // STAGE 2 / SURVEY FACTS
            // =====================================================

            if (stage ==
                ScoringStageConstants.Stage2_Survey)
            {
                var latestSurveyReport =
                    await _context.SurveyReports
                        .Where(
                            x =>
                                x.ClaimId ==
                                claim.ClaimId)
                        .OrderByDescending(
                            x =>
                                x.CreatedDate)
                        .FirstOrDefaultAsync();

                facts["EstimatedRepairCost"] =
                    latestSurveyReport
                        ?.EstimatedRepairCost ??
                    0m;

                facts["TotalLoss"] =
                    latestSurveyReport?.TotalLoss == true
                        ? 1m
                        : 0m;

                var documentCount =
                    await _context.ClaimDocuments
                        .CountAsync(
                            x =>
                                x.ClaimId ==
                                claim.ClaimId);

                facts["DocumentCount"] =
                    documentCount;

                facts["RepairToLossRatio"] =
                    claim.EstimatedLossAmount is > 0 &&
                    latestSurveyReport
                        ?.EstimatedRepairCost != null
                        ? latestSurveyReport
                            .EstimatedRepairCost.Value /
                          claim.EstimatedLossAmount.Value
                        : 0m;

                // =================================================
                // S2-R03
                //
                // Estimated repair cost at/above a configurable %
                // of IDV (Insured Declared Value) - Policy's
                // CoverageAmount is used as IDV, matching the same
                // convention as the existing PolicyCoverageRatio
                // fact above.
                // =================================================

                facts["RepairCostToIdvRatio"] =
                    policy != null &&
                    policy.CoverageAmount > 0 &&
                    latestSurveyReport?.EstimatedRepairCost != null
                        ? latestSurveyReport.EstimatedRepairCost.Value /
                          policy.CoverageAmount
                        : 0m;

                // =================================================
                // S2-R01
                //
                // Surveyor explicitly flags claim as suspicious /
                // recommends investigation.
                // =================================================

                facts["SurveyorFlaggedSuspicious"] =
                    latestSurveyReport?.SurveyorFlaggedSuspicious == true
                        ? 1m
                        : 0m;

                // =================================================
                // S2-R05
                //
                // Evidence suggests pre-existing damage claimed as
                // new. Deliberately a separate explicit checkbox,
                // not derived from the free-text
                // PreExistingDamageNotes field - free text can't be
                // safely thresholded for automated scoring.
                // =================================================

                facts["PreExistingDamageSuspected"] =
                    latestSurveyReport?.PreExistingDamageSuspected == true
                        ? 1m
                        : 0m;
            }

            return facts;
        }

        // =========================================================
        // CONDITION EVALUATION
        // =========================================================

        private static bool EvaluateCondition(
            decimal factValue,
            string conditionOperator,
            string thresholdText)
        {
            if (!decimal.TryParse(
                    thresholdText,
                    out var threshold))
            {
                return false;
            }

            return conditionOperator switch
            {
                ">" =>
                    factValue > threshold,

                ">=" =>
                    factValue >= threshold,

                "<" =>
                    factValue < threshold,

                "<=" =>
                    factValue <= threshold,

                "=" =>
                    factValue == threshold,

                "!=" =>
                    factValue != threshold,

                _ =>
                    false
            };
        }

        // =========================================================
        // DETERMINE SCORE BAND
        // =========================================================

        private async Task<int> DetermineBandAsync(
            int scoreValue,
            bool hardFlagTriggered)
        {
            // Any Hard rule immediately forces Red.
            if (hardFlagTriggered)
            {
                return ScoringBandConstants.Red;
            }

            var threshold =
                await _context.ScoringThresholds
                    .FirstOrDefaultAsync(
                        x => x.IsActive);

            // Fail-safe to Red if no threshold is configured.
            if (threshold == null)
            {
                return ScoringBandConstants.Red;
            }

            if (scoreValue >=
                threshold.RedMin)
            {
                return ScoringBandConstants.Red;
            }

            if (scoreValue >=
                threshold.AmberMin)
            {
                return ScoringBandConstants.Amber;
            }

            return ScoringBandConstants.Green;
        }

        // =========================================================
        // COMPOSITE SCORE
        // =========================================================

        private async Task<(
            int Score,
            int Band,
            DateTime? LastScoredAt)>
            ComputeCompositeAsync(
                ClaimScoringResult? stage1,
                ClaimScoringResult? stage2)
        {
            var score =
                (stage1?.ScoreValue ?? 0) +
                (stage2?.ScoreValue ?? 0);

            var hardFlag =
                (stage1?.HardFlagTriggered ?? false) ||
                (stage2?.HardFlagTriggered ?? false);

            var band =
                await DetermineBandAsync(
                    score,
                    hardFlag);

            DateTime? lastScoredAt = null;

            if (stage1 != null &&
                (
                    lastScoredAt == null ||
                    stage1.ScoredAt >
                        lastScoredAt
                ))
            {
                lastScoredAt =
                    stage1.ScoredAt;
            }

            if (stage2 != null &&
                (
                    lastScoredAt == null ||
                    stage2.ScoredAt >
                        lastScoredAt
                ))
            {
                lastScoredAt =
                    stage2.ScoredAt;
            }

            return (
                score,
                band,
                lastScoredAt);
        }

        // =========================================================
        // GET LATEST RESULT
        // =========================================================

        private async Task<ClaimScoringResult?>
            GetLatestNonSupersededAsync(
                Guid claimId,
                int stage)
        {
            return await _context.ClaimScoringResults
                .Where(
                    x =>
                        x.ClaimId == claimId &&
                        x.Stage == stage &&
                        x.SupersededBy == null)
                .OrderByDescending(
                    x => x.ScoredAt)
                .FirstOrDefaultAsync();
        }

        // =========================================================
        // MAP RESULT
        // =========================================================

        private static ScoringStageDto MapStageToDto(
            ClaimScoringResult result)
        {
            return new ScoringStageDto
            {
                Stage =
                    result.Stage,

                StageName =
                    GetStageName(
                        result.Stage),

                ScoreValue =
                    result.ScoreValue,

                HardFlagTriggered =
                    result.HardFlagTriggered,

                Band =
                    result.Band,

                BandName =
                    GetBandName(
                        result.Band),

                TriggeredRuleIds =
                    JsonSerializer.Deserialize<List<string>>(
                        result.TriggeredRuleIds)
                    ?? new(),

                ReasonText =
                    result.ReasonText,

                RuleSetVersion =
                    result.RuleSetVersion,

                ScoredAt =
                    result.ScoredAt
            };
        }

        // =========================================================
        // STAGE NAME
        // =========================================================

        private static string GetStageName(
            int stage)
        {
            return stage switch
            {
                ScoringStageConstants.Stage1_FNOL =>
                    "Stage1_FNOL",

                ScoringStageConstants.Stage2_Survey =>
                    "Stage2_Survey",

                _ =>
                    "Unknown"
            };
        }

        // =========================================================
        // BAND NAME
        // =========================================================

        private static string GetBandName(
            int band)
        {
            return band switch
            {
                ScoringBandConstants.Green =>
                    "Green",

                ScoringBandConstants.Amber =>
                    "Amber",

                ScoringBandConstants.Red =>
                    "Red",

                _ =>
                    "Unknown"
            };
        }
    }
}