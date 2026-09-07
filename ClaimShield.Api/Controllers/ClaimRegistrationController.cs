using ClaimShield.Api.Authentication;
using ClaimShield.Api.Constants;
using ClaimShield.Api.Interfaces.Services;
using ClaimShield.Api.Models.DTOs.ClaimRaise;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace ClaimShield.Api.Controllers
{
    // Checkpoint 5 (Module 3) - staff-assisted claim registration/
    // intimation, distinct from ClaimRaiseController (Customer-only self
    // service wizard). Claims Handler (Surveyor) or Admin registers a
    // claim on a customer's behalf.
    [ApiController]
    [Route("api/ClaimRegistration")]
    [Authorize(Roles = $"{RoleConstants.Surveyor},{RoleConstants.Admin}")]
    public class ClaimRegistrationController : ControllerBase
    {
        private readonly IClaimRaiseService _claimRaiseService;
        private readonly IUserService _userService;
        private readonly ICurrentUserService _currentUserService;

        public ClaimRegistrationController(
            IClaimRaiseService claimRaiseService,
            IUserService userService,
            ICurrentUserService currentUserService)
        {
            _claimRaiseService = claimRaiseService;
            _userService = userService;
            _currentUserService = currentUserService;
        }

        // GET: api/ClaimRegistration/repairers
        // Deliberately narrow (Repairer role only) rather than opening
        // up the full user list to a non-Admin role - the whole
        // UsersController stays Admin-only, this is a separate, scoped
        // lookup that this Surveyor/Admin-only controller can serve
        // itself.
        [HttpGet("repairers")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        public async Task<IActionResult> GetRepairers()
        {
            var users = await _userService.GetAllUsersAsync();

            return Ok(users.Where(u => u.RoleId == RoleConstants.RepairerId));
        }

        // POST: api/ClaimRegistration
        [HttpPost]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        public async Task<IActionResult> Register(
            [FromBody] StaffRegisterClaimRequest request)
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

            var (success, error, result) =
                await _claimRaiseService.StaffRegisterAsync(
                    _currentUserService.UserId.Value,
                    request);

            if (!success)
            {
                return BadRequest(new { Success = false, Message = error });
            }

            return Ok(result);
        }
    }
}
