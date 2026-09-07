using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ClaimShield.Api.Models.Entities
{
    [Table("Payments", Schema = "dbo")]
    public class Payment
    {
        [Key]
        public Guid PaymentId { get; set; }

        public Guid ClaimId { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal Amount { get; set; }

        public int PaymentStatusId { get; set; }

        [MaxLength(100)]
        public string? TransactionReference { get; set; }

        public DateTime? PaymentDate { get; set; }

        [MaxLength(500)]
        public string? Remarks { get; set; }

        // Checkpoint 3 - Payment Processing additions. Nullable so
        // existing rows created before this change remain valid; new
        // payments are required to supply these via PaymentService's
        // own validation (DataAnnotations can't express "IFSC/account
        // required unless Cheque" conditionally).
        public int? PaymentMethodId { get; set; }

        // "Payments To" - Customer or Repairer (see PayeeTypeConstants).
        // Nullable for the same reason as PaymentMethodId above -
        // existing rows predate this field.
        public int? PayeeType { get; set; }

        [MaxLength(50)]
        public string? PayeeCode { get; set; }

        [MaxLength(200)]
        public string? BeneficiaryName { get; set; }

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

        public DateTime? CreatedDate { get; set; }
    }
}