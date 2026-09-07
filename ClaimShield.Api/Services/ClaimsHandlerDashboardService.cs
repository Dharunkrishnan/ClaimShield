using ClaimShield.Api.Constants;
using ClaimShield.Api.Data.Context;
using ClaimShield.Api.Interfaces.Services;
using ClaimShield.Api.Models.DTOs.ClaimsHandlerDashboard;
using ClaimShield.Api.Models.DTOs.Dashboard;
using ClaimShield.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace ClaimShield.Api.Services
{
    // =================================================================
    // Phase 15 - Claims Handler dashboard summary. Read-only aggregation
    // over Claims/SurveyAssignments/SurveyReports/ClaimDecisions/
    // RepairAssignments/Payments - the same tables GetMyQueueAsync and
    // SurveyAssessment already read. Scoped to "claims I have a
    // SurveyAssignment for" for a Surveyor caller; unfiltered (every
    // claim in the relevant stages) for an Admin caller, matching
    // GetMyQueueAsync's existing Admin-sees-everything convention.
    // =================================================================

    public class ClaimsHandlerDashboardService : IClaimsHandlerDashboardService
    {
        private readonly ClaimShieldDbContext _context;

        public ClaimsHandlerDashboardService(ClaimShieldDbContext context)
        {
            _context = context;
        }

        public async Task<ClaimsHandlerDashboardSummaryDto> GetSummaryAsync(
            Guid userId,
            int roleId)
        {
            List<Guid>? myClaimIds = null;

            if (roleId == RoleConstants.SurveyorId)
            {
                myClaimIds =
                    await _context.SurveyAssignments
                        .Where(x => x.SurveyorId == userId)
                        .Select(x => x.ClaimId)
                        .Distinct()
                        .ToListAsync();
            }

            var myClaims =
                myClaimIds == null
                    ? await _context.Claims.ToListAsync()
                    : await _context.Claims
                        .Where(x => myClaimIds.Contains(x.ClaimId))
                        .ToListAsync();

            var myClaimIdSet = myClaims.Select(c => c.ClaimId).ToHashSet();

            // Checkpoint 5 - ClaimDecisions also holds Hold/Resume/Return
            // for Rework/Request Info rows now, not just real maker-
            // checker Approve/Review/Deny outcomes, so "decided" must be
            // filtered to those three - otherwise a claim that was
            // merely put on hold and resumed would be miscounted as
            // already decided and disappear from "awaiting decision".
            var decidedClaimIds =
                await _context.ClaimDecisions
                    .Where(
                        x =>
                            myClaimIdSet.Contains(x.ClaimId) &&
                            (x.Decision == ClaimDecisionConstants.Approve ||
                             x.Decision == ClaimDecisionConstants.Review ||
                             x.Decision == ClaimDecisionConstants.Deny))
                    .Select(x => x.ClaimId)
                    .Distinct()
                    .ToListAsync();

            var summary = new ClaimsHandlerDashboardSummaryDto
            {
                TotalMyClaims = myClaims.Count,

                AwaitingSurveyCount =
                    myClaims.Count(c => c.StatusId == ClaimStatusConstants.SurveyAssigned),

                AwaitingDecisionCount =
                    myClaims.Count(
                        c =>
                            c.StatusId == ClaimStatusConstants.SurveyCompleted &&
                            !decidedClaimIds.Contains(c.ClaimId)),

                InRepairCount =
                    myClaims.Count(
                        c =>
                            c.StatusId == ClaimStatusConstants.RepairAssigned ||
                            c.StatusId == ClaimStatusConstants.RepairInProgress),

                AwaitingSettlementCount =
                    myClaims.Count(c => c.StatusId == ClaimStatusConstants.Approved),

                ClosedThisMonthCount =
                    myClaims.Count(
                        c =>
                            c.StatusId == ClaimStatusConstants.Closed &&
                            c.UpdatedDate != null &&
                            c.UpdatedDate.Value.Year == DateTime.UtcNow.Year &&
                            c.UpdatedDate.Value.Month == DateTime.UtcNow.Month),

                OnHoldCount =
                    myClaims.Count(c => c.StatusId == ClaimStatusConstants.OnHold),

                InfoRequestedCount =
                    myClaims.Count(
                        c =>
                            c.InfoRequestReason != null &&
                            c.StatusId != ClaimStatusConstants.Closed)
            };

            var (breached, nearBreach) = await ComputeSlaCountsAsync(myClaims);
            summary.SlaBreachedCount = breached;
            summary.SlaNearBreachCount = nearBreach;

            var openAges =
                myClaims
                    .Where(
                        c =>
                            c.StatusId != ClaimStatusConstants.Closed &&
                            c.CreatedDate != null)
                    .Select(c => (DateTime.UtcNow - c.CreatedDate!.Value).TotalDays)
                    .ToList();

            summary.AverageOpenClaimAgeDays =
                openAges.Count > 0 ? openAges.Average() : null;

            return summary;
        }

        // ============================================================
        // Checkpoint 7 - all claims (any status) this Claims Handler has
        // a survey assignment for, mapped to a real category bucket.
        // Reuses the exact same scoping (SurveyAssignments.SurveyorId ==
        // userId, Admin sees everything) already used above in
        // GetSummaryAsync - this is a pure read, no new writes anywhere.
        // ============================================================

        public async Task<IEnumerable<ClaimsHandlerClaimListItemDto>> GetMyClaimsAsync(
            Guid userId,
            int roleId)
        {
            List<Guid>? myClaimIds = null;

            if (roleId == RoleConstants.SurveyorId)
            {
                myClaimIds =
                    await _context.SurveyAssignments
                        .Where(x => x.SurveyorId == userId)
                        .Select(x => x.ClaimId)
                        .Distinct()
                        .ToListAsync();
            }

            var myClaims =
                myClaimIds == null
                    ? await _context.Claims.ToListAsync()
                    : await _context.Claims
                        .Where(x => myClaimIds.Contains(x.ClaimId))
                        .ToListAsync();

            var customerIds = myClaims.Select(c => c.CustomerId).Distinct().ToList();
            var customerNames = await GetCustomerNamesAsync(customerIds);

            var policyIds = myClaims.Select(c => c.PolicyId).Distinct().ToList();
            var policyNumberByPolicyId =
                await _context.Policies
                    .Where(p => policyIds.Contains(p.PolicyId))
                    .ToDictionaryAsync(p => p.PolicyId, p => p.PolicyNumber);

            var vehicleIds = myClaims.Select(c => c.VehicleId).Distinct().ToList();
            var vehicleNumberByVehicleId =
                await _context.Vehicles
                    .Where(v => vehicleIds.Contains(v.VehicleId))
                    .ToDictionaryAsync(v => v.VehicleId, v => v.RegistrationNumber);

            var assignments =
                myClaimIds == null
                    ? await _context.SurveyAssignments.ToListAsync()
                    : await _context.SurveyAssignments
                        .Where(x => myClaimIds.Contains(x.ClaimId))
                        .ToListAsync();

            var latestAssignmentByClaim =
                assignments
                    .GroupBy(x => x.ClaimId)
                    .ToDictionary(
                        g => g.Key,
                        g => g.OrderByDescending(x => x.AssignedDate).First());

            var result = new List<ClaimsHandlerClaimListItemDto>();

            foreach (var claim in myClaims)
            {
                var relevantDate =
                    latestAssignmentByClaim.TryGetValue(claim.ClaimId, out var assignment)
                        ? assignment.AssignedDate
                        : claim.CreatedDate;

                result.Add(
                    new ClaimsHandlerClaimListItemDto
                    {
                        ClaimId = claim.ClaimId,
                        ClaimNumber = claim.ClaimNumber,
                        CustomerName = customerNames.GetValueOrDefault(claim.CustomerId),
                        StatusId = claim.StatusId ?? 0,
                        EstimatedLossAmount = claim.EstimatedLossAmount,
                        RelevantDate = relevantDate,
                        PolicyNumber = policyNumberByPolicyId.GetValueOrDefault(claim.PolicyId),
                        VehicleNumber = vehicleNumberByVehicleId.GetValueOrDefault(claim.VehicleId),
                        Category = CategoryFor(claim.StatusId ?? 0)
                    });
            }

            return result.OrderByDescending(x => x.RelevantDate);
        }

        private static string CategoryFor(int statusId)
        {
            if (statusId == ClaimStatusConstants.OnHold)
            {
                return "OnHold";
            }

            // Split out from the old combined Closed+Rejected bucket -
            // a genuinely Closed/settled claim and a Denied (Rejected)
            // one are very different outcomes and belong in separate
            // dashboard tiles, not lumped together.
            if (statusId == ClaimStatusConstants.Rejected)
            {
                return "Rejected";
            }

            if (statusId == ClaimStatusConstants.Closed)
            {
                return "Closed";
            }

            if (statusId == ClaimStatusConstants.Approved ||
                statusId == ClaimStatusConstants.Settled)
            {
                return "Completed";
            }

            if (statusId == ClaimStatusConstants.RepairAssigned ||
                statusId == ClaimStatusConstants.RepairInProgress)
            {
                return "InProgress";
            }

            if (statusId == ClaimStatusConstants.UnderReview)
            {
                return "UnderReview";
            }

            if (statusId == ClaimStatusConstants.SurveyAssigned ||
                statusId == ClaimStatusConstants.SurveyCompleted)
            {
                return "PendingAction";
            }

            return "Active";
        }

        private async Task<Dictionary<Guid, string>> GetCustomerNamesAsync(
            IEnumerable<Guid> customerIds)
        {
            var ids = customerIds.Distinct().ToList();

            var customers =
                await _context.Customers
                    .Where(x => ids.Contains(x.CustomerId))
                    .ToListAsync();

            var userIds = customers.Select(c => c.UserId).Distinct().ToList();

            var users =
                await _context.Users
                    .Where(x => userIds.Contains(x.UserId))
                    .ToDictionaryAsync(x => x.UserId);

            return customers.ToDictionary(
                c => c.CustomerId,
                c => users.TryGetValue(c.UserId, out var user)
                    ? GetUserDisplayName(user)
                    : "Unknown");
        }

        private static string GetUserDisplayName(Models.Entities.User? user)
        {
            if (user == null)
            {
                return "Unknown";
            }

            var firstName = user.FirstName?.Trim();
            var lastName = user.LastName?.Trim();
            var full = (firstName + " " + lastName).Trim();

            return string.IsNullOrEmpty(full) ? "Unknown" : full;
        }

        private async Task<(int Breached, int NearBreach)> ComputeSlaCountsAsync(
            List<Claim> myClaims)
        {
            var now = DateTime.UtcNow;
            var breached = 0;
            var nearBreach = 0;

            var awaitingSurveyClaimIds =
                myClaims
                    .Where(c => c.StatusId == ClaimStatusConstants.SurveyAssigned)
                    .Select(c => c.ClaimId)
                    .ToHashSet();

            if (awaitingSurveyClaimIds.Count > 0)
            {
                var assignments =
                    await _context.SurveyAssignments
                        .Where(x => awaitingSurveyClaimIds.Contains(x.ClaimId))
                        .ToListAsync();

                var latestPerClaim =
                    assignments
                        .GroupBy(x => x.ClaimId)
                        .Select(g => g.OrderByDescending(x => x.AssignedDate).First());

                foreach (var assignment in latestPerClaim)
                {
                    if (assignment.AssignedDate == null)
                    {
                        continue;
                    }

                    var days = (now - assignment.AssignedDate.Value).TotalDays;

                    if (days >= SlaConstants.SurveyBreachDays)
                    {
                        breached++;
                    }
                    else if (days >= SlaConstants.SurveyNearBreachDays)
                    {
                        nearBreach++;
                    }
                }
            }

            var decidedClaimIds =
                await _context.ClaimDecisions
                    .Where(
                        x =>
                            x.Decision == ClaimDecisionConstants.Approve ||
                            x.Decision == ClaimDecisionConstants.Review ||
                            x.Decision == ClaimDecisionConstants.Deny)
                    .Select(x => x.ClaimId)
                    .Distinct()
                    .ToListAsync();

            var awaitingDecisionClaimIds =
                myClaims
                    .Where(
                        c =>
                            c.StatusId == ClaimStatusConstants.SurveyCompleted &&
                            !decidedClaimIds.Contains(c.ClaimId))
                    .Select(c => c.ClaimId)
                    .ToHashSet();

            if (awaitingDecisionClaimIds.Count > 0)
            {
                var reports =
                    await _context.SurveyReports
                        .Where(x => awaitingDecisionClaimIds.Contains(x.ClaimId))
                        .ToListAsync();

                var latestPerClaim =
                    reports
                        .GroupBy(x => x.ClaimId)
                        .Select(
                            g => g.OrderByDescending(x => x.UpdatedDate ?? x.CreatedDate).First());

                foreach (var report in latestPerClaim)
                {
                    var relevantDate = report.UpdatedDate ?? report.CreatedDate;

                    if (relevantDate == null)
                    {
                        continue;
                    }

                    var days = (now - relevantDate.Value).TotalDays;

                    if (days >= SlaConstants.DecisionBreachDays)
                    {
                        breached++;
                    }
                    else if (days >= SlaConstants.DecisionNearBreachDays)
                    {
                        nearBreach++;
                    }
                }
            }

            var inRepairClaimIds =
                myClaims
                    .Where(
                        c =>
                            c.StatusId == ClaimStatusConstants.RepairAssigned ||
                            c.StatusId == ClaimStatusConstants.RepairInProgress)
                    .Select(c => c.ClaimId)
                    .ToHashSet();

            if (inRepairClaimIds.Count > 0)
            {
                var repairAssignments =
                    await _context.RepairAssignments
                        .Where(x => inRepairClaimIds.Contains(x.ClaimId))
                        .ToListAsync();

                var latestPerClaim =
                    repairAssignments
                        .GroupBy(x => x.ClaimId)
                        .Select(g => g.OrderByDescending(x => x.AssignedDate).First());

                foreach (var assignment in latestPerClaim)
                {
                    if (assignment.AssignedDate == null)
                    {
                        continue;
                    }

                    var days = (now - assignment.AssignedDate.Value).TotalDays;

                    if (days >= SlaConstants.RepairBreachDays)
                    {
                        breached++;
                    }
                    else if (days >= SlaConstants.RepairNearBreachDays)
                    {
                        nearBreach++;
                    }
                }
            }

            return (breached, nearBreach);
        }

        // =============================================================
        // TAT PERFORMANCE (see TatSlaConstants for SLA thresholds)
        // =============================================================

        public async Task<TatPerformanceResponseDto> GetTatPerformanceAsync(
            Guid userId,
            int roleId,
            DateTime periodStart,
            DateTime periodEnd)
        {
            List<Guid>? myClaimIds = null;

            if (roleId == RoleConstants.SurveyorId)
            {
                myClaimIds =
                    await _context.SurveyAssignments
                        .Where(x => x.SurveyorId == userId)
                        .Select(x => x.ClaimId)
                        .Distinct()
                        .ToListAsync();
            }

            // "Paid Claims" - same definition already used for the
            // dashboard hero's own "Paid claims" stat: Settled status.
            var paidClaimsQuery =
                _context.Claims.Where(x => x.StatusId == ClaimStatusConstants.Settled);

            if (myClaimIds != null)
            {
                paidClaimsQuery =
                    paidClaimsQuery.Where(x => myClaimIds.Contains(x.ClaimId));
            }

            var paidClaims = await paidClaimsQuery.ToListAsync();
            var claimIds = paidClaims.Select(x => x.ClaimId).ToList();

            var latestPaymentByClaimId =
                (await _context.Payments
                    .Where(p => claimIds.Contains(p.ClaimId))
                    .ToListAsync())
                .GroupBy(p => p.ClaimId)
                .ToDictionary(
                    g => g.Key,
                    g => g.OrderByDescending(p => p.PaymentDate ?? p.CreatedDate).First());

            var lastDocumentDateByClaimId =
                (await _context.ClaimDocuments
                    .Where(d => claimIds.Contains(d.ClaimId) && d.UploadedDate != null)
                    .ToListAsync())
                .GroupBy(d => d.ClaimId)
                .ToDictionary(
                    g => g.Key,
                    g => g.Max(d => d.UploadedDate!.Value));

            DateTime? SettledDateFor(Guid claimId)
            {
                if (!latestPaymentByClaimId.TryGetValue(claimId, out var payment))
                {
                    return null;
                }

                return payment.PaymentDate ?? payment.CreatedDate;
            }

            // Only claims actually settled inside the requested period
            // count toward that period's figures - otherwise a claim
            // paid in March would show up in April's report just
            // because that's when the report happened to be viewed.
            bool SettledInPeriod(Claim claim)
            {
                var settledDate = SettledDateFor(claim.ClaimId);
                return settledDate.HasValue &&
                    settledDate.Value >= periodStart &&
                    settledDate.Value < periodEnd;
            }

            var claimsInPeriod = paidClaims.Where(SettledInPeriod).ToList();

            var categories = new List<TatCategoryResultDto>
            {
                BuildTatCategory(
                    "Survey TAT",
                    TatSlaConstants.SurveyTatDays,
                    claimsInPeriod,
                    c => c.SurveyDate,
                    c => c.ReportedDate),

                BuildTatCategory(
                    "Repair Approval",
                    TatSlaConstants.RepairApprovalTatDays,
                    claimsInPeriod,
                    c => c.RepairAuthorizationDate,
                    c => c.SurveyDate),

                BuildTatCategory(
                    "Settlement 1 (vs Last Doc Date)",
                    TatSlaConstants.SettlementVsLastDocTatDays,
                    claimsInPeriod,
                    c => SettledDateFor(c.ClaimId),
                    c => lastDocumentDateByClaimId.TryGetValue(c.ClaimId, out var d)
                        ? d
                        : (DateTime?)null),

                BuildTatCategory(
                    "Settlement 1 (vs Intimation Date)",
                    TatSlaConstants.SettlementVsIntimationTatDays,
                    claimsInPeriod,
                    c => SettledDateFor(c.ClaimId),
                    c => c.ReportedDate),
            };

            return new TatPerformanceResponseDto
            {
                PeriodStart = periodStart,
                PeriodEnd = periodEnd,
                Categories = categories,
            };
        }

        private static TatCategoryResultDto BuildTatCategory(
            string label,
            int slaDays,
            IEnumerable<Claim> claims,
            Func<Claim, DateTime?> endDateSelector,
            Func<Claim, DateTime?> startDateSelector)
        {
            var tatDaysList = new List<double>();
            var withinCount = 0;
            var outsideCount = 0;

            foreach (var claim in claims)
            {
                var endDate = endDateSelector(claim);
                var startDate = startDateSelector(claim);

                if (endDate == null || startDate == null)
                {
                    continue;
                }

                var tatDays = (endDate.Value - startDate.Value).TotalDays;

                // Bad/out-of-order data (end before start) - skip rather
                // than show a nonsensical negative TAT.
                if (tatDays < 0)
                {
                    continue;
                }

                tatDaysList.Add(tatDays);

                if (tatDays <= slaDays)
                {
                    withinCount++;
                }
                else
                {
                    outsideCount++;
                }
            }

            return new TatCategoryResultDto
            {
                Category = label,
                SlaDays = slaDays,
                AverageTatDays =
                    tatDaysList.Count > 0
                        ? Math.Round(tatDaysList.Average(), 1)
                        : (double?)null,
                WithinTatCount = withinCount,
                OutsideTatCount = outsideCount,
            };
        }
    }
}