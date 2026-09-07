using ClaimShield.Api.Authentication;
using ClaimShield.Api.Constants;
using ClaimShield.Api.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace ClaimShield.Api.Controllers
{
    // Checkpoint 3 - Claim Closure & Reporting (Module 10). Same
    // Surveyor/Admin split as the Claims Handler dashboard - Approver
    // keeps its existing queue/flow untouched.
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = $"{RoleConstants.Surveyor},{RoleConstants.Admin}")]
    public class ClaimReportsController : ControllerBase
    {
        private readonly IClaimReportService _claimReportService;
        private readonly ICurrentUserService _currentUserService;

        public ClaimReportsController(
            IClaimReportService claimReportService,
            ICurrentUserService currentUserService)
        {
            _claimReportService = claimReportService;
            _currentUserService = currentUserService;
        }

        private bool IsAdmin =>
            string.Equals(
                _currentUserService.RoleName,
                RoleConstants.Admin,
                StringComparison.OrdinalIgnoreCase);

        // GET: api/ClaimReports/claims/csv?status=all
        [HttpGet("claims/csv")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> GetClaimsCsv(
            [FromQuery] string status = "all")
        {
            if (!_currentUserService.UserId.HasValue)
            {
                return BadRequest(new
                {
                    Success = false,
                    Message = "Unable to determine the logged-in user."
                });
            }

            var csvBytes =
                await _claimReportService.GenerateClaimsCsvAsync(
                    _currentUserService.UserId.Value,
                    IsAdmin ? RoleConstants.AdminId : RoleConstants.SurveyorId,
                    status);

            return File(
                csvBytes,
                "text/csv",
                $"claims-report-{DateTime.UtcNow:yyyyMMdd-HHmmss}.csv");
        }
    }
}
