using ClaimShield.Api.Authentication;
using ClaimShield.Api.Constants;
using ClaimShield.Api.Interfaces.Services;
using ClaimShield.Api.Models.DTOs.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace ClaimShield.Api.Controllers
{
    // Phase 14 reconciliation: this controller no longer writes claim
    // decisions on its own via IClaimApprovalService (which had no
    // ClaimDecisions history and no AuthorityLimits enforcement) - both
    // actions now go through IClaimDecisionService.
    // RecordDirectApproverDecisionAsync, the same canonical path the
    // repair-estimate-approval side effect uses, so there is one decision
    // history and one enforcement point regardless of entry point.
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = $"{RoleConstants.Approver},{RoleConstants.Admin}")]
    public class ClaimApprovalController : ControllerBase
    {
        private readonly IClaimDecisionService _claimDecisionService;
        private readonly ICurrentUserService _currentUserService;

        public ClaimApprovalController(
            IClaimDecisionService claimDecisionService,
            ICurrentUserService currentUserService)
        {
            _claimDecisionService = claimDecisionService;
            _currentUserService = currentUserService;
        }

        private bool IsAdmin =>
            string.Equals(
                _currentUserService.RoleName,
                RoleConstants.Admin,
                StringComparison.OrdinalIgnoreCase);

        // =========================================================
        // APPROVE CLAIM
        // POST: api/ClaimApproval/{claimId}/approve
        // =========================================================

        [HttpPost("{claimId:guid}/approve")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        public async Task<IActionResult> ApproveClaim(
            Guid claimId,
            [FromBody] ApproveClaimRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            if (!_currentUserService.UserId.HasValue)
            {
                return BadRequest(new
                {
                    Success = false,
                    Message = "Unable to determine the logged-in user."
                });
            }

            var result =
                await _claimDecisionService.RecordDirectApproverDecisionAsync(
                    claimId,
                    _currentUserService.UserId.Value,
                    IsAdmin ? RoleConstants.AdminId : RoleConstants.ApproverId,
                    ClaimDecisionConstants.Approve,
                    request.Remarks ?? "Approved.",
                    request.ApprovedAmount);

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
                Message = "Claim approved successfully.",
                ClaimId = claimId,
                ApprovedAmount = request.ApprovedAmount,
                StatusId = result.UpdatedClaimStatusId,
                Status = "Approved"
            });
        }

        // =========================================================
        // REJECT CLAIM
        // POST: api/ClaimApproval/{claimId}/reject
        // =========================================================

        [HttpPost("{claimId:guid}/reject")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        public async Task<IActionResult> RejectClaim(
            Guid claimId,
            [FromBody] RejectClaimRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            if (!_currentUserService.UserId.HasValue)
            {
                return BadRequest(new
                {
                    Success = false,
                    Message = "Unable to determine the logged-in user."
                });
            }

            var result =
                await _claimDecisionService.RecordDirectApproverDecisionAsync(
                    claimId,
                    _currentUserService.UserId.Value,
                    IsAdmin ? RoleConstants.AdminId : RoleConstants.ApproverId,
                    ClaimDecisionConstants.Deny,
                    request.Remarks,
                    null);

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
                Message = "Claim rejected successfully.",
                ClaimId = claimId,
                StatusId = result.UpdatedClaimStatusId,
                Status = "Rejected"
            });
        }
    }
}