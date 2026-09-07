using ClaimShield.Api.Authentication;
using ClaimShield.Api.Constants;
using ClaimShield.Api.Interfaces.Repositories;
using ClaimShield.Api.Interfaces.Services;
using ClaimShield.Api.Models.DTOs.Payments;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace ClaimShield.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class PaymentsController : ControllerBase
    {
        private readonly IPaymentService _paymentService;
        private readonly IClaimService _claimService;
        private readonly ICustomerRepository _customerRepository;
        private readonly ISurveyAssignmentRepository _surveyAssignmentRepository;
        private readonly IRepairAssignmentRepository _repairAssignmentRepository;
        private readonly IClaimDecisionService _claimDecisionService;
        private readonly ICurrentUserService _currentUserService;

        public PaymentsController(
            IPaymentService paymentService,
            IClaimService claimService,
            ICustomerRepository customerRepository,
            ISurveyAssignmentRepository surveyAssignmentRepository,
            IRepairAssignmentRepository repairAssignmentRepository,
            IClaimDecisionService claimDecisionService,
            ICurrentUserService currentUserService)
        {
            _paymentService = paymentService;
            _claimService = claimService;
            _customerRepository = customerRepository;
            _surveyAssignmentRepository = surveyAssignmentRepository;
            _repairAssignmentRepository = repairAssignmentRepository;
            _claimDecisionService = claimDecisionService;
            _currentUserService = currentUserService;
        }

        // =========================================================
        // ACCESS HELPERS
        //
        // Mirrors ClaimsController.CanAccessClaimAsync's matrix -
        // duplicated here rather than shared, matching how every
        // other controller in this codebase owns its own copy of
        // this check. Without it, any authenticated Customer could
        // view another customer's payment history by guessing a
        // claim ID.
        // =========================================================

        private int CurrentRoleId =>
            _currentUserService.RoleName switch
            {
                RoleConstants.Customer => RoleConstants.CustomerId,
                RoleConstants.Repairer => RoleConstants.RepairerId,
                RoleConstants.Surveyor => RoleConstants.SurveyorId,
                RoleConstants.Approver => RoleConstants.ApproverId,
                RoleConstants.Admin => RoleConstants.AdminId,
                _ => 0
            };

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

        private async Task<bool> CanAccessClaimAsync(
            Guid claimId,
            Guid userId,
            int roleId)
        {
            if (roleId == RoleConstants.AdminId)
            {
                return true;
            }

            var claim =
                await _claimService.GetClaimByIdAsync(claimId);

            if (claim == null)
            {
                return false;
            }

            if (roleId == RoleConstants.CustomerId)
            {
                var customer =
                    await _customerRepository.GetByIdAsync(
                        claim.CustomerId);

                return customer != null && customer.UserId == userId;
            }

            if (roleId == RoleConstants.SurveyorId)
            {
                var assignments =
                    await _surveyAssignmentRepository.GetByClaimAsync(
                        claim.ClaimId);

                return assignments.Any(x => x.SurveyorId == userId);
            }

            if (roleId == RoleConstants.RepairerId)
            {
                var assignments =
                    await _repairAssignmentRepository.GetByClaimAsync(
                        claim.ClaimId);

                return assignments.Any(x => x.RepairerId == userId);
            }

            if (roleId == RoleConstants.ApproverId)
            {
                // Mirrors ClaimsController.CanAccessClaimAsync - status
                // check rather than decision history, since a claim
                // approved via repair-estimate approval never creates a
                // ClaimDecision row.
                if (claim.StatusId >= ClaimStatusConstants.RepairInProgress)
                {
                    return true;
                }

                var latestDecision =
                    await _claimDecisionService.GetLatestDecisionAsync(
                        claim.ClaimId);

                return latestDecision?.Escalated == true;
            }

            return false;
        }

        // =========================================================
        // GET ALL
        // GET: api/Payments
        // =========================================================

        [HttpGet]
        [Authorize(Roles = RoleConstants.Admin)]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> GetAll()
        {
            var payments =
                await _paymentService.GetAllAsync();

            return Ok(payments);
        }

        // =========================================================
        // GET BY ID
        // GET: api/Payments/{paymentId}
        // =========================================================

        [HttpGet("{paymentId:guid}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> GetById(
            Guid paymentId)
        {
            var payment =
                await _paymentService.GetByIdAsync(
                    paymentId);

            if (payment == null)
            {
                return NotFound(new
                {
                    Success = false,
                    Message = "Payment not found."
                });
            }

            if (!_currentUserService.UserId.HasValue ||
                !await CanAccessClaimAsync(
                    payment.ClaimId,
                    _currentUserService.UserId.Value,
                    CurrentRoleId))
            {
                return Forbidden(
                    "You are not authorized to view this payment.");
            }

            return Ok(payment);
        }

        // =========================================================
        // GET BY CLAIM
        // GET: api/Payments/claim/{claimId}
        // =========================================================

        [HttpGet("claim/{claimId:guid}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> GetByClaim(
            Guid claimId)
        {
            if (!_currentUserService.UserId.HasValue ||
                !await CanAccessClaimAsync(
                    claimId,
                    _currentUserService.UserId.Value,
                    CurrentRoleId))
            {
                return Forbidden(
                    "You are not authorized to view payments for this claim.");
            }

            var payments =
                await _paymentService.GetByClaimAsync(
                    claimId);

            return Ok(payments);
        }

        // =========================================================
        // CREATE
        // POST: api/Payments
        // =========================================================

        [HttpPost]
        [Authorize(Roles = $"{RoleConstants.Surveyor},{RoleConstants.Approver},{RoleConstants.Admin}")]
        [ProducesResponseType(StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> Create(
            [FromBody] CreatePaymentRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var payment =
                    await _paymentService.CreateAsync(
                        request);

                return CreatedAtAction(
                    nameof(GetById),
                    new
                    {
                        paymentId =
                            payment.PaymentId
                    },
                    payment);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new
                {
                    Success = false,
                    Message = ex.Message
                });
            }
        }

        // =========================================================
        // PROCESS
        // POST: api/Payments/{paymentId}/process
        // =========================================================

        [HttpPost("{paymentId:guid}/process")]
        [Authorize(Roles = $"{RoleConstants.Surveyor},{RoleConstants.Approver},{RoleConstants.Admin}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> Process(
            Guid paymentId)
        {
            var result =
                await _paymentService.ProcessAsync(
                    paymentId);

            if (!result)
            {
                return BadRequest(new
                {
                    Success = false,
                    Message =
                        "Payment could not be processed. " +
                        "It may not exist or may not be in Pending status."
                });
            }

            return Ok(new
            {
                Success = true,
                Message = "Payment moved to Processing.",
                PaymentId = paymentId,
                PaymentStatusId = PaymentStatusConstants.Processing,
                PaymentStatus = "Processing"
            });
        }

        // =========================================================
        // COMPLETE
        // POST: api/Payments/{paymentId}/complete
        // =========================================================

        [HttpPost("{paymentId:guid}/complete")]
        [Authorize(Roles = $"{RoleConstants.Surveyor},{RoleConstants.Approver},{RoleConstants.Admin}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> Complete(
            Guid paymentId)
        {
            var (result, errorMessage) =
                await _paymentService.CompleteAsync(
                    paymentId);

            if (!result)
            {
                return BadRequest(new
                {
                    Success = false,
                    Message = errorMessage ?? "Payment could not be completed."
                });
            }

            return Ok(new
            {
                Success = true,
                Message =
                    "Payment completed successfully. Claim is now settled.",
                PaymentId = paymentId,
                PaymentStatusId = PaymentStatusConstants.Paid,
                PaymentStatus = "Paid",
                ClaimStatusId = ClaimStatusConstants.Settled,
                ClaimStatus = "Settled"
            });
        }

        // =========================================================
        // FAIL
        // POST: api/Payments/{paymentId}/fail
        // =========================================================

        [HttpPost("{paymentId:guid}/fail")]
        [Authorize(Roles = $"{RoleConstants.Surveyor},{RoleConstants.Approver},{RoleConstants.Admin}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> Fail(
            Guid paymentId,
            [FromBody] string? remarks)
        {
            var result =
                await _paymentService.FailAsync(
                    paymentId,
                    remarks);

            if (!result)
            {
                return BadRequest(new
                {
                    Success = false,
                    Message =
                        "Payment could not be marked as failed."
                });
            }

            return Ok(new
            {
                Success = true,
                Message = "Payment marked as failed.",
                PaymentId = paymentId,
                PaymentStatusId = PaymentStatusConstants.Failed,
                PaymentStatus = "Failed"
            });
        }

        // =========================================================
        // CANCEL
        // POST: api/Payments/{paymentId}/cancel
        // =========================================================

        [HttpPost("{paymentId:guid}/cancel")]
        [Authorize(Roles = $"{RoleConstants.Surveyor},{RoleConstants.Approver},{RoleConstants.Admin}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> Cancel(
            Guid paymentId,
            [FromBody] string? remarks)
        {
            var result =
                await _paymentService.CancelAsync(
                    paymentId,
                    remarks);

            if (!result)
            {
                return BadRequest(new
                {
                    Success = false,
                    Message =
                        "Payment could not be cancelled."
                });
            }

            return Ok(new
            {
                Success = true,
                Message = "Payment cancelled successfully.",
                PaymentId = paymentId,
                PaymentStatusId = PaymentStatusConstants.Cancelled,
                PaymentStatus = "Cancelled"
            });
        }

        // =========================================================
        // DELETE
        // DELETE: api/Payments/{paymentId}
        // =========================================================

        [HttpDelete("{paymentId:guid}")]
        [Authorize(Roles = $"{RoleConstants.Surveyor},{RoleConstants.Approver},{RoleConstants.Admin}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> Delete(
            Guid paymentId)
        {
            var result =
                await _paymentService.DeleteAsync(
                    paymentId);

            if (!result)
            {
                return BadRequest(new
                {
                    Success = false,
                    Message =
                        "Payment could not be deleted. " +
                        "It may not exist or may already be Paid."
                });
            }

            return Ok(new
            {
                Success = true,
                Message = "Payment deleted successfully.",
                PaymentId = paymentId
            });
        }
    }
}