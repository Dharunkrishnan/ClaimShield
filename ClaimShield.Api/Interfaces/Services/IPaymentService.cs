using ClaimShield.Api.Models.DTOs.Payments;

namespace ClaimShield.Api.Interfaces.Services
{
    public interface IPaymentService
    {
        Task<IEnumerable<PaymentResponseDto>> GetAllAsync();

        Task<PaymentResponseDto?> GetByIdAsync(
            Guid paymentId);

        Task<IEnumerable<PaymentResponseDto>> GetByClaimAsync(
            Guid claimId);

        Task<PaymentResponseDto> CreateAsync(
            CreatePaymentRequest request);

        Task<bool> ProcessAsync(
            Guid paymentId);

        Task<(bool Success, string? ErrorMessage)> CompleteAsync(
            Guid paymentId);

        Task<bool> FailAsync(
            Guid paymentId,
            string? remarks);

        Task<bool> CancelAsync(
            Guid paymentId,
            string? remarks);

        Task<bool> DeleteAsync(
            Guid paymentId);
    }
}