using System.ComponentModel.DataAnnotations;

namespace ClaimShield.Api.Models.DTOs.Claims
{
    // Claim 360 - deliberately much narrower than UpdateClaimRequest.
    // That endpoint also lets a caller directly set StatusId and
    // ApprovedAmount, which would let a Surveyor/Approver bypass the
    // whole decision/authority-limit workflow (ClaimDecisionService)
    // entirely if this page were authorized to use it. This DTO only
    // ever touches incident-detail fields that don't drive any claim
    // lifecycle transition, so it's safe to open up to Surveyor and
    // Approver, not just Admin.
    public class UpdateClaimDetailsRequest
    {
        [Required]
        public Guid ClaimId { get; set; }

        [Required]
        public DateTime IncidentDate { get; set; }

        [MaxLength(500)]
        public string? IncidentLocation { get; set; }

        public string? IncidentDescription { get; set; }

        public decimal? EstimatedLossAmount { get; set; }
    }
}