using System.Text.Json;

using ClaimShield.Api.Data.Context;
using ClaimShield.Api.Interfaces.Services;
using ClaimShield.Api.Models.DTOs.InstantClaim;
using ClaimShield.Api.Models.Entities;

using Microsoft.EntityFrameworkCore;

namespace ClaimShield.Api.Services
{
    // =================================================================
    // Deterministic, config-driven cost breakdown - no AI call, no
    // randomness. Given the same InstantClaimRateCards/
    // InstantClaimPartsPricing version and the same inputs, always
    // produces the same numbers. RuleSetVersion snapshots exactly which
    // rate card rows were used, so a later Admin edit never changes a
    // historical estimate's displayed numbers (same principle as
    // ClaimScoringResult.RuleSetVersion).
    // =================================================================

    public class EstimateEngineService : IEstimateEngineService
    {
        private static readonly string[] PartKeys =
            { "windshieldFront", "windshieldRear", "glass", "tyre" };

        private static readonly Dictionary<string, string> PartTypeNames =
            new()
            {
                ["windshieldFront"] = "WindshieldFront",
                ["windshieldRear"] = "WindshieldRear",
                ["glass"] = "Glass",
                ["tyre"] = "Tyre"
            };

        private readonly ClaimShieldDbContext _context;
        private readonly IAuditLogService _auditLogService;

        public EstimateEngineService(
            ClaimShieldDbContext context,
            IAuditLogService auditLogService)
        {
            _context = context;
            _auditLogService = auditLogService;
        }

        public async Task<ClaimEstimateResultDto> GenerateAsync(
            Guid claimId)
        {
            var claim =
                await _context.Claims
                    .FirstOrDefaultAsync(x => x.ClaimId == claimId);

            if (claim == null)
            {
                throw new InvalidOperationException("Claim not found.");
            }

            var intake =
                await _context.ClaimIntakes
                    .FirstOrDefaultAsync(x => x.ClaimId == claimId);

            if (intake == null)
            {
                throw new InvalidOperationException(
                    "Claim intake details not found.");
            }

            var policy =
                await _context.Policies
                    .FirstOrDefaultAsync(x => x.PolicyId == claim.PolicyId);

            var vehicle =
                await _context.Vehicles
                    .FirstOrDefaultAsync(x => x.VehicleId == claim.VehicleId);

            var selectedParts = ParseSelectedParts(intake.InstantClaimParts);

            if (selectedParts.Count == 0)
            {
                throw new InvalidOperationException(
                    "No Instant Claim parts were selected on this claim.");
            }

            decimal removeRefit = 0, denting = 0, painting = 0, partsAmount = 0, salvage = 0;
            var versionParts = new List<string>();

            foreach (var partKey in selectedParts)
            {
                var partType = PartTypeNames[partKey];

                var rateCard =
                    await _context.InstantClaimRateCards
                        .Where(x => x.PartType == partType && x.IsActive)
                        .FirstOrDefaultAsync();

                if (rateCard == null)
                {
                    throw new InvalidOperationException(
                        $"Rate card not configured for part '{partType}'. " +
                        "An Admin must configure this before an estimate can be generated.");
                }

                var pricingQuery =
                    _context.InstantClaimPartsPricing
                        .Where(x => x.PartType == partType && x.IsActive);

                if (vehicle?.MakeId != null)
                {
                    pricingQuery =
                        pricingQuery.Where(
                            x => x.MakeId == vehicle.MakeId || x.MakeId == null);
                }

                var pricing =
                    await pricingQuery
                        .OrderByDescending(x => x.MakeId != null)
                        .FirstOrDefaultAsync();

                if (pricing == null)
                {
                    throw new InvalidOperationException(
                        $"Parts pricing not configured for part '{partType}'. " +
                        "An Admin must configure this before an estimate can be generated.");
                }

                removeRefit += rateCard.RemoveRefitCharge;
                denting += rateCard.DentingCharge;
                painting += rateCard.PaintingCharge;
                partsAmount += pricing.PartsAmount;
                salvage += pricing.PartsAmount * (rateCard.SalvagePercent / 100m);

                versionParts.Add($"{rateCard.RateCardId}:v{rateCard.Version}");
                versionParts.Add($"{pricing.PartsPricingId}:v{pricing.Version}");
            }

            var totalLabour = removeRefit + denting + painting;
            var excess = policy?.Excess ?? 0m;
            var otherDeductions = 0m;

            var netAmount =
                removeRefit + denting + painting + totalLabour + partsAmount - excess - salvage - otherDeductions;

            if (netAmount < 0)
            {
                netAmount = 0;
            }

            var lineItems = new EstimateLineItemsDto
            {
                RemoveRefitCharge = removeRefit,
                DentingCharge = denting,
                PaintingCharge = painting,
                TotalLabourCharges = totalLabour,
                TotalPartsAmount = partsAmount,
                PolicyExcess = excess,
                SalvageAmount = salvage,
                OtherDeductions = otherDeductions
            };

            var ruleSetVersion = string.Join(",", versionParts);

            var existing =
                await _context.ClaimEstimateResults
                    .FirstOrDefaultAsync(x => x.ClaimId == claimId);

            var isNew = existing == null;

            if (existing == null)
            {
                existing = new ClaimEstimateResult
                {
                    ClaimId = claimId
                };

                _context.ClaimEstimateResults.Add(existing);
            }

            existing.LineItems = JsonSerializer.Serialize(lineItems);
            existing.NetAssessmentAmount = netAmount;
            existing.RuleSetVersion = ruleSetVersion;
            existing.GeneratedAt = DateTime.UtcNow;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException) when (isNew)
            {
                // Two concurrent calls for the same claim (e.g. a React
                // effect double-invoke) can both see "no row yet" and both
                // try to insert. Whoever loses the race just updates the
                // row the winner created instead of failing.
                _context.Entry(existing).State = EntityState.Detached;

                existing =
                    await _context.ClaimEstimateResults
                        .FirstAsync(x => x.ClaimId == claimId);

                existing.LineItems = JsonSerializer.Serialize(lineItems);
                existing.NetAssessmentAmount = netAmount;
                existing.RuleSetVersion = ruleSetVersion;
                existing.GeneratedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();
            }

            await _auditLogService.LogAsync(
                null,
                "ClaimEstimate.Generated",
                "Claim",
                claimId,
                null,
                new { NetAssessmentAmount = netAmount, RuleSetVersion = ruleSetVersion });

            return new ClaimEstimateResultDto
            {
                ClaimId = claimId,
                LineItems = lineItems,
                NetAssessmentAmount = netAmount,
                RuleSetVersion = ruleSetVersion,
                GeneratedAt = existing.GeneratedAt,
                CustomerDecision = existing.CustomerDecision
            };
        }

        private static List<string> ParseSelectedParts(
            string instantClaimPartsJson)
        {
            var result = new List<string>();

            try
            {
                using var doc = JsonDocument.Parse(instantClaimPartsJson);

                foreach (var key in PartKeys)
                {
                    if (doc.RootElement.TryGetProperty(key, out var value) &&
                        value.ValueKind == JsonValueKind.True)
                    {
                        result.Add(key);
                    }
                }
            }
            catch (JsonException)
            {
                // Malformed/empty jsonb - treat as no parts selected.
            }

            return result;
        }
    }
}
