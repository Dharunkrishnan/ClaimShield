using ClaimShield.Api.Authentication;
using ClaimShield.Api.Constants;
using ClaimShield.Api.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace ClaimShield.Api.Controllers
{
    // Phase 15 - Claims Handler dashboard (the extended Surveyor role).
    // Approver keeps its existing QueuePage/flow untouched - this is
    // additive, not a replacement for anything Approver-facing.
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = $"{RoleConstants.Surveyor},{RoleConstants.Admin}")]
    public class ClaimsHandlerDashboardController : ControllerBase
    {
        private readonly IClaimsHandlerDashboardService _claimsHandlerDashboardService;
        private readonly ICurrentUserService _currentUserService;

        public ClaimsHandlerDashboardController(
            IClaimsHandlerDashboardService claimsHandlerDashboardService,
            ICurrentUserService currentUserService)
        {
            _claimsHandlerDashboardService = claimsHandlerDashboardService;
            _currentUserService = currentUserService;
        }

        private bool IsAdmin =>
            string.Equals(
                _currentUserService.RoleName,
                RoleConstants.Admin,
                StringComparison.OrdinalIgnoreCase);

        // GET: api/ClaimsHandlerDashboard/summary
        [HttpGet("summary")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> GetSummary()
        {
            if (!_currentUserService.UserId.HasValue)
            {
                return BadRequest(new
                {
                    Success = false,
                    Message = "Unable to determine the logged-in user."
                });
            }

            var summary =
                await _claimsHandlerDashboardService.GetSummaryAsync(
                    _currentUserService.UserId.Value,
                    IsAdmin ? RoleConstants.AdminId : RoleConstants.SurveyorId);

            return Ok(summary);
        }

        // GET: api/ClaimsHandlerDashboard/my-claims
        // Checkpoint 7 - all claims (any status), each with a real
        // category bucket, for the "Claims" tabs on the sidebar.
        [HttpGet("my-claims")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> GetMyClaims()
        {
            if (!_currentUserService.UserId.HasValue)
            {
                return BadRequest(new
                {
                    Success = false,
                    Message = "Unable to determine the logged-in user."
                });
            }

            var claims =
                await _claimsHandlerDashboardService.GetMyClaimsAsync(
                    _currentUserService.UserId.Value,
                    IsAdmin ? RoleConstants.AdminId : RoleConstants.SurveyorId);

            return Ok(claims);
        }

        // GET: api/ClaimsHandlerDashboard/tat-performance?year=2026&month=8
        // Defaults to the current calendar month if year/month aren't
        // provided (the "This Month" default shown in the widget).
        [HttpGet("tat-performance")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> GetTatPerformance(
            [FromQuery] int? year,
            [FromQuery] int? month)
        {
            if (!_currentUserService.UserId.HasValue)
            {
                return BadRequest(new
                {
                    Success = false,
                    Message = "Unable to determine the logged-in user."
                });
            }

            var now = DateTime.UtcNow;
            var effectiveYear = year ?? now.Year;
            var effectiveMonth = month ?? now.Month;

            if (effectiveMonth < 1 || effectiveMonth > 12)
            {
                return BadRequest(new
                {
                    Success = false,
                    Message = "Month must be between 1 and 12."
                });
            }

            var periodStart = new DateTime(effectiveYear, effectiveMonth, 1, 0, 0, 0, DateTimeKind.Utc);
            var periodEnd = periodStart.AddMonths(1);

            var result =
                await _claimsHandlerDashboardService.GetTatPerformanceAsync(
                    _currentUserService.UserId.Value,
                    IsAdmin ? RoleConstants.AdminId : RoleConstants.SurveyorId,
                    periodStart,
                    periodEnd);

            return Ok(result);
        }
    }
}