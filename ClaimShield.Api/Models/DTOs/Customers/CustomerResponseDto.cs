namespace ClaimShield.Api.Models.DTOs.Customers

{
    public class CustomerResponseDto
    {
        public Guid CustomerId { get; set; }

        public Guid UserId { get; set; }

        public string CustomerCode { get; set; } = string.Empty;

        public DateTime? DateOfBirth { get; set; }

        public string? Gender { get; set; }

        public string? AadhaarNumber { get; set; }

        public string? DrivingLicenseNumber { get; set; }

        public string? AddressLine1 { get; set; }

        public string? AddressLine2 { get; set; }

        public string? City { get; set; }

        public string? State { get; set; }

        public string? Pincode { get; set; }

        // Checkpoint 9 - resolved from the linked User record (not
        // stored on Customer itself), for staff-facing lookups where a
        // real name is more useful than the Customer Code alone.
        public string? CustomerName { get; set; }
    }
}