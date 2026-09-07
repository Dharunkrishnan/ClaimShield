namespace ClaimShield.Api.Models.DTOs.ClaimInvoices
{
    public class InvoiceResponseDto
    {
        public Guid ClaimInvoiceId { get; set; }

        public Guid ClaimId { get; set; }

        public DateTime InvoiceDate { get; set; }

        public string InvoiceNumber { get; set; } = string.Empty;

        public decimal InvoiceAmount { get; set; }

        public int InvoiceFavour { get; set; }

        public string InvoiceFavourName { get; set; } = string.Empty;

        public DateTime CreatedDate { get; set; }

        public DateTime? UpdatedDate { get; set; }
    }
}