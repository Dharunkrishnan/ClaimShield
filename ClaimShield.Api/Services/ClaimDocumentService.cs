using ClaimShield.Api.Constants;
using ClaimShield.Api.Interfaces.Repositories;
using ClaimShield.Api.Interfaces.Services;
using ClaimShield.Api.Models.DTOs.ClaimDocuments;
using ClaimShield.Api.Models.DTOs.Ocr;
using ClaimShield.Api.Models.Entities;
using Microsoft.AspNetCore.Http;

namespace ClaimShield.Api.Services
{
    public class ClaimDocumentService : IClaimDocumentService
    {
        private readonly IClaimDocumentRepository _claimDocumentRepository;
        private readonly IClaimRepository _claimRepository;
        private readonly ICustomerRepository _customerRepository;
        private readonly ISurveyAssignmentRepository _surveyAssignmentRepository;
        private readonly IRepairAssignmentRepository _repairAssignmentRepository;
        private readonly ISupabaseStorageService _storageService;
        private readonly IOcrService _ocrService;
        private readonly IClaimDecisionService _claimDecisionService;

        public ClaimDocumentService(
            IClaimDocumentRepository claimDocumentRepository,
            IClaimRepository claimRepository,
            ICustomerRepository customerRepository,
            ISurveyAssignmentRepository surveyAssignmentRepository,
            IRepairAssignmentRepository repairAssignmentRepository,
            ISupabaseStorageService storageService,
            IOcrService ocrService,
            IClaimDecisionService claimDecisionService)
        {
            _claimDocumentRepository = claimDocumentRepository;
            _claimRepository = claimRepository;
            _customerRepository = customerRepository;
            _surveyAssignmentRepository = surveyAssignmentRepository;
            _repairAssignmentRepository = repairAssignmentRepository;
            _storageService = storageService;
            _ocrService = ocrService;
            _claimDecisionService = claimDecisionService;
        }

        // =========================================================
        // GET ALL
        // =========================================================

        public async Task<IEnumerable<ClaimDocumentResponseDto>> GetAllAsync()
        {
            var documents =
                await _claimDocumentRepository.GetAllAsync();

            return documents.Select(MapToDto);
        }

        // =========================================================
        // GET BY ID
        // =========================================================

        public async Task<ClaimDocumentResponseDto?> GetByIdAsync(
            Guid claimDocumentId)
        {
            var document =
                await _claimDocumentRepository.GetByIdAsync(
                    claimDocumentId);

            if (document == null)
            {
                return null;
            }

            return MapToDto(document);
        }

        // =========================================================
        // GET BY CLAIM
        // =========================================================

        public async Task<IEnumerable<ClaimDocumentResponseDto>> GetByClaimAsync(
            Guid claimId)
        {
            var documents =
                await _claimDocumentRepository.GetByClaimAsync(
                    claimId);

            return documents.Select(MapToDto);
        }

        // =========================================================
        // CREATE
        // =========================================================

        public async Task<ClaimDocumentResponseDto> CreateAsync(
            CreateClaimDocumentRequest request)
        {
            var document = new ClaimDocument
            {
                ClaimDocumentId = Guid.NewGuid(),

                ClaimId =
                    request.ClaimId,

                DocumentTypeId =
                    request.DocumentTypeId,

                FileName =
                    request.FileName,

                OriginalFileName =
                    request.OriginalFileName,

                FileExtension =
                    request.FileExtension,

                FileSize =
                    request.FileSize,

                FilePath =
                    request.FilePath,

                ContentType =
                    request.ContentType,

                UploadedBy =
                    request.UploadedBy,

                UploadedDate =
                    request.UploadedDate ?? DateTime.UtcNow,

                IsVerified =
                    request.IsVerified ?? false,

                VerifiedBy =
                    request.VerifiedBy,

                VerifiedDate =
                    request.VerifiedDate,

                Remarks =
                    request.Remarks
            };

            await _claimDocumentRepository.AddAsync(
                document);

            return MapToDto(document);
        }

