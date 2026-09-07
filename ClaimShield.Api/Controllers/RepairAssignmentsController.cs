using ClaimShield.Api.Authentication;
using ClaimShield.Api.Constants;
using ClaimShield.Api.Interfaces.Services;
using ClaimShield.Api.Models.DTOs.RepairAssignments;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace ClaimShield.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class RepairAssignmentsController : ControllerBase
    {
        private readonly IRepairAssignmentService _repairAssignmentService;
        private readonly ICurrentUserService _currentUserService;

        public RepairAssignmentsController(
            IRepairAssignmentService repairAssignmentService,
            ICurrentUserService currentUserService)
        {
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

        // Claim 360 needs read access to a claim's repair assignment
        // too, alongside Admin/Repairer who could already see it.
        private bool IsSurveyorOrApprover =>
            string.Equals(
                _currentUserService.RoleName,
                RoleConstants.Surveyor,
                StringComparison.OrdinalIgnoreCase)
            || string.Equals(
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

        // =========================================================
        // GET ALL REPAIR ASSIGNMENTS
        // GET: api/RepairAssignments
        // =========================================================

        [HttpGet]
        [ProducesResponseType(
            typeof(IEnumerable<RepairAssignmentResponseDto>),
            StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> GetAll()
        {
            if (!IsAdmin)
            {
                return Forbidden(
                    "Only an Admin can list all repair assignments.");
            }

            var assignments =
                await _repairAssignmentService.GetAllAsync();

            return Ok(assignments);
        }

        // =========================================================
        // GET BY ID
        // GET: api/RepairAssignments/{id}
        // =========================================================

        [HttpGet("{id:guid}")]
        [ProducesResponseType(
            typeof(RepairAssignmentResponseDto),
            StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> GetById(Guid id)
        {
            var assignment =
                await _repairAssignmentService.GetByIdAsync(id);

            if (assignment == null)
            {
                return NotFound(new
                {
                    Success = false,
                    Message = "Repair assignment not found."
                });
            }

            if (!IsAdmin &&
                assignment.RepairerId != _currentUserService.UserId)
            {
                return Forbidden(
                    "You are not authorized to view this repair assignment.");
            }

            return Ok(assignment);
        }

        // =========================================================
        // GET ASSIGNMENTS BY CLAIM
        // GET: api/RepairAssignments/claim/{claimId}
        // =========================================================

        [HttpGet("claim/{claimId:guid}")]
        [ProducesResponseType(
            typeof(IEnumerable<RepairAssignmentResponseDto>),
            StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> GetByClaim(
            Guid claimId)
        {
            if (!IsAdmin && !IsRepairer && !IsSurveyorOrApprover)
            {
                return Forbidden(
                    "You are not authorized to view repair assignments for this claim.");
            }

            var assignments =
                await _repairAssignmentService.GetByClaimAsync(
                    claimId);

            if (IsRepairer && !IsAdmin)
            {
                assignments =
                    assignments.Where(
                        x =>
                            x.RepairerId ==
                            _currentUserService.UserId);
            }

            return Ok(assignments);
        }

        // =========================================================
        // GET ASSIGNMENTS BY REPAIRER
        // GET: api/RepairAssignments/repairer/{repairerId}
        // =========================================================

        [HttpGet("repairer/{repairerId:guid}")]
        [ProducesResponseType(
            typeof(IEnumerable<RepairAssignmentResponseDto>),
            StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> GetByRepairer(
            Guid repairerId)
        {
            if (!IsAdmin &&
                (!IsRepairer ||
                 repairerId != _currentUserService.UserId))
            {
                return Forbidden(
                    "You are not authorized to view another repairer's assignments.");
            }

            var assignments =
                await _repairAssignmentService.GetByRepairerAsync(
                    repairerId);

            return Ok(assignments);
        }

        // =========================================================
        // CREATE
        // POST: api/RepairAssignments
        // =========================================================

        [HttpPost]
        [ProducesResponseType(
            typeof(RepairAssignmentResponseDto),
            StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> Create(
            CreateRepairAssignmentRequest request)
        {
            if (!IsAdmin)
            {
                return Forbidden(
                    "Only an Admin can create a repair assignment.");
            }

            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            // -----------------------------------------------------
            // AssignedBy must be the authenticated Admin, not
            // whatever the client sent in the request body.
            // -----------------------------------------------------

            if (_currentUserService.UserId.HasValue)
            {
                request.AssignedBy =
                    _currentUserService.UserId.Value;
            }

            var assignment =
                await _repairAssignmentService.CreateAsync(
                    request);

            return CreatedAtAction(
                nameof(GetById),
                new
                {
                    id = assignment.RepairAssignmentId
                },
                assignment);
        }

        // =========================================================
        // UPDATE
        // PUT: api/RepairAssignments
        // =========================================================

        [HttpPut]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> Update(
            UpdateRepairAssignmentRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var existing =
                await _repairAssignmentService.GetByIdAsync(
                    request.RepairAssignmentId);

            if (existing == null)
            {
                return NotFound(new
                {
                    Success = false,
                    Message = "Repair assignment not found."
                });
            }

            if (!IsAdmin &&
                existing.RepairerId != _currentUserService.UserId)
            {
                return Forbidden(
                    "You are not authorized to update this repair assignment.");
            }

            var updated =
                await _repairAssignmentService.UpdateAsync(
                    request);

            if (!updated)
            {
                return NotFound(new
                {
                    Success = false,
                    Message = "Repair assignment not found."
                });
            }

            return Ok(new
            {
                Success = true,
                Message =
                    "Repair assignment updated successfully."
            });
        }

        // =========================================================
        // DELETE
        // DELETE: api/RepairAssignments/{id}
        // =========================================================

        [HttpDelete("{id:guid}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> Delete(Guid id)
        {
            if (!IsAdmin)
            {
                return Forbidden(
                    "Only an Admin can delete a repair assignment.");
            }

            var deleted =
                await _repairAssignmentService.DeleteAsync(id);

            if (!deleted)
            {
                return NotFound(new
                {
                    Success = false,
                    Message = "Repair assignment not found."
                });
            }

            return Ok(new
            {
                Success = true,
                Message =
                    "Repair assignment deleted successfully."
            });
        }
    }
}