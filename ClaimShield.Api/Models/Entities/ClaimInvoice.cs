using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ClaimShield.Api.Models.Entities
{
    // Liability stage - Invoice Particulars. A claim can have more than
    // one invoice (e.g. separate labour and parts bills, or bills
    // raised in favour of different parties), so this is its own table
    // keyed by ClaimInvoiceId, not columns on Claim.
    [Table("ClaimInvoices")]
    public class ClaimInvoice
    {
        [Key]
        public Guid ClaimInvoiceId { get; set; }

        public Guid ClaimId { get; set; }

        public DateTime InvoiceDate { get; set; }

        [MaxLength(100)]
        public string InvoiceNumber { get; set; } = string.Empty;

        [Column(TypeName = "decimal(18,2)")]
        public decimal InvoiceAmount { get; set; }

        // See InvoiceFavourConstants (ClaimShield+ / Insured / Financier
        // / Corporate Customer).
        public int InvoiceFavour { get; set; }

        public DateTime CreatedDate { get; set; }

        public DateTime? UpdatedDate { get; set; }
    }
}