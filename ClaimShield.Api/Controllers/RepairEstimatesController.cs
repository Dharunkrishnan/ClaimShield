using ClaimShield.Api.Authentication;
using ClaimShield.Api.Constants;
using ClaimShield.Api.Interfaces.Services;
using ClaimShield.Api.Models.DTOs.RepairEstimates;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace ClaimShield.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class RepairEstimatesController : ControllerBase
    {
        private readonly IRepairEstimateService _repairEstimateService;
        private readonly IRepairAssignmentService _repairAssignmentService;
        private readonly ICurrentUserService _currentUserService;

        public RepairEstimatesController(
            IRepairEstimateService repairEstimateService,
            IRepairAssignmentService repairAssignmentService,
            ICurrentUserService currentUserService)
        {
            _repairEstimateService = repairEstimateService;
            _repairAssignmentService = repairAssignmentService;
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

        private bool IsRepairer =>
            string.Equals(
                _currentUserService.RoleName,
                RoleConstants.Repairer,
                StringComparison.OrdinalIgnoreCase);

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

        // -----------------------------------------------------
        // An estimate has no RepairerId of its own - ownership
        // resolves through the RepairAssignment it belongs to.
        // -----------------------------------------------------

        private async Task<bool> OwnsAssignmentAsync(
            Guid repairAssignmentId)
        {
            var assignment =
                await _repairAssignmentService.GetByIdAsync(
                    repairAssignmentId);

            return
                assignment != null &&
                assignment.RepairerId == _currentUserService.UserId;
        }

        // =========================================================
        // GET ALL REPAIR ESTIMATES
        // GET: api/RepairEstimates
        // =========================================================

        [HttpGet]
        [ProducesResponseType(
            typeof(IEnumerable<RepairEstimateResponseDto>),
            StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> GetAll()
        {
            if (!IsAdmin)
            {
                return Forbidden(
                    "Only an Admin can list all repair estimates.");
            }

            var estimates =
                await _repairEstimateService.GetAllAsync();

            return Ok(estimates);
        }

        // =========================================================
        // GET REPAIR ESTIMATE BY ID
        // GET: api/RepairEstimates/{id}
        // =========================================================

        [HttpGet("{id:guid}")]
        [ProducesResponseType(
            typeof(RepairEstimateResponseDto),
            StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> GetById(Guid id)
        {
            var estimate =
                await _repairEstimateService.GetByIdAsync(id);

            if (estimate == null)
            {
                return NotFound(new
                {
                    Success = false,
                    Message = "Repair estimate not found."
                });
            }

            if (!IsAdmin &&
                !await OwnsAssignmentAsync(estimate.RepairAssignmentId))
            {
                return Forbidden(
                    "You are not authorized to view this repair estimate.");
            }

            return Ok(estimate);
        }

        // =========================================================
        // GET REPAIR ESTIMATES BY CLAIM
        // GET: api/RepairEstimates/claim/{claimId}
        // =========================================================

        [HttpGet("claim/{claimId:guid}")]
        [ProducesResponseType(
            typeof(IEnumerable<RepairEstimateResponseDto>),
            StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> GetByClaim(
            Guid claimId)
        {
            if (!IsAdmin && !IsRepairer && !IsApprover)
            {
                return Forbidden(
                    "You are not authorized to view repair estimates for this claim.");
            }

            var estimates =
                await _repairEstimateService.GetByClaimAsync(
                    claimId);

            // Approver sees every estimate for the claim, unfiltered
            // (needed to review/approve); Repairer only sees their own.
            if (!IsAdmin && !IsApprover)
            {
                estimates = await FilterOwnedAsync(estimates);
            }

            return Ok(estimates);
        }

        // =========================================================
        // GET REPAIR ESTIMATES BY REPAIR ASSIGNMENT
        // GET: api/RepairEstimates/assignment/{repairAssignmentId}
        // =========================================================

        [HttpGet("assignment/{repairAssignmentId:guid}")]
        [ProducesResponseType(
            typeof(IEnumerable<RepairEstimateResponseDto>),
            StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> GetByAssignment(
            Guid repairAssignmentId)
        {
            if (!IsAdmin &&
                !await OwnsAssignmentAsync(repairAssignmentId))
            {
                return Forbidden(
                    "You are not authorized to view these repair estimates.");
            }

            var estimates =
                await _repairEstimateService.GetByAssignmentAsync(
                    repairAssignmentId);

            return Ok(estimates);
        }

        // =========================================================
        // CREATE REPAIR ESTIMATE
        // POST: api/RepairEstimates
        // =========================================================

        [HttpPost]
        [ProducesResponseType(
            typeof(RepairEstimateResponseDto),
            StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> Create(
            CreateRepairEstimateRequest request)
        {
            if (!IsRepairer)
            {
                return Forbidden(
                    "Only a Repairer can submit a repair estimate.");
            }

            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            if (!await OwnsAssignmentAsync(request.RepairAssignmentId))
            {
                return Forbidden(
                    "You can only submit an estimate for your own repair assignment.");
            }

            var estimate =
                await _repairEstimateService.CreateAsync(
                    request);

            return CreatedAtAction(
                nameof(GetById),
                new
                {
                    id = estimate.RepairEstimateId
                },
                estimate);
        }

        // =========================================================
        // UPDATE REPAIR ESTIMATE
        // PUT: api/RepairEstimates
        // =========================================================

        [HttpPut]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> Update(
            UpdateRepairEstimateRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var existing =
                await _repairEstimateService.GetByIdAsync(
                    request.RepairEstimateId);

            if (existing == null)
            {
                return NotFound(new
                {
                    Success = false,
                    Message = "Repair estimate not found."
                });
            }

            if (!IsAdmin &&
                !await OwnsAssignmentAsync(existing.RepairAssignmentId))
            {
                return Forbidden(
                    "You are not authorized to update this repair estimate.");
            }

            var updated =
                await _repairEstimateService.UpdateAsync(
                    request);

            if (!updated)
            {
                return NotFound(new
                {
                    Success = false,
                    Message = "Repair estimate not found."
                });
            }

            return Ok(new
            {
                Success = true,
                Message =
                    "Repair estimate updated successfully."
            });
        }

        // =========================================================
        // DELETE REPAIR ESTIMATE
        // DELETE: api/RepairEstimates/{id}
        // =========================================================

        [HttpDelete("{id:guid}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> Delete(Guid id)
        {
            var existing =
                await _repairEstimateService.GetByIdAsync(id);

            if (existing == null)
            {
                return NotFound(new
                {
                    Success = false,
                    Message = "Repair estimate not found."
                });
            }

            if (!IsAdmin &&
                !await OwnsAssignmentAsync(existing.RepairAssignmentId))
            {
                return Forbidden(
                    "You are not authorized to delete this repair estimate.");
            }

            var deleted =
                await _repairEstimateService.DeleteAsync(id);

            if (!deleted)
            {
                return NotFound(new
                {
                    Success = false,
                    Message = "Repair estimate not found."
                });
            }

            return Ok(new
            {
                Success = true,
                Message = "Repair estimate deleted successfully."
            });
        }

        // =========================================================
        // APPROVE REPAIR ESTIMATE
        // POST: api/RepairEstimates/{id}/approve
        // =========================================================

        [HttpPost("{id:guid}/approve")]
        [Authorize(Roles = $"{RoleConstants.Surveyor},{RoleConstants.Approver},{RoleConstants.Admin}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> Approve(
            Guid id,
            [FromBody] ApproveRepairEstimateRequest request)
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

            bool approved;

            try
            {
                approved =
                    await _repairEstimateService.ApproveAsync(
                        id,
                        _currentUserService.UserId.Value,
                        IsAdmin ? RoleConstants.AdminId : RoleConstants.ApproverId,
                        request);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { Success = false, Message = ex.Message });
            }

            if (!approved)
            {
                return NotFound(new
                {
                    Success = false,
                    Message = "Repair estimate not found."
                });
            }

            return Ok(new
            {
                Success = true,
                Message =
                    "Repair estimate approved. Claim has been approved for the estimated amount."
            });
        }

        // =========================================================
        // REJECT REPAIR ESTIMATE
        // POST: api/RepairEstimates/{id}/reject
        // =========================================================

        [HttpPost("{id:guid}/reject")]
        [Authorize(Roles = $"{RoleConstants.Surveyor},{RoleConstants.Approver},{RoleConstants.Admin}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> Reject(
            Guid id,
            [FromBody] RejectRepairEstimateRequest request)
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

            var rejected =
                await _repairEstimateService.RejectAsync(
                    id,
                    _currentUserService.UserId.Value,
                    request);

            if (!rejected)
            {
                return NotFound(new
                {
                    Success = false,
                    Message = "Repair estimate not found."
                });
            }

            return Ok(new
            {
                Success = true,
                Message =
                    "Repair estimate rejected. The Repairer may submit a revised estimate."
            });
        }

        // =========================================================
        // FILTER HELPER (for list endpoints)
        // =========================================================

        private async Task<IEnumerable<RepairEstimateResponseDto>> FilterOwnedAsync(
            IEnumerable<RepairEstimateResponseDto> estimates)
        {
            var result = new List<RepairEstimateResponseDto>();

            foreach (var estimate in estimates)
            {
                if (await OwnsAssignmentAsync(estimate.RepairAssignmentId))
                {
                    result.Add(estimate);
                }
            }

            return result;
        }
    }
}