        // =========================================================
        // UPDATE
        // =========================================================

        public async Task<bool> UpdateAsync(
            Guid claimDocumentId,
            CreateClaimDocumentRequest request)
        {
            var document =
                await _claimDocumentRepository.GetByIdAsync(
                    claimDocumentId);

            if (document == null)
            {
                return false;
            }

            document.ClaimId =
                request.ClaimId;

            document.DocumentTypeId =
                request.DocumentTypeId;

            document.FileName =
                request.FileName;

            document.OriginalFileName =
                request.OriginalFileName;

            document.FileExtension =
                request.FileExtension;

            document.FileSize =
                request.FileSize;

            document.FilePath =
                request.FilePath;

            document.ContentType =
                request.ContentType;

            document.UploadedBy =
                request.UploadedBy;

            document.UploadedDate =
                request.UploadedDate ?? document.UploadedDate;

            document.IsVerified =
                request.IsVerified ?? document.IsVerified;

            document.VerifiedBy =
                request.VerifiedBy;

            document.VerifiedDate =
                request.VerifiedDate;

            document.Remarks =
                request.Remarks;

            await _claimDocumentRepository.UpdateAsync(
                document);

            return true;
        }

        // =========================================================
        // DELETE
        // =========================================================

        public async Task<bool> DeleteAsync(
            Guid claimDocumentId)
        {
            var document =
                await _claimDocumentRepository.GetByIdAsync(
                    claimDocumentId);

            if (document == null)
            {
                return false;
            }

            await _storageService.DeleteAsync(
                document.FilePath);

            await _claimDocumentRepository.DeleteAsync(
                claimDocumentId);

            return true;
        }

        // =========================================================
        // CLAIM ACCESS CHECK
        //
        // Customer = 1, Repairer = 2, Surveyor = 3, Approver = 4,
        // Admin = 5. Mirrors MockAiService.
        // IsClaimAccessibleByCurrentUserAsync's access matrix.
        // =========================================================

        public async Task<bool> CanUserAccessClaimAsync(
            Guid claimId,
            Guid userId,
            int roleId)
        {
            if (roleId == RoleConstants.AdminId)
            {
                return true;
            }

            var claim =
                await _claimRepository.GetByIdAsync(
                    claimId);

            if (claim == null)
            {
                return false;
            }

            if (roleId == RoleConstants.SurveyorId)
            {
                var assignments =
                    await _surveyAssignmentRepository.GetByClaimAsync(
                        claimId);

                return assignments.Any(
                    x => x.SurveyorId == userId);
            }

            if (roleId == RoleConstants.RepairerId)
            {
                var assignments =
                    await _repairAssignmentRepository.GetByClaimAsync(
                        claimId);

                return assignments.Any(
                    x => x.RepairerId == userId);
            }

            if (roleId == RoleConstants.ApproverId)
            {
                // Status check rather than decision history: a claim
                // approved via repair-estimate approval
                // (IClaimApprovalService) never creates a ClaimDecision
                // row, so an approver-has-decided history check would
                // wrongly lock the Approver out once repairs are
                // underway (Phase 10). Checking >= RepairInProgress
                // covers the whole rest of the lifecycle regardless of
                // which approval path a claim took.
                if (claim.StatusId >= ClaimStatusConstants.RepairInProgress)
                {
                    return true;
                }

                // Also allow while a Surveyor decision is escalated and
                // awaiting Approver review (Claim.StatusId stays at
                // SurveyCompleted during that window).
                var latestDecision =
                    await _claimDecisionService.GetLatestDecisionAsync(
                        claimId);

                return latestDecision?.Escalated == true;
            }

            if (roleId == RoleConstants.CustomerId)
            {
                var customer =
                    await _customerRepository.GetByIdAsync(
                        claim.CustomerId);

                return customer != null && customer.UserId == userId;
            }

            return false;
        }

