using ClaimShield.Api.Authentication;
using ClaimShield.Api.Constants;
using ClaimShield.Api.Interfaces.Services;
using ClaimShield.Api.Models.DTOs.ClaimDecisions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace ClaimShield.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ClaimDecisionsController : ControllerBase
    {
        private readonly IClaimDecisionService _claimDecisionService;
        private readonly ICurrentUserService _currentUserService;

        public ClaimDecisionsController(
            IClaimDecisionService claimDecisionService,
            ICurrentUserService currentUserService)
        {
            _claimDecisionService = claimDecisionService;
            _currentUserService = currentUserService;
        }

        // =========================================================
        // ACCESS HELPERS
        // =========================================================

        private bool IsAdmin =>
            string.Equals(
                _currentUserService.RoleName,
                RoleConstants.Admin,
                StringComparison.OrdinalIgnoreCase);

        private bool IsApprover =>
            string.Equals(
                _currentUserService.RoleName,
                RoleConstants.Approver,
                StringComparison.OrdinalIgnoreCase);

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
        // MY QUEUE
        // GET: api/ClaimDecisions/my-queue
        // =========================================================

        [HttpGet("my-queue")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> GetMyQueue()
        {
            if (!_currentUserService.UserId.HasValue)
            {
                return Forbidden(
                    "Unable to determine the logged-in user.");
            }

            var roleId =
                IsAdmin
                    ? RoleConstants.AdminId
                    : IsSurveyor
                        ? RoleConstants.SurveyorId
                        : IsApprover
                            ? RoleConstants.ApproverId
                            : 0;

            if (roleId == 0)
            {
                return Forbidden(
                    "Only a Surveyor, Approver, or Admin has a decision queue.");
            }

            var queue =
                await _claimDecisionService.GetMyQueueAsync(
                    _currentUserService.UserId.Value,
                    roleId);

            return Ok(queue);
        }

        // =========================================================
        // LATEST DECISION FOR A CLAIM
        // GET: api/ClaimDecisions/claim/{claimId}
        // =========================================================

        [HttpGet("claim/{claimId:guid}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> GetLatest(
            Guid claimId)
        {
            if (!IsAdmin && !IsApprover && !IsSurveyor)
            {
                return Forbidden(
                    "You are not authorized to view claim decisions.");
            }

            var decision =
                await _claimDecisionService.GetLatestDecisionAsync(
                    claimId);

            if (decision == null)
            {
                return NotFound(new
                {
                    Success = false,
                    Message = "No decision has been recorded for this claim."
                });
            }

            return Ok(decision);
        }

        // =========================================================
        // DECISION HISTORY FOR A CLAIM
        // GET: api/ClaimDecisions/claim/{claimId}/history
        // =========================================================

        [HttpGet("claim/{claimId:guid}/history")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> GetHistory(
            Guid claimId)
        {
            if (!IsAdmin && !IsApprover)
            {
                return Forbidden(
                    "Only an Approver or Admin can view the full decision history.");
            }

            var history =
                await _claimDecisionService.GetHistoryAsync(
                    claimId);

            return Ok(history);
        }

        // =========================================================
        // SURVEYOR DECISION (maker)
        // POST: api/ClaimDecisions/{claimId}/surveyor-decision
        // =========================================================

        [HttpPost("{claimId:guid}/surveyor-decision")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> SurveyorDecision(
            Guid claimId,
            [FromBody] SurveyorDecisionRequest request)
        {
            if (!IsSurveyor)
            {
                return Forbidden(
                    "Only a Surveyor can record this decision.");
            }

            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            if (!_currentUserService.UserId.HasValue)
            {
                return Forbidden(
                    "Unable to determine the logged-in Surveyor.");
            }

            var result =
                await _claimDecisionService.RecordSurveyorDecisionAsync(
                    claimId,
                    _currentUserService.UserId.Value,
                    request);

            if (!result.Success)
            {
                return BadRequest(new
                {
                    Success = false,
                    Message = result.ErrorMessage
                });
            }

            return Ok(new
            {
                Success = true,

                Message =
                    result.Escalated
                        ? "Decision recorded and escalated to an Approver for review."
                        : "Decision recorded and finalized within your authority limits.",

                Escalated = result.Escalated,

                ClaimStatusId = result.UpdatedClaimStatusId,

                Decision = result.Decision
            });
        }

        // =========================================================
        // APPROVER DECISION (checker)
        // POST: api/ClaimDecisions/{claimId}/approver-decision
        // =========================================================

        [HttpPost("{claimId:guid}/approver-decision")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> ApproverDecision(
            Guid claimId,
            [FromBody] ApproverDecisionRequest request)
        {
            if (!IsApprover && !IsAdmin)
            {
                return Forbidden(
                    "Only an Approver or Admin can record this decision.");
            }

            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            if (!_currentUserService.UserId.HasValue)
            {
                return Forbidden(
                    "Unable to determine the logged-in Approver.");
            }

            var result =
                await _claimDecisionService.RecordApproverDecisionAsync(
                    claimId,
                    _currentUserService.UserId.Value,
                    IsAdmin ? RoleConstants.AdminId : RoleConstants.ApproverId,
                    request);

            if (!result.Success)
            {
                return BadRequest(new
                {
                    Success = false,
                    Message = result.ErrorMessage
                });
            }

            return Ok(new
            {
                Success = true,

                Message = "Approver decision recorded and finalized.",

                ClaimStatusId = result.UpdatedClaimStatusId,

                Decision = result.Decision
            });
        }

        // =========================================================
        // Checkpoint 5 (Module 5) - On Hold / Resume, Return for
        // Rework, Request Additional Information. Surveyor (Claims
        // Handler) or Admin, except Return for Rework which an
        // Approver can also use while reviewing an escalation.
        // =========================================================

        private int CurrentRoleId =>
            IsAdmin
                ? RoleConstants.AdminId
                : IsSurveyor
                    ? RoleConstants.SurveyorId
                    : IsApprover
                        ? RoleConstants.ApproverId
                        : 0;

        private static IActionResult Failed(string? message) =>
            new BadRequestObjectResult(new { Success = false, Message = message });

        // POST: api/ClaimDecisions/{claimId}/hold
        [HttpPost("{claimId:guid}/hold")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> Hold(
            Guid claimId,
            [FromBody] Models.DTOs.ClaimDecisions.HoldClaimRequest request)
        {
            if (!IsSurveyor && !IsAdmin)
            {
                return Forbidden("Only a Claims Handler or Admin can put a claim on hold.");
            }

            if (!ModelState.IsValid) return BadRequest(ModelState);
            if (!_currentUserService.UserId.HasValue)
            {
                return Forbidden("Unable to determine the logged-in user.");
            }

            var result =
                await _claimDecisionService.PutOnHoldAsync(
                    claimId, _currentUserService.UserId.Value, CurrentRoleId, request);

            if (!result.Success) return Failed(result.ErrorMessage);

            return Ok(new
            {
                Success = true,
                Message = "Claim placed on hold.",
                ClaimStatusId = result.UpdatedClaimStatusId
            });
        }

        // POST: api/ClaimDecisions/{claimId}/resume
        [HttpPost("{claimId:guid}/resume")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> Resume(
            Guid claimId)
        {
            if (!IsSurveyor && !IsAdmin)
            {
                return Forbidden("Only a Claims Handler or Admin can resume a claim.");
            }

            if (!_currentUserService.UserId.HasValue)
            {
                return Forbidden("Unable to determine the logged-in user.");
            }

            var result =
                await _claimDecisionService.ResumeAsync(
                    claimId, _currentUserService.UserId.Value, CurrentRoleId);

            if (!result.Success) return Failed(result.ErrorMessage);

            return Ok(new
            {
                Success = true,
                Message = "Claim resumed.",
                ClaimStatusId = result.UpdatedClaimStatusId
            });
        }

        // POST: api/ClaimDecisions/{claimId}/return-for-rework
        [HttpPost("{claimId:guid}/return-for-rework")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> ReturnForRework(
            Guid claimId,
            [FromBody] Models.DTOs.ClaimDecisions.ReturnForReworkRequest request)
        {
            if (!IsSurveyor && !IsApprover && !IsAdmin)
            {
                return Forbidden("Only a Claims Handler, Approver, or Admin can return a claim for rework.");
            }

            if (!ModelState.IsValid) return BadRequest(ModelState);
            if (!_currentUserService.UserId.HasValue)
            {
                return Forbidden("Unable to determine the logged-in user.");
            }

            var result =
                await _claimDecisionService.ReturnForReworkAsync(
                    claimId, _currentUserService.UserId.Value, CurrentRoleId, request);

            if (!result.Success) return Failed(result.ErrorMessage);

            return Ok(new
            {
                Success = true,
                Message = "Claim returned for rework.",
                ClaimStatusId = result.UpdatedClaimStatusId
            });
        }

        // POST: api/ClaimDecisions/{claimId}/request-info
        [HttpPost("{claimId:guid}/request-info")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> RequestInfo(
            Guid claimId,
            [FromBody] Models.DTOs.ClaimDecisions.RequestAdditionalInfoRequest request)
        {
            if (!IsSurveyor && !IsAdmin)
            {
                return Forbidden("Only a Claims Handler or Admin can request additional information.");
            }

            if (!ModelState.IsValid) return BadRequest(ModelState);
            if (!_currentUserService.UserId.HasValue)
            {
                return Forbidden("Unable to determine the logged-in user.");
            }

            var result =
                await _claimDecisionService.RequestAdditionalInfoAsync(
                    claimId, _currentUserService.UserId.Value, CurrentRoleId, request);

            if (!result.Success) return Failed(result.ErrorMessage);

            return Ok(new
            {
                Success = true,
                Message = "Additional information requested."
            });
        }

        // POST: api/ClaimDecisions/{claimId}/clear-info-request
        [HttpPost("{claimId:guid}/clear-info-request")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> ClearInfoRequest(
            Guid claimId)
        {
            if (!IsSurveyor && !IsAdmin)
            {
                return Forbidden("Only a Claims Handler or Admin can clear an information request.");
            }

            if (!_currentUserService.UserId.HasValue)
            {
                return Forbidden("Unable to determine the logged-in user.");
            }

            var result =
                await _claimDecisionService.ClearInfoRequestAsync(
                    claimId, _currentUserService.UserId.Value, CurrentRoleId);

            if (!result.Success) return Failed(result.ErrorMessage);

            return Ok(new
            {
                Success = true,
                Message = "Information request cleared."
            });
        }
    }
}
