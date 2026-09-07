using ClaimShield.Api.Models.DTOs.Claims;

namespace ClaimShield.Api.Interfaces.Services
{
    public interface IClaimClosureService
    {
        Task<bool> CloseClaimAsync(
            Guid claimId,
            CloseClaimRequest request);

        // Closes or denies a claim directly from the Repair
        // Authorization stage, bypassing Liability/Approval/
        // Settlement entirely. Returns (success, errorMessage).
        Task<(bool Success, string? ErrorMessage)> CloseOrDenyFromRepairAuthorizationAsync(
            Guid claimId,
            RepairAuthCloseOrDenyRequest request);
    }
}