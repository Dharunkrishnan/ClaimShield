using System.ComponentModel.DataAnnotations;

namespace ClaimShield.Api.Models.DTOs.Claims
{
    // Action is either "Closure" or "Denial" - exactly one of
    // ClosureReasonId / DenialReasonId should be provided, matching
    // whichever Action is chosen. See RepairAuthClosureReasonConstants
    // / RepairAuthDenialReasonConstants for the valid id ranges.
    public class RepairAuthCloseOrDenyRequest
    {
        [Required]
        public string Action { get; set; } = string.Empty;

        public int? ClosureReasonId { get; set; }

        public int? DenialReasonId { get; set; }

        [Required]
        [MaxLength(1000)]
        public string Remarks { get; set; } = string.Empty;
    }
}