using ClaimShield.Api.Authentication;
using ClaimShield.Api.Constants;
using ClaimShield.Api.Interfaces.Repositories;
using ClaimShield.Api.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace ClaimShield.Api.Controllers
{
    // Phase 16 - Claims Processing & Settlement.
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ClaimSettlementsController : ControllerBase
    {
        private readonly IClaimSettlementService _claimSettlementService;
        private readonly ICurrentUserService _currentUserService;
        private readonly IClaimRepository _claimRepository;
        private readonly ICustomerRepository _customerRepository;
        private readonly ISurveyAssignmentRepository _surveyAssignmentRepository;
        private readonly IClaimDecisionService _claimDecisionService;

        public ClaimSettlementsController(
            IClaimSettlementService claimSettlementService,
            ICurrentUserService currentUserService,
            IClaimRepository claimRepository,
            ICustomerRepository customerRepository,
            ISurveyAssignmentRepository surveyAssignmentRepository,
            IClaimDecisionService claimDecisionService)
        {
            _claimSettlementService = claimSettlementService;
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

        // Mirrors the claim-access matrix duplicated across this codebase
        // (ClaimsController.CanAccessClaimAsync, SurveyReportsController,
        // AuditLogsController) - same convention, own copy.
        private async Task<bool> CanViewSettlementAsync(Guid claimId)
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

        // GET: api/ClaimSettlements/claim/{claimId}
        [HttpGet("claim/{claimId:guid}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> GetByClaim(Guid claimId)
        {
            if (!await CanViewSettlementAsync(claimId))
            {
                return Forbidden("You are not authorized to view the settlement for this claim.");
            }

            var settlement = await _claimSettlementService.GetByClaimAsync(claimId);

            return Ok(settlement);
        }

        // POST: api/ClaimSettlements/claim/{claimId}/compute
        [HttpPost("claim/{claimId:guid}/compute")]
        [Authorize(Roles = $"{RoleConstants.Surveyor},{RoleConstants.Approver},{RoleConstants.Admin}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> Compute(Guid claimId)
        {
            if (!await CanViewSettlementAsync(claimId))
            {
                return Forbidden("You are not authorized to compute the settlement for this claim.");
            }

            try
            {
                var settlement = await _claimSettlementService.ComputeAsync(claimId);
                return Ok(settlement);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { Success = false, Message = ex.Message });
            }
        }
    }
}
