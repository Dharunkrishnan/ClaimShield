using ClaimShield.Api.Models.DTOs.Claims;

namespace ClaimShield.Api.Interfaces.Services
{
    public interface IClaimService
    {
        Task<IEnumerable<ClaimResponseDto>> GetAllClaimsAsync();

        Task<ClaimResponseDto?> GetClaimByIdAsync(Guid claimId);

        Task<IEnumerable<ClaimResponseDto>> GetClaimsByCustomerAsync(Guid customerId);

        Task<IEnumerable<ClaimResponseDto>> GetClaimsByPolicyAsync(Guid policyId);

        Task<IEnumerable<ClaimResponseDto>> GetClaimsByVehicleAsync(Guid vehicleId);

        Task<ClaimResponseDto> CreateClaimAsync(CreateClaimRequest request);

        Task<bool> UpdateClaimAsync(UpdateClaimRequest request);

        // Claim 360 - narrower than UpdateClaimAsync, see
        // UpdateClaimDetailsRequest for why this exists as a separate
        // method rather than reusing the broader one.
        Task<bool> UpdateClaimDetailsAsync(UpdateClaimDetailsRequest request);

        // Repair Authorization stage - see UpdateRepairAuthorizationRequest.
        Task<bool> UpdateRepairAuthorizationAsync(UpdateRepairAuthorizationRequest request);

        // Liability stage - see UpdateApprovedAmountRequest.
        Task<bool> UpdateApprovedAmountAsync(UpdateApprovedAmountRequest request);

        // Liability stage - see UpdateLiabilityFiguresRequest.
        Task<bool> UpdateLiabilityFiguresAsync(UpdateLiabilityFiguresRequest request);

        // Liability stage - the "I'm done, unlock Approval" action.
        Task<bool> SubmitLiabilityAsync(Guid claimId);

        // Liability stage - per-component damage table.
        Task<List<LiabilityDamageItemResponseDto>> GetLiabilityDamageItemsAsync(Guid claimId);

        Task<bool> UpdateLiabilityDamageItemsAsync(UpdateLiabilityDamageItemsRequest request);

        Task<bool> DeleteClaimAsync(Guid claimId);
    }
}