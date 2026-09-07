using ClaimShield.Api.Authentication;
using ClaimShield.Api.Constants;
using ClaimShield.Api.Interfaces.Services;
using ClaimShield.Api.Models.DTOs.Customers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace ClaimShield.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class CustomersController : ControllerBase
    {
        private readonly ICustomerService _customerService;
        private readonly ICurrentUserService _currentUserService;

        public CustomersController(
            ICustomerService customerService,
            ICurrentUserService currentUserService)
        {
            _customerService = customerService;
            _currentUserService = currentUserService;
        }

        private bool IsAdmin =>
            string.Equals(
                _currentUserService.RoleName,
                RoleConstants.Admin,
                StringComparison.OrdinalIgnoreCase);

        // Checkpoint 5 (Module 3) - the Claims Handler needs the
        // customer list for staff-assisted claim registration.
        private bool IsSurveyor =>
            string.Equals(
                _currentUserService.RoleName,
                RoleConstants.Surveyor,
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

        // =========================================================
        // MY CUSTOMER RECORD
        // GET: api/Customers/me
        // =========================================================
        //
        // Resolves the calling Customer's own CustomerId - there is
        // no other way for the frontend to learn this after login.
        // =========================================================

        [HttpGet("me")]
        public async Task<IActionResult> GetMyCustomerRecord()
        {
            if (!_currentUserService.UserId.HasValue)
            {
                return Forbidden(
                    "Unable to determine the logged-in user.");
            }

            var customer =
                await _customerService.GetCustomerByUserIdAsync(
                    _currentUserService.UserId.Value);

            if (customer == null)
            {
                return NotFound(new
                {
                    Success = false,
                    Message = "No customer record exists for this account."
                });
            }

            return Ok(customer);
        }

        // GET: api/Customers
        [HttpGet]
        public async Task<IActionResult> GetAllCustomers()
        {
            if (!IsAdmin && !IsSurveyor)
            {
                return Forbidden(
                    "Only an Admin or Claims Handler can list all customers.");
            }

            var customers = await _customerService.GetAllCustomersAsync();
            return Ok(customers);
        }

        // GET: api/Customers/{id}
        [HttpGet("{id:guid}")]
        public async Task<IActionResult> GetCustomerById(Guid id)
        {
            var customer = await _customerService.GetCustomerByIdAsync(id);

            if (customer == null)
                return NotFound();

            if (!IsAdmin &&
                customer.UserId != _currentUserService.UserId)
            {
                return Forbidden(
                    "You are not authorized to view this customer record.");
            }

            return Ok(customer);
        }

        // POST: api/Customers
        [HttpPost]
        [Authorize(Roles = RoleConstants.Admin)]
        public async Task<IActionResult> CreateCustomer(CreateCustomerRequest request)
        {
            var customer = await _customerService.CreateCustomerAsync(request);

            return CreatedAtAction(
                nameof(GetCustomerById),
                new { id = customer.CustomerId },
                customer);
        }

        // PUT: api/Customers
        [HttpPut]
        [Authorize(Roles = $"{RoleConstants.Surveyor},{RoleConstants.Approver},{RoleConstants.Admin}")]
        public async Task<IActionResult> UpdateCustomer(UpdateCustomerRequest request)
        {
            var updated = await _customerService.UpdateCustomerAsync(request);

            if (!updated)
                return NotFound();

            return Ok(new
            {
                Message = "Customer updated successfully."
            });
        }

        // DELETE: api/Customers/{id}
        [HttpDelete("{id:guid}")]
        [Authorize(Roles = RoleConstants.Admin)]
        public async Task<IActionResult> DeleteCustomer(Guid id)
        {
            var deleted = await _customerService.DeleteCustomerAsync(id);

            if (!deleted)
                return NotFound();

            return Ok(new
            {
                Message = "Customer deleted successfully."
            });
        }
    }
}