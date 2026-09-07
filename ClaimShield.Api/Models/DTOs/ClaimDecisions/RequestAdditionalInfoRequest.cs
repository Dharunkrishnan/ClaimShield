using System.ComponentModel.DataAnnotations;

namespace ClaimShield.Api.Models.DTOs.ClaimDecisions
{
    public class RequestAdditionalInfoRequest
    {
        [Required]
        [MaxLength(500)]
        public string Reason { get; set; } = string.Empty;

        // RoleConstants.CustomerId or RoleConstants.RepairerId - who the
        // information is being requested from. Validated in the service
        // (only those two values are meaningful here).
        [Required]
        public int FromRoleId { get; set; }
    }
}