        // =========================================================
        // UPLOAD
        // =========================================================

        public async Task<(bool Success, string? Error, ClaimDocumentResponseDto? Document)> UploadAsync(
            Guid claimId,
            int documentTypeId,
            Guid uploadedBy,
            IFormFile file)
        {
            if (file == null || file.Length == 0)
            {
                return (false, "No file was provided.", null);
            }

            var claim =
                await _claimRepository.GetByIdAsync(
                    claimId);

            if (claim == null)
            {
                return (false, "Claim not found.", null);
            }

            var originalFileName =
                Path.GetFileName(file.FileName);

            var fileExtension =
                Path.GetExtension(originalFileName);

            var storedFileName =
                $"{Guid.NewGuid()}{fileExtension}";

            var objectPath =
                $"{claimId}/{storedFileName}";

            await using (var stream = file.OpenReadStream())
            {
                await _storageService.UploadAsync(
                    objectPath,
                    stream,
                    file.ContentType);
            }

            var document = new ClaimDocument
            {
                ClaimDocumentId = Guid.NewGuid(),

                ClaimId = claimId,

                DocumentTypeId = documentTypeId,

                FileName = storedFileName,

                OriginalFileName = originalFileName,

                FileExtension = fileExtension,

                FileSize = file.Length,

                FilePath = objectPath,

                ContentType =
                    string.IsNullOrWhiteSpace(file.ContentType)
                        ? "application/octet-stream"
                        : file.ContentType,

                UploadedBy = uploadedBy,

                UploadedDate = DateTime.UtcNow,

                IsVerified = false
            };

            await _claimDocumentRepository.AddAsync(
                document);

            return (true, null, MapToDto(document));
        }

        // =========================================================
        // DOWNLOAD URL
        // =========================================================

        public async Task<string?> GetDownloadUrlAsync(
            Guid claimDocumentId)
        {
            var document =
                await _claimDocumentRepository.GetByIdAsync(
                    claimDocumentId);

            if (document == null)
            {
                return null;
            }

            return await _storageService.CreateSignedUrlAsync(
                document.FilePath);
        }

        // =========================================================
        // OCR PREVIEW (single document, on-demand)
        // =========================================================
        //
        // Runs OCR against ONE already-uploaded document and returns
        // the extraction immediately, so the customer can see what
        // was read off their Number Plate / RC / DL right after
        // uploading it - separate from the full cross-check that
        // still happens once at Step 2 verification.
        // =========================================================

        public async Task<OcrExtractionResult?> GetOcrPreviewAsync(
            Guid claimDocumentId)
        {
            var document =
                await _claimDocumentRepository.GetByIdAsync(
                    claimDocumentId);

            if (document == null)
            {
                return null;
            }

            var bytes =
                await _storageService.DownloadAsync(
                    document.FilePath);

            return await _ocrService.ExtractAsync(bytes);
        }

        // =========================================================
        // MAPPING
        // =========================================================

        private static ClaimDocumentResponseDto MapToDto(
            ClaimDocument document)
        {
            return new ClaimDocumentResponseDto
            {
                ClaimDocumentId =
                    document.ClaimDocumentId,

                ClaimId =
                    document.ClaimId,

                DocumentTypeId =
                    document.DocumentTypeId,

                FileName =
                    document.FileName,

                OriginalFileName =
                    document.OriginalFileName,

                FileExtension =
                    document.FileExtension,

                FileSize =
                    document.FileSize,

                FilePath =
                    document.FilePath,

                ContentType =
                    document.ContentType,

                UploadedBy =
                    document.UploadedBy,

                UploadedDate =
                    document.UploadedDate,

                IsVerified =
                    document.IsVerified,

                VerifiedBy =
                    document.VerifiedBy,

                VerifiedDate =
                    document.VerifiedDate,

                Remarks =
                    document.Remarks
            };
        }
    }
}