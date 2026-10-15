using System.ComponentModel.DataAnnotations;

namespace ClaimShield.Api.Models.DTOs.Ocr
{
    /// <summary>
    /// Wraps the IFormFile for the OCR Extract endpoint so Swashbuckle
    /// can generate a valid multipart/form-data schema without throwing
    /// SwaggerGeneratorException.
    /// </summary>
    public class OcrExtractRequest
    {
        [Required]
        public IFormFile File { get; set; } = default!;
    }
}
