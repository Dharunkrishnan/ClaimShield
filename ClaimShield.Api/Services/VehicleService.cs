using ClaimShield.Api.Interfaces.Repositories;
using ClaimShield.Api.Interfaces.Services;
using ClaimShield.Api.Models.DTOs.Vehicles;
using ClaimShield.Api.Models.Entities;

namespace ClaimShield.Api.Services
{
    public class VehicleService : IVehicleService
    {
        private readonly IVehicleRepository _vehicleRepository;

        public VehicleService(IVehicleRepository vehicleRepository)
        {
            _vehicleRepository = vehicleRepository;
        }

        public async Task<IEnumerable<VehicleResponseDto>> GetAllVehiclesAsync()
        {
            var vehicles = await _vehicleRepository.GetAllAsync();

            return vehicles.Select(v => new VehicleResponseDto
            {
                VehicleId = v.VehicleId,
                CustomerId = v.CustomerId,
                RegistrationNumber = v.RegistrationNumber,
                ChassisNumber = v.ChassisNumber,
                EngineNumber = v.EngineNumber,
                Variant = v.Variant,
                ManufacturingYear = v.ManufacturingYear,
                VehicleColor = v.VehicleColor,
                RCNumber = v.RCNumber,
                IsActive = v.IsActive,
                MakeId = v.MakeId,
                ModelId = v.ModelId,
                FuelTypeId = v.FuelTypeId,
                RCStatus = v.RCStatus
            });
        }

        public async Task<VehicleResponseDto?> GetVehicleByIdAsync(Guid vehicleId)
        {
            var v = await _vehicleRepository.GetByIdAsync(vehicleId);

            if (v == null)
                return null;

            return new VehicleResponseDto
            {
                VehicleId = v.VehicleId,
                CustomerId = v.CustomerId,
                RegistrationNumber = v.RegistrationNumber,
                ChassisNumber = v.ChassisNumber,
                EngineNumber = v.EngineNumber,
                Variant = v.Variant,
                ManufacturingYear = v.ManufacturingYear,
                VehicleColor = v.VehicleColor,
                RCNumber = v.RCNumber,
                IsActive = v.IsActive,
                MakeId = v.MakeId,
                ModelId = v.ModelId,
                FuelTypeId = v.FuelTypeId,
                RCStatus = v.RCStatus
            };
        }

        public async Task<IEnumerable<VehicleResponseDto>> GetVehiclesByCustomerAsync(Guid customerId)
        {
            var vehicles = await _vehicleRepository.GetByCustomerIdAsync(customerId);

            return vehicles.Select(v => new VehicleResponseDto
            {
                VehicleId = v.VehicleId,
                CustomerId = v.CustomerId,
                RegistrationNumber = v.RegistrationNumber,
                ChassisNumber = v.ChassisNumber,
                EngineNumber = v.EngineNumber,
                Variant = v.Variant,
                ManufacturingYear = v.ManufacturingYear,
                VehicleColor = v.VehicleColor,
                RCNumber = v.RCNumber,
                IsActive = v.IsActive,
                MakeId = v.MakeId,
                ModelId = v.ModelId,
                FuelTypeId = v.FuelTypeId,
                RCStatus = v.RCStatus
            });
        }

        public async Task<VehicleResponseDto> CreateVehicleAsync(CreateVehicleRequest request)
        {
            var vehicle = new Vehicle
            {
                VehicleId = Guid.NewGuid(),
                CustomerId = request.CustomerId,
                RegistrationNumber = request.RegistrationNumber,
                ChassisNumber = request.ChassisNumber,
                EngineNumber = request.EngineNumber,
                Variant = request.Variant,
                ManufacturingYear = request.ManufacturingYear,
                VehicleColor = request.VehicleColor,
                RCNumber = request.RCNumber,
                MakeId = request.MakeId,
                ModelId = request.ModelId,
                FuelTypeId = request.FuelTypeId,
                IsActive = true,
                CreatedDate = DateTime.UtcNow
            };

            await _vehicleRepository.AddAsync(vehicle);

            return (await GetVehicleByIdAsync(vehicle.VehicleId))!;
        }

        public async Task<bool> UpdateVehicleAsync(UpdateVehicleRequest request)
        {
            var vehicle = await _vehicleRepository.GetByIdAsync(request.VehicleId);

            if (vehicle == null)
                return false;

            vehicle.CustomerId = request.CustomerId;
            vehicle.RegistrationNumber = request.RegistrationNumber;
            vehicle.ChassisNumber = request.ChassisNumber;
            vehicle.EngineNumber = request.EngineNumber;
            vehicle.Variant = request.Variant;
            vehicle.ManufacturingYear = request.ManufacturingYear;
            vehicle.VehicleColor = request.VehicleColor;
            vehicle.RCNumber = request.RCNumber;
            vehicle.MakeId = request.MakeId;
            vehicle.ModelId = request.ModelId;
            vehicle.FuelTypeId = request.FuelTypeId;
            vehicle.IsActive = request.IsActive;
            vehicle.UpdatedDate = DateTime.UtcNow;

            await _vehicleRepository.UpdateAsync(vehicle);

            return true;
        }

        public async Task<bool> ConfirmOcrDetailsAsync(
            Guid vehicleId,
            ConfirmVehicleOcrDetailsRequest request)
        {
            var vehicle = await _vehicleRepository.GetByIdAsync(vehicleId);

            if (vehicle == null)
                return false;

            // Only ever overwrites with a real value - a blank/null
            // OCR result never blanks out existing data.
            if (!string.IsNullOrWhiteSpace(request.ChassisNumber))
            {
                vehicle.ChassisNumber = request.ChassisNumber.Trim();
            }

            if (!string.IsNullOrWhiteSpace(request.EngineNumber))
            {
                vehicle.EngineNumber = request.EngineNumber.Trim();
            }

            vehicle.UpdatedDate = DateTime.UtcNow;

            await _vehicleRepository.UpdateAsync(vehicle);

            return true;
        }

        public async Task<bool> DeleteVehicleAsync(Guid vehicleId)
        {
            var vehicle = await _vehicleRepository.GetByIdAsync(vehicleId);

            if (vehicle == null)
                return false;

            await _vehicleRepository.DeleteAsync(vehicleId);

            return true;
        }
    }
}