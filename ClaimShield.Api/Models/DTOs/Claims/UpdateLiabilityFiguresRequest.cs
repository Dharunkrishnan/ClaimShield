using System.ComponentModel.DataAnnotations;

namespace ClaimShield.Api.Models.DTOs.Claims
{
    // Liability stage - editable copies of the survey's own assessment
    // figures, saved separately (never overwrites SurveyReport's own
    // values) so the Approver can finalize/adjust liability figures
    // without altering the surveyor's historical assessment record.
    public class UpdateLiabilityFiguresRequest
    {
        [Required]
        public Guid ClaimId { get; set; }

        public decimal? LiabilityTotalLabour { get; set; }

        public decimal? LiabilityTotalParts { get; set; }

        public decimal? LiabilityTaxAmount { get; set; }

        public decimal? LiabilityDepWaiver { get; set; }

        public decimal? LiabilityDepreciationAmount { get; set; }

        public decimal? LiabilityCompulsoryExcess { get; set; }

        public decimal? LiabilityImposedExcess { get; set; }

        public decimal? LiabilitySalvageDeductions { get; set; }

        public decimal? LiabilityOtherDeduction { get; set; }

        public decimal? LiabilityTowingAmount { get; set; }
    }
}