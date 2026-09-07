using System.ComponentModel.DataAnnotations;

namespace ClaimShield.Api.Models.DTOs.ClaimDecisions
{
    public class HoldClaimRequest
    {
        [Required]
        [MaxLength(500)]
        public string Reason { get; set; } = string.Empty;
    }
}
