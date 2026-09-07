using System.ComponentModel.DataAnnotations;

namespace ClaimShield.Api.Models.DTOs.Claims
{
    // Repair Authorization stage - deliberately narrow, same reasoning
    // as UpdateClaimDetailsRequest: only ever touches these two fields,
    // never Status/ApprovedAmount, which stay gated behind the claim's
    // real decision/approval/payment workflows.
    public class UpdateRepairAuthorizationRequest
    {
        [Required]
        public Guid ClaimId { get; set; }

        [Required]
        public int RepairAuthorizationStatusId { get; set; }

        public DateTime? RepairAuthorizationDate { get; set; }
    }
}