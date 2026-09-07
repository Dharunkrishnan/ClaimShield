using ClaimShield.Api.Models.DTOs.RepairEstimates;

namespace ClaimShield.Api.Interfaces.Services
{
    public interface IRepairEstimateService
    {
        Task<IEnumerable<RepairEstimateResponseDto>> GetAllAsync();

        Task<RepairEstimateResponseDto?> GetByIdAsync(
            Guid repairEstimateId);

        Task<IEnumerable<RepairEstimateResponseDto>> GetByClaimAsync(
            Guid claimId);

        Task<IEnumerable<RepairEstimateResponseDto>> GetByAssignmentAsync(
            Guid repairAssignmentId);

        Task<RepairEstimateResponseDto> CreateAsync(
            CreateRepairEstimateRequest request);

        Task<bool> UpdateAsync(
            UpdateRepairEstimateRequest request);

        Task<bool> DeleteAsync(
            Guid repairEstimateId);

        // Throws InvalidOperationException (not a bare false) when the
        // repair estimate exists but the underlying claim-level approval
        // is blocked by AuthorityLimits - callers should surface that
        // message directly rather than treat it as a generic not-found.
        Task<bool> ApproveAsync(
            Guid repairEstimateId,
            Guid approvedBy,
            int approvedByRoleId,
            ApproveRepairEstimateRequest request);

        // Unchanged - rejecting an estimate never touched Claim.StatusId
        // before this reconciliation and still doesn't; the Repairer just
        // submits a fresh estimate against the same assignment.
        Task<bool> RejectAsync(
            Guid repairEstimateId,
            Guid rejectedBy,
            RejectRepairEstimateRequest request);
    }
}