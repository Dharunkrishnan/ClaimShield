using ClaimShield.Api.Models.DTOs.ClaimSettlements;

namespace ClaimShield.Api.Interfaces.Services
{
    public interface IClaimSettlementService
    {
        Task<ClaimSettlementResponseDto?> GetByClaimAsync(Guid claimId);

        Task<ClaimSettlementResponseDto> ComputeAsync(Guid claimId);
    }
}
