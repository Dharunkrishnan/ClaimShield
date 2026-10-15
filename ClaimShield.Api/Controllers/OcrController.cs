using ClaimShield.Api.Authentication;
using ClaimShield.Api.Constants;
using ClaimShield.Api.Interfaces.Services;
using ClaimShield.Api.Models.DTOs.Ocr;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ClaimShield.Api.Controllers
{
    // Lightweight, non-persisting OCR extraction for the staff Register
    // Claim flow - lets the person registering a claim upload a
    // driving license or RC and immediately see what the document
    // contains, before the claim itself exists (so there is no ClaimId
    // yet to persist a ClaimRcOcrResults row against). This is
    // deliberately separate from the Customer-only RC-vs-number-plate
    // cross-match flow in ClaimRaiseService, which DOES persist to
    // ClaimRcOcrResults and requires both documents already uploaded
    // to an existing claim.
    //
    // Uses the same IOcrService (real local Tesseract OCR, see
    // TesseractOcrService) both flows share - this controller just
    // returns the raw extraction result directly instead of running
    // the RC-vs-plate match logic on it.
    [ApiController]
    [Route("api/Ocr")]
    [Authorize(Roles = $"{RoleConstants.Surveyor},{RoleConstants.Approver},{RoleConstants.Admin}")]
    public class OcrController : ControllerBase
    {
        private readonly IOcrService _ocrService;
        private readonly IClaimDocumentService _claimDocumentService;
        private readonly ICurrentUserService _currentUserService;

        public OcrController(
            IOcrService ocrService,
            IClaimDocumentService claimDocumentService,
            ICurrentUserService currentUserService)
        {
            _ocrService = ocrService;
            _claimDocumentService = claimDocumentService;
            _currentUserService = currentUserService;
        }

        private int CurrentRoleId =>
            _currentUserService.RoleName switch
            {
                RoleConstants.Customer => RoleConstants.CustomerId,
                RoleConstants.Repairer => RoleConstants.RepairerId,
                RoleConstants.Surveyor => RoleConstants.SurveyorId,
                RoleConstants.Approver => RoleConstants.ApproverId,
                RoleConstants.Admin => RoleConstants.AdminId,
                _ => 0
            };

        private static IActionResult Forbidden(
            string message)
        {
            return new ObjectResult(new
            {
                Success = false,
                Message = message
            })
            {
                StatusCode = StatusCodes.Status403Forbidden
            };
        }

        // =========================================================
        // EXTRACT TEXT/FIELDS FROM AN UPLOADED DOCUMENT IMAGE
        // POST: api/Ocr/extract
        // =========================================================

        [HttpPost("extract")]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(20971520)]
        public async Task<IActionResult> Extract(
            [FromForm] OcrExtractRequest request)
        {
            if (request.File == null || request.File.Length == 0)
            {
                return BadRequest(new
                {
                    Success = false,
                    Message = "No file was uploaded."
                });
            }

            using var stream = new MemoryStream();
            await request.File.CopyToAsync(stream);
            var bytes = stream.ToArray();

            var result = await _ocrService.ExtractAsync(bytes);

            return Ok(result);
        }

        // =========================================================
        // EXTRACT TEXT FROM A DOCUMENT ALREADY UPLOADED TO A CLAIM
        // (e.g. the repair quotation uploaded during Inspection) -
        // reads the stored file server-side rather than requiring the
        // browser to re-upload it just to see what's in it.
        // POST: api/Ocr/extract-document/{claimDocumentId}
        // =========================================================

        [HttpPost("extract-document/{claimDocumentId:guid}")]
        public async Task<IActionResult> ExtractDocument(
            Guid claimDocumentId)
        {
            var document =
                await _claimDocumentService.GetByIdAsync(claimDocumentId);

            if (document == null)
            {
                return NotFound(new
                {
                    Success = false,
                    Message = "Claim document not found."
                });
            }

            if (!_currentUserService.UserId.HasValue ||
                !await _claimDocumentService.CanUserAccessClaimAsync(
                    document.ClaimId,
                    _currentUserService.UserId.Value,
                    CurrentRoleId))
            {
                return Forbidden(
                    "You are not authorized to read this document.");
            }

            var bytes =
                await _claimDocumentService.GetFileBytesAsync(claimDocumentId);

            if (bytes == null)
            {
                return NotFound(new
                {
                    Success = false,
                    Message = "The stored file could not be found."
                });
            }

            var result = await _ocrService.ExtractAsync(bytes);

            return Ok(result);
        }
    }
}