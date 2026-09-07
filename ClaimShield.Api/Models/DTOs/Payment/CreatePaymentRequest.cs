using System.ComponentModel.DataAnnotations;

namespace ClaimShield.Api.Models.DTOs.Payments
{
    public class CreatePaymentRequest
    {
        [Required]
        public Guid ClaimId { get; set; }

        [Required]
        [Range(0.01, double.MaxValue)]
        public decimal Amount { get; set; }

        [MaxLength(100)]
        public string? TransactionReference { get; set; }

        public DateTime? PaymentDate { get; set; }

        [MaxLength(500)]
        public string? Remarks { get; set; }

        [Required]
        public int PaymentMethodId { get; set; }

        [Required]
        public int PayeeType { get; set; }

        [Required]
        [MaxLength(50)]
        public string PayeeCode { get; set; } = string.Empty;

        [Required]
        [MaxLength(200)]
        public string BeneficiaryName { get; set; } = string.Empty;

        [MaxLength(34)]
        public string? BankAccountNumber { get; set; }

        [MaxLength(11)]
        public string? IfscCode { get; set; }

        [MaxLength(200)]
        public string? BankName { get; set; }

        [MaxLength(200)]
        public string? BranchName { get; set; }

        [MaxLength(10)]
        public string? MobileNumber { get; set; }
    }
}