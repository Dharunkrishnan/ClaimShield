namespace ClaimShield.Api.Models.DTOs.Vehicles
{
    // Narrow, customer-safe request used only to persist Chassis/Engine
    // numbers the customer confirmed after OCR read them off an
    // uploaded RC photo during the Raise Claim wizard. Deliberately
    // does NOT reuse UpdateVehicleRequest (which is Admin-only and
    // covers every vehicle field) - this endpoint only ever touches
    // these two columns.
    public class ConfirmVehicleOcrDetailsRequest
    {
        public string? ChassisNumber { get; set; }

        public string? EngineNumber { get; set; }
    }
}