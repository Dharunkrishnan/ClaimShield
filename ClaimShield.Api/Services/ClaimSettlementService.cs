using ClaimShield.Api.Constants;
using ClaimShield.Api.Data.Context;
using ClaimShield.Api.Interfaces.Services;
using ClaimShield.Api.Models.DTOs.ClaimSettlements;
using ClaimShield.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace ClaimShield.Api.Services
{
    // =================================================================
    // Phase 16 - Claims Processing & Settlement. Deterministic,
    // config/data-driven computation - no AI call, no randomness, same
    // principle as EstimateEngineService. Ties together three real,
    // previously-disconnected inputs:
    //   - SurveyReport.NetAssessmentAmount (Survey & Assessment, Phase 13)
    //   - RepairEstimate.ApprovedAmount (the Repairer's approved estimate)
    //   - Policy.Excess / Policy.IDV / Policy.AddOns (confirmed unused
    //     anywhere in this codebase before this phase)
    //
    // Formula (documented here since it's the only place it exists):
    //   BaseAmount = min(AssessedAmount, RepairApprovedAmount) when both
    //     exist (never pay out more than either the independent survey
    //     assessment or the actual approved repair cost), else whichever
    //     one is available.
    //   ZeroDepreciationWaiverAmount = SurveyReport.DepreciationAmount,
    //     added back, ONLY if the policy's AddOns text contains "Zero
    //     Depreciation" (case-insensitive) - a real, explainable add-on
    //     benefit, not a fabricated discount.
    //   GrossSettlementAmount = BaseAmount + ZeroDepreciationWaiverAmount
    //   PolicyExcessDeducted = Policy.Excess ?? 0
    //   NetSettlementAmount = max(0, GrossSettlementAmount - PolicyExcessDeducted),
    //     capped at Policy.IDV if IDV is configured (a settlement can
    //     never exceed the vehicle's own Insured Declared Value).
    // =================================================================

    public class ClaimSettlementService : IClaimSettlementService
    {
        private readonly ClaimShieldDbContext _context;
        private readonly IAuditLogService _auditLogService;

        public ClaimSettlementService(
            ClaimShieldDbContext context,
            IAuditLogService auditLogService)
        {
            _context = context;
            _auditLogService = auditLogService;
        }

        public async Task<ClaimSettlementResponseDto?> GetByClaimAsync(Guid claimId)
        {
            var settlement =
                await _context.ClaimSettlements
                    .FirstOrDefaultAsync(x => x.ClaimId == claimId);

            return settlement == null ? null : MapToDto(settlement);
        }

        public async Task<ClaimSettlementResponseDto> ComputeAsync(Guid claimId)
        {
            var claim =
                await _context.Claims
                    .FirstOrDefaultAsync(x => x.ClaimId == claimId);

            if (claim == null)
            {
                throw new InvalidOperationException("Claim not found.");
            }

            var policy =
                await _context.Policies
                    .FirstOrDefaultAsync(x => x.PolicyId == claim.PolicyId);

            var latestSurveyReport =
                await _context.SurveyReports
                    .Where(x => x.ClaimId == claimId)
                    .OrderByDescending(x => x.UpdatedDate ?? x.CreatedDate)
                    .FirstOrDefaultAsync();

            var approvedRepairEstimate =
                await _context.RepairEstimates
                    .Where(
                        x =>
                            x.ClaimId == claimId &&
                            x.ApprovalStatusId == RepairEstimateApprovalStatusConstants.Approved)
                    .OrderByDescending(x => x.ApprovalDate ?? x.CreatedDate)
                    .FirstOrDefaultAsync();

            var assessedAmount = latestSurveyReport?.NetAssessmentAmount;
            var repairApprovedAmount = approvedRepairEstimate?.ApprovedAmount;

            decimal baseAmount;
            if (assessedAmount.HasValue && repairApprovedAmount.HasValue)
            {
                baseAmount = Math.Min(assessedAmount.Value, repairApprovedAmount.Value);
            }
            else
            {
                baseAmount = assessedAmount ?? repairApprovedAmount ?? 0m;
            }

            var hasZeroDepreciation =
                policy?.AddOns != null &&
                policy.AddOns.Contains("Zero Depreciation", StringComparison.OrdinalIgnoreCase);

            var zeroDepreciationWaiver =
                hasZeroDepreciation ? (latestSurveyReport?.DepreciationAmount ?? 0m) : 0m;

            var grossSettlementAmount = baseAmount + zeroDepreciationWaiver;

            var policyExcess = policy?.Excess ?? 0m;
            var afterExcess = Math.Max(0m, grossSettlementAmount - policyExcess);

            var idvCapApplied = policy?.IDV.HasValue == true && afterExcess > policy.IDV.Value;
            var netSettlementAmount =
                policy?.IDV.HasValue == true
                    ? Math.Min(afterExcess, policy.IDV.Value)
                    : afterExcess;

            var existing =
                await _context.ClaimSettlements
                    .FirstOrDefaultAsync(x => x.ClaimId == claimId);

            var isNew = existing == null;

            if (existing == null)
            {
                existing = new ClaimSettlement { ClaimId = claimId };
                _context.ClaimSettlements.Add(existing);
            }

            existing.AssessedAmount = assessedAmount;
            existing.RepairApprovedAmount = repairApprovedAmount;
            existing.BaseAmount = baseAmount;
            existing.ZeroDepreciationWaiverAmount = zeroDepreciationWaiver;
            existing.GrossSettlementAmount = grossSettlementAmount;
            existing.PolicyExcessDeducted = policyExcess;
            existing.PolicyIdvCap = policy?.IDV;
            existing.IdvCapApplied = idvCapApplied;
            existing.NetSettlementAmount = netSettlementAmount;
            existing.Notes =
                assessedAmount == null
                    ? "No survey assessment amount available."
                    : repairApprovedAmount == null
                        ? "No approved repair estimate available yet."
                        : null;
            existing.ComputedAt = DateTime.UtcNow;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException) when (isNew)
            {
                // Mirrors EstimateEngineService's own race-safety comment:
                // two concurrent computations for the same claim can both
                // see "no row yet" - whoever loses just updates the row
                // the winner created.
                _context.Entry(existing).State = EntityState.Detached;

                existing =
                    await _context.ClaimSettlements.FirstAsync(x => x.ClaimId == claimId);

                existing.AssessedAmount = assessedAmount;
                existing.RepairApprovedAmount = repairApprovedAmount;
                existing.BaseAmount = baseAmount;
                existing.ZeroDepreciationWaiverAmount = zeroDepreciationWaiver;
                existing.GrossSettlementAmount = grossSettlementAmount;
                existing.PolicyExcessDeducted = policyExcess;
                existing.PolicyIdvCap = policy?.IDV;
                existing.IdvCapApplied = idvCapApplied;
                existing.NetSettlementAmount = netSettlementAmount;
                existing.ComputedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();
            }

            await _auditLogService.LogAsync(
                null,
                "ClaimSettlement.Computed",
                "Claim",
                claimId,
                null,
                new { existing.NetSettlementAmount, existing.GrossSettlementAmount });

            return MapToDto(existing);
        }

        private static ClaimSettlementResponseDto MapToDto(ClaimSettlement settlement)
        {
            return new ClaimSettlementResponseDto
            {
                ClaimId = settlement.ClaimId,
                AssessedAmount = settlement.AssessedAmount,
                RepairApprovedAmount = settlement.RepairApprovedAmount,
                BaseAmount = settlement.BaseAmount,
                ZeroDepreciationWaiverAmount = settlement.ZeroDepreciationWaiverAmount,
                GrossSettlementAmount = settlement.GrossSettlementAmount,
                PolicyExcessDeducted = settlement.PolicyExcessDeducted,
                PolicyIdvCap = settlement.PolicyIdvCap,
                IdvCapApplied = settlement.IdvCapApplied,
                NetSettlementAmount = settlement.NetSettlementAmount,
                Notes = settlement.Notes,
                ComputedAt = settlement.ComputedAt
            };
        }
    }
}
