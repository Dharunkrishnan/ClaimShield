using ClaimShield.Api.Constants;
using ClaimShield.Api.Interfaces.Services;

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
    [Authorize(Roles = $"{RoleConstants.Surveyor},{RoleConstants.Admin}")]
    public class OcrController : ControllerBase
    {
        private readonly IOcrService _ocrService;

        public OcrController(
            IOcrService ocrService)
        {
            _ocrService = ocrService;
        }

        // =========================================================
        // EXTRACT TEXT/FIELDS FROM AN UPLOADED DOCUMENT IMAGE
        // POST: api/Ocr/extract
        // =========================================================

        [HttpPost("extract")]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(20971520)]
        public async Task<IActionResult> Extract(
            [FromForm] IFormFile file)
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest(new
                {
                    Success = false,
                    Message = "No file was uploaded."
                });
            }

            using var stream = new MemoryStream();
            await file.CopyToAsync(stream);
            var bytes = stream.ToArray();

            var result = await _ocrService.ExtractAsync(bytes);

            return Ok(result);
        }
    }
}