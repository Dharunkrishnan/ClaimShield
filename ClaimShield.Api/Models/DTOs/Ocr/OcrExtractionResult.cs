namespace ClaimShield.Api.Models.DTOs.Ocr
{
    public class OcrExtractionResult
    {
        public string RawText { get; set; } = string.Empty;

        // --- RC-oriented fields ---
        public string? RegistrationNumber { get; set; }

        public string? OwnerName { get; set; }

        public string? ChassisNumber { get; set; }

        // --- Driving license-oriented fields ---
        // Best-effort in the same spirit as the RC fields above - there
        // is no single fixed format across Indian states for a DL
        // number, so this is a permissive pattern, not a guarantee.
        public string? LicenseNumber { get; set; }

        public string? DateOfBirth { get; set; }

        public string? ValidUntil { get; set; }

        public decimal Confidence { get; set; }
    }
}