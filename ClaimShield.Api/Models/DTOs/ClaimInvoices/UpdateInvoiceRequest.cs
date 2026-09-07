using System.ComponentModel.DataAnnotations;

namespace ClaimShield.Api.Models.DTOs.ClaimInvoices
{
    public class UpdateInvoiceRequest
    {
        [Required]
        public DateTime InvoiceDate { get; set; }

        [Required]
        [MaxLength(100)]
        public string InvoiceNumber { get; set; } = string.Empty;

        [Required]
        [Range(0.01, double.MaxValue, ErrorMessage = "Invoice amount must be greater than zero.")]
        public decimal InvoiceAmount { get; set; }

        [Required]
        public int InvoiceFavour { get; set; }
    }
}