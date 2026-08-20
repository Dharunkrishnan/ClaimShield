using ClaimShield.Api.Models.DTOs.Vehicles;

namespace ClaimShield.Api.Interfaces.Services
{
    public interface IVehicleService
    {
        Task<IEnumerable<VehicleResponseDto>> GetAllVehiclesAsync();

        Task<VehicleResponseDto?> GetVehicleByIdAsync(Guid vehicleId);

        Task<IEnumerable<VehicleResponseDto>> GetVehiclesByCustomerAsync(Guid customerId);

        Task<VehicleResponseDto> CreateVehicleAsync(CreateVehicleRequest request);

        Task<bool> UpdateVehicleAsync(UpdateVehicleRequest request);

        // Customer-safe partial update - only ChassisNumber/EngineNumber,
        // only overwrites a field when a non-empty value is supplied.
        // Used by the Raise Claim wizard's OCR-capture popup.
        Task<bool> ConfirmOcrDetailsAsync(
            Guid vehicleId,
            ConfirmVehicleOcrDetailsRequest request);

        Task<bool> DeleteVehicleAsync(Guid vehicleId);
    }
}