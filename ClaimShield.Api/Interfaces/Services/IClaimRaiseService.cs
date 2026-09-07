using ClaimShield.Api.Models.DTOs.ClaimRaise;

namespace ClaimShield.Api.Interfaces.Services
{
    public class EstimateOrNotEligible
    {
        public bool Eligible { get; set; }

        public string? Reason { get; set; }

        public Models.DTOs.InstantClaim.ClaimEstimateResultDto? Estimate { get; set; }
    }

    public class ClaimRaiseActionResult
    {
        public bool Success { get; set; }

        public string Message { get; set; } = string.Empty;
    }

    public interface IClaimRaiseService
    {
        Task<(bool Success, string? Error, RaiseStep1ResponseDto? Result)> Step1Async(
            Guid userId,
            RaiseStep1Request request);

        Task<(bool Success, string? Error, RaiseStep2ResponseDto? Result)> Step2Async(
            Guid claimId,
            Guid userId,
            RaiseStep2Request request);

        Task<(bool Success, string? Error, EstimateOrNotEligible? Result)> GenerateEstimateAsync(
            Guid claimId,
            Guid userId);

        Task<(bool Success, string? Error, ClaimRaiseActionResult? Result)> AcceptAsync(
            Guid claimId,
            Guid userId);

        Task<(bool Success, string? Error, ClaimRaiseActionResult? Result)> DeclineAsync(
            Guid claimId,
            Guid userId);

        // Checkpoint 5 (Module 3) - staff-assisted registration/intake,
        // reusing the same CreateClaimAsync + ClaimIntake pattern as
        // Step1Async above rather than a separate writer.
        Task<(bool Success, string? Error, RaiseStep1ResponseDto? Result)> StaffRegisterAsync(
            Guid staffUserId,
            StaffRegisterClaimRequest request);
    }
}
