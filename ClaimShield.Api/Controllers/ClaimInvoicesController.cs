using ClaimShield.Api.Authentication;
using ClaimShield.Api.Constants;
using ClaimShield.Api.Interfaces.Repositories;
using ClaimShield.Api.Interfaces.Services;
using ClaimShield.Api.Models.DTOs.ClaimInvoices;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace ClaimShield.Api.Controllers
{
    // Liability stage - Invoice Particulars.
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ClaimInvoicesController : ControllerBase
    {
        private readonly IClaimInvoiceService _claimInvoiceService;
        private readonly ICurrentUserService _currentUserService;
        private readonly IClaimRepository _claimRepository;
        private readonly ICustomerRepository _customerRepository;
        private readonly ISurveyAssignmentRepository _surveyAssignmentRepository;
        private readonly IClaimDecisionService _claimDecisionService;

        public ClaimInvoicesController(
            IClaimInvoiceService claimInvoiceService,
            ICurrentUserService currentUserService,
            IClaimRepository claimRepository,
            ICustomerRepository customerRepository,
            ISurveyAssignmentRepository surveyAssignmentRepository,
            IClaimDecisionService claimDecisionService)
        {
            _claimInvoiceService = claimInvoiceService;
            _currentUserService = currentUserService;
            _claimRepository = claimRepository;
            _customerRepository = customerRepository;
            _surveyAssignmentRepository = surveyAssignmentRepository;
            _claimDecisionService = claimDecisionService;
        }

        private bool IsAdmin =>
            string.Equals(
                _currentUserService.RoleName,
                RoleConstants.Admin,
                StringComparison.OrdinalIgnoreCase);

        private bool IsSurveyor =>
            string.Equals(
                _currentUserService.RoleName,
                RoleConstants.Surveyor,
                StringComparison.OrdinalIgnoreCase);

        private bool IsApprover =>
            string.Equals(
                _currentUserService.RoleName,
                RoleConstants.Approver,
                StringComparison.OrdinalIgnoreCase);

        private bool IsCustomer =>
            string.Equals(
                _currentUserService.RoleName,
                RoleConstants.Customer,
                StringComparison.OrdinalIgnoreCase);

        private static IActionResult Forbidden(string message)
        {
            return new ObjectResult(new { Success = false, Message = message })
            {
                StatusCode = StatusCodes.Status403Forbidden
            };
        }

        // Mirrors the claim-access matrix duplicated across this
        // codebase (ClaimSettlementsController.CanViewSettlementAsync,
        // ClaimsController.CanAccessClaimAsync, etc.) - same
        // convention, own copy. Invoice Particulars lives on the same
        // Liability page as the settlement card, so read access
        // follows the identical rule set.
        private async Task<bool> CanViewInvoicesAsync(Guid claimId)
        {
            if (IsAdmin)
            {
                return true;
            }

            if (!_currentUserService.UserId.HasValue)
            {
                return false;
            }

            var userId = _currentUserService.UserId.Value;

            if (IsCustomer)
            {
                var claim = await _claimRepository.GetByIdAsync(claimId);
                if (claim == null) return false;

                var customer = await _customerRepository.GetByIdAsync(claim.CustomerId);
                return customer != null && customer.UserId == userId;
            }

            if (IsSurveyor)
            {
                var assignments = await _surveyAssignmentRepository.GetByClaimAsync(claimId);
                return assignments.Any(x => x.SurveyorId == userId);
            }

            if (IsApprover)
            {
                var claim = await _claimRepository.GetByIdAsync(claimId);
                if (claim == null) return false;

                if (claim.StatusId >= ClaimStatusConstants.RepairInProgress)
                {
                    return true;
                }

                var latestDecision = await _claimDecisionService.GetLatestDecisionAsync(claimId);
                return latestDecision?.Escalated == true;
            }

            return false;
        }

        // GET: api/ClaimInvoices/claim/{claimId}
        [HttpGet("claim/{claimId:guid}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> GetByClaim(Guid claimId)
        {
            if (!await CanViewInvoicesAsync(claimId))
            {
                return Forbidden("You are not authorized to view invoices for this claim.");
            }

            var invoices = await _claimInvoiceService.GetByClaimAsync(claimId);

            return Ok(invoices);
        }

        // POST: api/ClaimInvoices/claim/{claimId}
        [HttpPost("claim/{claimId:guid}")]
        [Authorize(Roles = $"{RoleConstants.Surveyor},{RoleConstants.Approver},{RoleConstants.Admin}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> Create(
            Guid claimId,
            [FromBody] CreateInvoiceRequest request)
        {
            if (!await CanViewInvoicesAsync(claimId))
            {
                return Forbidden("You are not authorized to add invoices for this claim.");
            }

            try
            {
                var invoice = await _claimInvoiceService.CreateAsync(claimId, request);
                return Ok(invoice);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { Success = false, Message = ex.Message });
            }
        }

        // PUT: api/ClaimInvoices/{claimInvoiceId}
        [HttpPut("{claimInvoiceId:guid}")]
        [Authorize(Roles = $"{RoleConstants.Surveyor},{RoleConstants.Approver},{RoleConstants.Admin}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> Update(
            Guid claimInvoiceId,
            [FromBody] UpdateInvoiceRequest request)
        {
            try
            {
                var invoice = await _claimInvoiceService.UpdateAsync(claimInvoiceId, request);

                if (invoice == null)
                {
                    return NotFound(new { Success = false, Message = "Invoice not found." });
                }

                return Ok(invoice);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { Success = false, Message = ex.Message });
            }
        }

        // DELETE: api/ClaimInvoices/{claimInvoiceId}
        [HttpDelete("{claimInvoiceId:guid}")]
        [Authorize(Roles = $"{RoleConstants.Surveyor},{RoleConstants.Approver},{RoleConstants.Admin}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> Delete(Guid claimInvoiceId)
        {
            var deleted = await _claimInvoiceService.DeleteAsync(claimInvoiceId);

            if (!deleted)
            {
                return NotFound(new { Success = false, Message = "Invoice not found." });
            }

            return Ok(new { Success = true });
        }
    }
}