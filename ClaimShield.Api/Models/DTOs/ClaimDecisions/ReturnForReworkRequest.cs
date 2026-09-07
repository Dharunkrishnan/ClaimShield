using System.ComponentModel.DataAnnotations;

namespace ClaimShield.Api.Models.DTOs.ClaimDecisions
{
    public class ReturnForReworkRequest
    {
        [Required]
        [MaxLength(1000)]
        public string Remarks { get; set; } = string.Empty;
    }
}
