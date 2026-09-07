using ClaimShield.Api.AI.Models;

namespace ClaimShield.Api.AI.Interfaces
{
    public interface IDecisionSupportService
    {
        Task<DecisionSupportSummaryDto> GetSummaryAsync(Guid claimId);
    }
}
