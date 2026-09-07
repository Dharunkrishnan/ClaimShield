using System.ComponentModel.DataAnnotations;

namespace ClaimShield.Api.Models.DTOs.Claims
{
    // Liability stage - lets the Approver revise/finalize
    // Claim.ApprovedAmount using the survey's Net Assessment Amount as
    // a starting point, rather than being stuck with whatever value
    // was set back at Decision time (which may predate the completed
    // damage assessment). This IS the real field PaymentService caps
    // payments against - deliberately not a separate new "final
    // amount" field, since that would create two competing sources of
    // truth for the same thing.
    public class UpdateApprovedAmountRequest
    {
        [Required]
        public Guid ClaimId { get; set; }

        [Required]
        public decimal ApprovedAmount { get; set; }
    }
}