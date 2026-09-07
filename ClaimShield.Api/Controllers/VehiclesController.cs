using ClaimShield.Api.Authentication;
using ClaimShield.Api.Constants;
using ClaimShield.Api.Interfaces.Repositories;
using ClaimShield.Api.Interfaces.Services;
using ClaimShield.Api.Models.DTOs.Vehicles;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace ClaimShield.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class VehiclesController : ControllerBase
    {
        private readonly IVehicleService _vehicleService;
        private readonly ICustomerRepository _customerRepository;
        private readonly ICurrentUserService _currentUserService;

        public VehiclesController(
            IVehicleService vehicleService,
            ICustomerRepository customerRepository,
            ICurrentUserService currentUserService)
        {
            _vehicleService = vehicleService;
            _customerRepository = customerRepository;
            _currentUserService = currentUserService;
        }

        private bool IsAdmin =>
            string.Equals(
                _currentUserService.RoleName,
                RoleConstants.Admin,
                StringComparison.OrdinalIgnoreCase);

        // Checkpoint 5 (Module 3) - the Claims Handler needs a
        // customer's vehicles for staff-assisted claim registration.
        private bool IsSurveyor =>
            string.Equals(
                _currentUserService.RoleName,
                RoleConstants.Surveyor,
                StringComparison.OrdinalIgnoreCase);

        // The Approver views the same Claim Information card (vehicle
        // chassis/engine number, IDV, policy type/period, add-ons) on a
        // claim's Inspection stage as the Surveyor does, so needs the
        // same read access to a claim's vehicle - not just their own.
        private bool IsApprover =>
            string.Equals(
                _currentUserService.RoleName,
                RoleConstants.Approver,
                StringComparison.OrdinalIgnoreCase);

        private static IActionResult Forbidden(
            string message)
        {
            return new ObjectResult(new
            {
                Success = false,
                Message = message
            })
            {
                StatusCode = StatusCodes.Status403Forbidden
            };
        }

        private async Task<bool> OwnsCustomerAsync(
            Guid customerId)
        {
            var customer =
                await _customerRepository.GetByIdAsync(
                    customerId);

            return
                customer != null &&
                customer.UserId == _currentUserService.UserId;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            if (!IsAdmin)
            {
                return Forbidden(
                    "Only an Admin can list all vehicles.");
            }

            return Ok(await _vehicleService.GetAllVehiclesAsync());
        }

        [HttpGet("{id:guid}")]
        public async Task<IActionResult> Get(Guid id)
        {
            var vehicle = await _vehicleService.GetVehicleByIdAsync(id);

            if (vehicle == null)
                return NotFound();

            if (!IsAdmin &&
                !await OwnsCustomerAsync(vehicle.CustomerId))
            {
                return Forbidden(
                    "You are not authorized to view this vehicle.");
            }

            return Ok(vehicle);
        }

        [HttpGet("customer/{customerId:guid}")]
        public async Task<IActionResult> GetByCustomer(Guid customerId)
        {
            if (!IsAdmin &&
                !IsSurveyor &&
                !IsApprover &&
                !await OwnsCustomerAsync(customerId))
            {
                return Forbidden(
                    "You are not authorized to view another customer's vehicles.");
            }

            return Ok(await _vehicleService.GetVehiclesByCustomerAsync(customerId));
        }

        [HttpPost]
        [Authorize(Roles = RoleConstants.Admin)]
        public async Task<IActionResult> Create(CreateVehicleRequest request)
        {
            var vehicle = await _vehicleService.CreateVehicleAsync(request);

            return CreatedAtAction(nameof(Get), new { id = vehicle.VehicleId }, vehicle);
        }

        [HttpPut]
        [Authorize(Roles = $"{RoleConstants.Surveyor},{RoleConstants.Approver},{RoleConstants.Admin}")]
        public async Task<IActionResult> Update(UpdateVehicleRequest request)
        {
            if (!await _vehicleService.UpdateVehicleAsync(request))
                return NotFound();

            return Ok(new { Message = "Vehicle updated successfully." });
        }

        [HttpDelete("{id:guid}")]
        [Authorize(Roles = RoleConstants.Admin)]
        public async Task<IActionResult> Delete(Guid id)
        {
            if (!await _vehicleService.DeleteVehicleAsync(id))
                return NotFound();

            return Ok(new { Message = "Vehicle deleted successfully." });
        }
    }
}