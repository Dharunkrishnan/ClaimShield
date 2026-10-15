using System.ComponentModel.DataAnnotations;

namespace ClaimShield.Api.Models.DTOs.Policies
{
    public class UpdatePolicyRequest
    {
        [Required]
        public Guid PolicyId { get; set; }

        [Required]
        public Guid CustomerId { get; set; }

        [Required]
        public Guid VehicleId { get; set; }

        [Required]
        public string PolicyNumber { get; set; } = string.Empty;

        public decimal CoverageAmount { get; set; }

        public decimal PremiumAmount { get; set; }

        public decimal? IDV { get; set; }

        public string? AddOns { get; set; }

        public DateTime StartDate { get; set; }

        public DateTime EndDate { get; set; }

        public int? PolicyTypeId { get; set; }

        public int? PolicyStatusId { get; set; }
    }
}