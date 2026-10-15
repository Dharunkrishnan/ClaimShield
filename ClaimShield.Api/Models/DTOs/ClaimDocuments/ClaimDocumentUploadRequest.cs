using System.ComponentModel.DataAnnotations;

namespace ClaimShield.Api.Models.DTOs.ClaimDocuments
{
    /// <summary>
    /// Represents the multipart/form-data body for the document Upload endpoint.
    /// Wrapping every [FromForm] parameter (including IFormFile) in a single
    /// request class is required for Swashbuckle to generate a correct OpenAPI
    /// schema for actions that mix IFormFile with other form fields.
    /// </summary>
    public class ClaimDocumentUploadRequest
    {
        [Required]
        public Guid ClaimId { get; set; }

        [Required]
        public int DocumentTypeId { get; set; }

        [Required]
        public IFormFile File { get; set; } = default!;
    }
}
