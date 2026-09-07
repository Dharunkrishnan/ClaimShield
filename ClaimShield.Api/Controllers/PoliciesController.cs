using ClaimShield.Api.Authentication;
using ClaimShield.Api.Constants;
using ClaimShield.Api.Interfaces.Repositories;
using ClaimShield.Api.Interfaces.Services;
using ClaimShield.Api.Models.DTOs.Policies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace ClaimShield.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class PoliciesController : ControllerBase
    {
        private readonly IPolicyService _policyService;
        private readonly ICustomerRepository _customerRepository;
        private readonly ICurrentUserService _currentUserService;

        public PoliciesController(
            IPolicyService policyService,
            ICustomerRepository customerRepository,
            ICurrentUserService currentUserService)
        {
            _policyService = policyService;
            _customerRepository = customerRepository;
            _currentUserService = currentUserService;
        }

        private bool IsAdmin =>
            string.Equals(
                _currentUserService.RoleName,
                RoleConstants.Admin,
                StringComparison.OrdinalIgnoreCase);

        // Checkpoint 5 (Module 3) - the Claims Handler needs a
        // customer's policies for staff-assisted claim registration.
        private bool IsSurveyor =>
            string.Equals(
                _currentUserService.RoleName,
                RoleConstants.Surveyor,
                StringComparison.OrdinalIgnoreCase);

        // The Approver views the same Claim Information card (IDV,
        // policy type/period, add-ons) on a claim's Inspection stage as
        // the Surveyor does, so needs the same read access to a claim's
        // policy - not just their own.
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
            // Checkpoint 9 - Claims Handler (Surveyor) can also list all
            // policies, to support looking a customer up by policy
            // number directly on the Register Claim form.
            if (!IsAdmin && !IsSurveyor)
            {
                return Forbidden(
                    "Only an Admin or Claims Handler can list all policies.");
            }

            return Ok(await _policyService.GetAllPoliciesAsync());
        }

        [HttpGet("{id:guid}")]
        public async Task<IActionResult> Get(Guid id)
        {
            var policy = await _policyService.GetPolicyByIdAsync(id);

            if (policy == null)
                return NotFound();

            if (!IsAdmin &&
                !await OwnsCustomerAsync(policy.CustomerId))
            {
                return Forbidden(
                    "You are not authorized to view this policy.");
            }

            return Ok(policy);
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
                    "You are not authorized to view another customer's policies.");
            }

            return Ok(await _policyService.GetPoliciesByCustomerAsync(customerId));
        }

        [HttpPost]
        [Authorize(Roles = RoleConstants.Admin)]
        public async Task<IActionResult> Create(CreatePolicyRequest request)
        {
            var policy = await _policyService.CreatePolicyAsync(request);

            return CreatedAtAction(nameof(Get), new { id = policy.PolicyId }, policy);
        }

        [HttpPut]
        [Authorize(Roles = $"{RoleConstants.Surveyor},{RoleConstants.Approver},{RoleConstants.Admin}")]
        public async Task<IActionResult> Update(UpdatePolicyRequest request)
        {
            if (!await _policyService.UpdatePolicyAsync(request))
                return NotFound();

            return Ok(new { Message = "Policy updated successfully." });
        }

        [HttpDelete("{id:guid}")]
        [Authorize(Roles = RoleConstants.Admin)]
        public async Task<IActionResult> Delete(Guid id)
        {
            if (!await _policyService.DeletePolicyAsync(id))
                return NotFound();

            return Ok(new { Message = "Policy deleted successfully." });
        }
    }
}