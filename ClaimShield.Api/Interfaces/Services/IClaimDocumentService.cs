using ClaimShield.Api.Models.DTOs.ClaimDocuments;
using ClaimShield.Api.Models.DTOs.Ocr;

namespace ClaimShield.Api.Interfaces.Services
{
    public interface IClaimDocumentService
    {
        Task<IEnumerable<ClaimDocumentResponseDto>> GetAllAsync();

        Task<ClaimDocumentResponseDto?> GetByIdAsync(
            Guid claimDocumentId);

        Task<IEnumerable<ClaimDocumentResponseDto>> GetByClaimAsync(
            Guid claimId);

        Task<ClaimDocumentResponseDto> CreateAsync(
            CreateClaimDocumentRequest request);

        Task<bool> UpdateAsync(
            Guid claimDocumentId,
            CreateClaimDocumentRequest request);

        Task<bool> DeleteAsync(
            Guid claimDocumentId);

        Task<bool> CanUserAccessClaimAsync(
            Guid claimId,
            Guid userId,
            int roleId);

        Task<(bool Success, string? Error, ClaimDocumentResponseDto? Document)> UploadAsync(
            Guid claimId,
            int documentTypeId,
            Guid uploadedBy,
            IFormFile file);

        Task<string?> GetDownloadUrlAsync(
            Guid claimDocumentId);

        Task<OcrExtractionResult?> GetOcrPreviewAsync(
            Guid claimDocumentId);
    }
}