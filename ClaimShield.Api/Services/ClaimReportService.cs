using System.Text;
using ClaimShield.Api.Constants;
using ClaimShield.Api.Data.Context;
using ClaimShield.Api.Interfaces.Services;
using ClaimShield.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace ClaimShield.Api.Services
{
    // =================================================================
    // Checkpoint 3 - Claim Closure & Reporting (Module 10). Basic CSV
    // report generation over the same tables the Claims Handler
    // dashboard already reads - scoped the same way (Surveyor sees only
    // claims they have a SurveyAssignment for, Admin sees everything).
    // No PDF/MIS - CSV export is the whole requirement here.
    // =================================================================

    public class ClaimReportService : IClaimReportService
    {
        private readonly ClaimShieldDbContext _context;

        public ClaimReportService(ClaimShieldDbContext context)
        {
            _context = context;
        }

        public async Task<byte[]> GenerateClaimsCsvAsync(
            Guid userId,
            int roleId,
            string statusFilter)
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

            var claims =
                myClaimIds == null
                    ? await _context.Claims.ToListAsync()
                    : await _context.Claims
                        .Where(x => myClaimIds.Contains(x.ClaimId))
                        .ToListAsync();

            var claimIds = claims.Select(c => c.ClaimId).ToHashSet();

            var policies =
                await _context.Policies
                    .Where(x => claims.Select(c => c.PolicyId).Contains(x.PolicyId))
                    .ToDictionaryAsync(x => x.PolicyId);

            var customerNames =
                await GetCustomerNamesAsync(claims.Select(c => c.CustomerId));

            var payments =
                await _context.Payments
                    .Where(x => claimIds.Contains(x.ClaimId))
                    .ToListAsync();

            var paymentsByClaimId = payments.GroupBy(p => p.ClaimId).ToDictionary(g => g.Key, g => g.ToList());

            var surveyAssignments =
                await _context.SurveyAssignments
                    .Where(x => claimIds.Contains(x.ClaimId))
                    .ToListAsync();

            var latestSurveyAssignmentByClaimId =
                surveyAssignments
                    .GroupBy(x => x.ClaimId)
                    .ToDictionary(
                        g => g.Key,
                        g => g.OrderByDescending(x => x.AssignedDate).First());

            var surveyReports =
                await _context.SurveyReports
                    .Where(x => claimIds.Contains(x.ClaimId))
                    .ToListAsync();

            var latestSurveyReportByClaimId =
                surveyReports
                    .GroupBy(x => x.ClaimId)
                    .ToDictionary(
                        g => g.Key,
                        g => g.OrderByDescending(x => x.UpdatedDate ?? x.CreatedDate).First());

            var repairAssignments =
                await _context.RepairAssignments
                    .Where(x => claimIds.Contains(x.ClaimId))
                    .ToListAsync();

            var latestRepairAssignmentByClaimId =
                repairAssignments
                    .GroupBy(x => x.ClaimId)
                    .ToDictionary(
                        g => g.Key,
                        g => g.OrderByDescending(x => x.AssignedDate).First());

            var now = DateTime.UtcNow;
            var normalizedFilter = (statusFilter ?? "all").Trim().ToLowerInvariant();

            var rows = new List<string[]>();

            foreach (var claim in claims.OrderByDescending(c => c.CreatedDate))
            {
                var claimPayments =
                    paymentsByClaimId.TryGetValue(claim.ClaimId, out var p)
                        ? p
                        : new List<Payment>();

                var paymentBucket = GetPaymentBucket(claim, claimPayments);

                if (normalizedFilter != "all" && normalizedFilter != paymentBucket.ToLowerInvariant())
                {
                    continue;
                }

                policies.TryGetValue(claim.PolicyId, out var policy);
                customerNames.TryGetValue(claim.CustomerId, out var customerName);

                var slaStatus = GetSlaStatus(
                    claim,
                    now,
                    latestSurveyAssignmentByClaimId,
                    latestSurveyReportByClaimId,
                    latestRepairAssignmentByClaimId);

                var registeredDate = claim.CreatedDate;

                var tatEndDate =
                    claim.StatusId == ClaimStatusConstants.Closed
                        ? (claim.UpdatedDate ?? now)
                        : now;

                var totalTatDays =
                    registeredDate.HasValue
                        ? Math.Round((tatEndDate - registeredDate.Value).TotalDays, 1)
                        : (double?)null;

                rows.Add(new[]
                {
                    claim.ClaimNumber,
                    customerName ?? "Unknown",
                    policy?.PolicyNumber ?? "",
                    GetClaimStatusName(claim.StatusId),
                    paymentBucket,
                    registeredDate?.ToString("yyyy-MM-dd") ?? "",
                    totalTatDays?.ToString("0.0") ?? "",
                    slaStatus
                });
            }

            return BuildCsv(rows);
        }

        // =========================================================
        // PAYMENT BUCKET (Registered / Paid / Outstanding)
        // =========================================================

        private static string GetPaymentBucket(
            Claim claim,
            List<Payment> claimPayments)
        {
            if (claimPayments.Any(x => x.PaymentStatusId == PaymentStatusConstants.Paid))
            {
                return "Paid";
            }

            if (claim.StatusId >= ClaimStatusConstants.Approved)
            {
                return "Outstanding";
            }

            return "Registered";
        }

        // =========================================================
        // SLA STATUS - mirrors the per-stage thresholds
        // ClaimsHandlerDashboardService uses for its aggregate counts,
        // applied here to a single claim.
        // =========================================================

        private static string GetSlaStatus(
            Claim claim,
            DateTime now,
            Dictionary<Guid, SurveyAssignment> latestSurveyAssignmentByClaimId,
            Dictionary<Guid, SurveyReport> latestSurveyReportByClaimId,
            Dictionary<Guid, RepairAssignment> latestRepairAssignmentByClaimId)
        {
            if (claim.StatusId == ClaimStatusConstants.SurveyAssigned)
            {
                if (!latestSurveyAssignmentByClaimId.TryGetValue(claim.ClaimId, out var assignment) ||
                    assignment.AssignedDate == null)
                {
                    return "N/A";
                }

                var days = (now - assignment.AssignedDate.Value).TotalDays;

                return Classify(days, SlaConstants.SurveyNearBreachDays, SlaConstants.SurveyBreachDays);
            }

            if (claim.StatusId == ClaimStatusConstants.SurveyCompleted)
            {
                if (!latestSurveyReportByClaimId.TryGetValue(claim.ClaimId, out var report))
                {
                    return "N/A";
                }

                var relevantDate = report.UpdatedDate ?? report.CreatedDate;

                if (relevantDate == null)
                {
                    return "N/A";
                }

                var days = (now - relevantDate.Value).TotalDays;

                return Classify(days, SlaConstants.DecisionNearBreachDays, SlaConstants.DecisionBreachDays);
            }

            if (claim.StatusId == ClaimStatusConstants.RepairAssigned ||
                claim.StatusId == ClaimStatusConstants.RepairInProgress)
            {
                if (!latestRepairAssignmentByClaimId.TryGetValue(claim.ClaimId, out var assignment) ||
                    assignment.AssignedDate == null)
                {
                    return "N/A";
                }

                var days = (now - assignment.AssignedDate.Value).TotalDays;

                return Classify(days, SlaConstants.RepairNearBreachDays, SlaConstants.RepairBreachDays);
            }

            return "N/A";
        }

        private static string Classify(
            double days,
            int nearBreachDays,
            int breachDays)
        {
            if (days >= breachDays)
            {
                return "Breached";
            }

            if (days >= nearBreachDays)
            {
                return "Near Breach";
            }

            return "On Track";
        }

        // =========================================================
        // CUSTOMER NAME LOOKUP (mirrors ClaimDecisionService's helper)
        // =========================================================

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
                c =>
                {
                    if (!users.TryGetValue(c.UserId, out var user))
                    {
                        return "Unknown";
                    }

                    var firstName = user.FirstName?.Trim();
                    var lastName = user.LastName?.Trim();

                    return !string.IsNullOrWhiteSpace(firstName) && !string.IsNullOrWhiteSpace(lastName)
                        ? $"{firstName} {lastName}"
                        : (firstName ?? lastName ?? "Unknown");
                });
        }

        private static string GetClaimStatusName(int? statusId)
        {
            return statusId switch
            {
                ClaimStatusConstants.Submitted => "Submitted",
                ClaimStatusConstants.UnderReview => "Under Review",
                ClaimStatusConstants.SurveyAssigned => "Survey Assigned",
                ClaimStatusConstants.SurveyCompleted => "Survey Completed",
                ClaimStatusConstants.RepairAssigned => "Repair Assigned",
                ClaimStatusConstants.RepairInProgress => "Repair In Progress",
                ClaimStatusConstants.Approved => "Approved",
                ClaimStatusConstants.Rejected => "Rejected",
                ClaimStatusConstants.Settled => "Settled",
                ClaimStatusConstants.Closed => "Closed",
                _ => "Unknown"
            };
        }

        // =========================================================
        // CSV BUILDER
        // =========================================================

        private static byte[] BuildCsv(List<string[]> rows)
        {
            var sb = new StringBuilder();

            sb.AppendLine(
                "Claim Number,Customer Name,Policy Number,Status,Payment Status,Registered Date,Total TAT (days),SLA Status");

            foreach (var row in rows)
            {
                sb.AppendLine(string.Join(",", row.Select(EscapeCsvField)));
            }

            // UTF-8 BOM so Excel detects the encoding correctly.
            var preamble = Encoding.UTF8.GetPreamble();
            var body = Encoding.UTF8.GetBytes(sb.ToString());

            var result = new byte[preamble.Length + body.Length];
            Buffer.BlockCopy(preamble, 0, result, 0, preamble.Length);
            Buffer.BlockCopy(body, 0, result, preamble.Length, body.Length);

            return result;
        }

        private static string EscapeCsvField(string field)
        {
            if (field.Contains(',') || field.Contains('"') || field.Contains('\n'))
            {
                return "\"" + field.Replace("\"", "\"\"") + "\"";
            }

            return field;
        }
    }
}
