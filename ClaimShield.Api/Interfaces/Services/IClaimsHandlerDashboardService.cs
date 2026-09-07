using ClaimShield.Api.Models.DTOs.ClaimsHandlerDashboard;

namespace ClaimShield.Api.Interfaces.Services
{
    public interface IClaimsHandlerDashboardService
    {
        Task<ClaimsHandlerDashboardSummaryDto> GetSummaryAsync(
            Guid userId,
            int roleId);

        // Checkpoint 7 - all claims this Claims Handler has (or had) a
        // survey assignment for, any status, each mapped to one of the
        // 8 real category buckets (All/Active/Pending Action/In
        // Progress/Under Review/On Hold/Completed/Closed) so the sidebar
        // "Claims" tabs show genuinely different, real data instead of
        // re-filtering the same pending-only queue.
        Task<IEnumerable<ClaimsHandlerClaimListItemDto>> GetMyClaimsAsync(
            Guid userId,
            int roleId);

        // TAT Performance widget - see TatSlaConstants for the SLA
        // thresholds. Scoped the same way GetSummaryAsync/
        // GetMyClaimsAsync already are (a Surveyor caller only sees
        // their own claims; Admin sees everything).
        Task<Models.DTOs.Dashboard.TatPerformanceResponseDto> GetTatPerformanceAsync(
            Guid userId,
            int roleId,
            DateTime periodStart,
            DateTime periodEnd);
    }
}