using ClaimShield.Api.Models.DTOs.ClaimInvoices;

namespace ClaimShield.Api.Interfaces.Services
{
    public interface IClaimInvoiceService
    {
        Task<IEnumerable<InvoiceResponseDto>> GetByClaimAsync(
            Guid claimId);

        Task<InvoiceResponseDto> CreateAsync(
            Guid claimId,
            CreateInvoiceRequest request);

        Task<InvoiceResponseDto?> UpdateAsync(
            Guid claimInvoiceId,
            UpdateInvoiceRequest request);

        Task<bool> DeleteAsync(
            Guid claimInvoiceId);
    }
}