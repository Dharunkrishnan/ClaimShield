namespace ClaimShield.Api.Models.DTOs.Payments
{
    public class PaymentResponseDto
    {
        public Guid PaymentId { get; set; }

        public Guid ClaimId { get; set; }

        public decimal Amount { get; set; }

        public int PaymentStatusId { get; set; }

        public string PaymentStatus { get; set; } = string.Empty;

        public string? TransactionReference { get; set; }

        public DateTime? PaymentDate { get; set; }

        public string? Remarks { get; set; }

        public int? PaymentMethodId { get; set; }

        public string? PaymentMethod { get; set; }

        public int? PayeeType { get; set; }

        public string? PayeeTypeName { get; set; }

        public string? PayeeCode { get; set; }

        public string? BeneficiaryName { get; set; }

        public string? BankAccountNumber { get; set; }

        public string? IfscCode { get; set; }

        public string? BankName { get; set; }

        public string? BranchName { get; set; }

        public string? MobileNumber { get; set; }

        public DateTime? CreatedDate { get; set; }
    }
}