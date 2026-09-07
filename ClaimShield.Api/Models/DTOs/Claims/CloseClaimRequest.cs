using System.ComponentModel.DataAnnotations;

namespace ClaimShield.Api.Models.DTOs.Claims
{
    public class CloseClaimRequest
    {
        [Required]
        public int ClosureReasonId { get; set; }

        [MaxLength(1000)]
        public string? Remarks { get; set; }
    }
}