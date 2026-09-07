using ClaimShield.Api.AI.Interfaces;
using ClaimShield.Api.Authentication;
using ClaimShield.Api.Constants;
using ClaimShield.Api.Interfaces.Repositories;
using ClaimShield.Api.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace ClaimShield.Api.AI.Controllers
{
    // Phase 16 - Decision & Review surfacing. Staff-only (Surveyor
    // assigned to the claim, Approver, Admin) - this is decision-support
    // for the people deciding, not a customer-facing surface.
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = $"{RoleConstants.Surveyor},{RoleConstants.Approver},{RoleConstants.Admin}")]
    public class DecisionSupportController : ControllerBase
    {
        private readonly IDecisionSupportService _decisionSupportService;
        private readonly ICurrentUserService _currentUserService;
        private readonly IClaimRepository _claimRepository;
        private readonly ISurveyAssignmentRepository _surveyAssignmentRepository;
        private readonly IClaimDecisionService _claimDecisionService;

        public DecisionSupportController(
            IDecisionSupportService decisionSupportService,
            ICurrentUserService currentUserService,
            IClaimRepository claimRepository,
            ISurveyAssignmentRepository surveyAssignmentRepository,
            IClaimDecisionService claimDecisionService)
        {
            _decisionSupportService = decisionSupportService;
            _currentUserService = currentUserService;
            _claimRepository = claimRepository;
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

        private static IActionResult Forbidden(string message)
        {
            return new ObjectResult(new { Success = false, Message = message })
            {
                StatusCode = StatusCodes.Status403Forbidden
            };
        }

        private async Task<bool> CanViewAsync(Guid claimId)
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

        // GET: api/DecisionSupport/claim/{claimId}/summary
        [HttpGet("claim/{claimId:guid}/summary")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> GetSummary(Guid claimId)
        {
            if (!await CanViewAsync(claimId))
            {
                return Forbidden(
                    "You are not authorized to view decision support for this claim.");
            }

            try
            {
                var summary = await _decisionSupportService.GetSummaryAsync(claimId);
                return Ok(summary);
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(new { Success = false, Message = ex.Message });
            }
        }
    }
}
