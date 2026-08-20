using System.Text.Json;

using ClaimShield.Api.Constants;
using ClaimShield.Api.Data.Context;
using ClaimShield.Api.Interfaces.Repositories;
using ClaimShield.Api.Interfaces.Services;
using ClaimShield.Api.Models.DTOs.Claims;
using ClaimShield.Api.Models.DTOs.ClaimRaise;
using ClaimShield.Api.Models.DTOs.InstantClaim;
using ClaimShield.Api.Models.Entities;

using Microsoft.EntityFrameworkCore;

namespace ClaimShield.Api.Services
{
    // =================================================================
    // Backs the Raise Claim wizard (Phase 12). Step 1 reuses
    // IClaimService.CreateClaimAsync unmodified (Stage 1 scoring fires
    // exactly as it already does). Every eligibility condition is
    // re-checked server-side at estimate-generation and accept time -
    // the client's view of "eligible" is never trusted.
    // =================================================================

    public class ClaimRaiseService : IClaimRaiseService
    {
        private static readonly TimeSpan OtpFreshWindow = TimeSpan.FromMinutes(10);

        private readonly ClaimShieldDbContext _context;
        private readonly IClaimService _claimService;
        private readonly IClaimScoringService _claimScoringService;
        private readonly IClaimApprovalService _claimApprovalService;
        private readonly IClaimDocumentService _claimDocumentService;
        private readonly ISupabaseStorageService _storageService;
        private readonly IOcrService _ocrService;
        private readonly IEstimateEngineService _estimateEngineService;
        private readonly IOtpService _otpService;
        private readonly ICustomerRepository _customerRepository;
        private readonly IPolicyRepository _policyRepository;
        private readonly IVehicleRepository _vehicleRepository;
        private readonly IAuditLogService _auditLogService;

        public ClaimRaiseService(
            ClaimShieldDbContext context,
            IClaimService claimService,
            IClaimScoringService claimScoringService,
            IClaimApprovalService claimApprovalService,
            IClaimDocumentService claimDocumentService,
            ISupabaseStorageService storageService,
            IOcrService ocrService,
            IEstimateEngineService estimateEngineService,
            IOtpService otpService,
            ICustomerRepository customerRepository,
            IPolicyRepository policyRepository,
            IVehicleRepository vehicleRepository,
            IAuditLogService auditLogService)
        {
            _context = context;
            _claimService = claimService;
            _claimScoringService = claimScoringService;
            _claimApprovalService = claimApprovalService;
            _claimDocumentService = claimDocumentService;
            _storageService = storageService;
            _ocrService = ocrService;
            _estimateEngineService = estimateEngineService;
            _otpService = otpService;
            _customerRepository = customerRepository;
            _policyRepository = policyRepository;
            _vehicleRepository = vehicleRepository;
            _auditLogService = auditLogService;
        }

        // =========================================================
        // STEP 1
        // =========================================================

        public async Task<(bool, string?, RaiseStep1ResponseDto?)> Step1Async(
            Guid userId,
            RaiseStep1Request request)
        {
            var customer =
                await _customerRepository.GetByUserIdAsync(userId);

            if (customer == null)
            {
                return (false, "No customer record exists for this account.", null);
            }

            var policy =
                await _policyRepository.GetByIdAsync(request.PolicyId);

            if (policy == null || policy.CustomerId != customer.CustomerId)
            {
                return (false, "You can only raise a claim against your own policy.", null);
            }

            var vehicle =
                await _vehicleRepository.GetByIdAsync(request.VehicleId);

            if (vehicle == null || vehicle.CustomerId != customer.CustomerId)
            {
                return (false, "You can only raise a claim for your own vehicle.", null);
            }

            var today = DateTime.UtcNow.Date;

            if (request.DateOfLoss.Date > today)
            {
                return (false, "Date of Loss cannot be in the future.", null);
            }

            if (request.DateOfLoss.Date < policy.StartDate.Date)
            {
                return (false, "Date of Loss cannot be before the policy start date.", null);
            }

            // Never trust the client for eligibility-relevant fields:
            // the Instant Claim toggle only means anything for Minor
            // Accident. A forged true for any other Loss Type is
            // silently overridden to false, not rejected outright,
            // since the claim itself is still valid - only the
            // shortcut is denied.
            var effectiveToggle =
                request.LossType == LossTypeConstants.MinorAccident &&
                request.InstantClaimToggle;

            if (effectiveToggle)
            {
                var parts = request.InstantClaimParts;

                var anySelected =
                    parts != null &&
                    (parts.WindshieldFront || parts.WindshieldRear ||
                        parts.Glass || parts.Tyre);

                if (!anySelected)
                {
                    return (
                        false,
                        "Select at least one part for the Instant Claim option.",
                        null);
                }
            }

            var createRequest = new CreateClaimRequest
            {
                PolicyId = request.PolicyId,
                CustomerId = customer.CustomerId,
                VehicleId = request.VehicleId,
                IncidentDate = request.DateOfLoss,
                ReportedDate = DateTime.UtcNow,
                IncidentLocation = request.LocationOfLoss,
                IncidentDescription = request.Description,
                EstimatedLossAmount = request.CustomerEstimatedAmount,
                IsFraudSuspected = false,
                StatusId = ClaimStatusConstants.Submitted
            };

            // Reused, unmodified - this is what already fires Stage 1
            // FNOL scoring (ClaimService.CreateClaimAsync).
            var claim = await _claimService.CreateClaimAsync(createRequest);

            var partsJson =
                JsonSerializer.Serialize(
                    new
                    {
                        windshieldFront = effectiveToggle && (request.InstantClaimParts?.WindshieldFront ?? false),
                        windshieldRear = effectiveToggle && (request.InstantClaimParts?.WindshieldRear ?? false),
                        glass = effectiveToggle && (request.InstantClaimParts?.Glass ?? false),
                        tyre = effectiveToggle && (request.InstantClaimParts?.Tyre ?? false)
                    });

            var intake = new ClaimIntake
            {
                ClaimId = claim.ClaimId,
                VehicleLocationAtLoss = request.VehicleLocationAtLoss,
                LossType = request.LossType,
                InstantClaimToggle = effectiveToggle,
                InstantClaimParts = partsJson,
                CustomerEstimatedAmount = request.CustomerEstimatedAmount,
                CreatedDate = DateTime.UtcNow
            };

            _context.ClaimIntakes.Add(intake);

            string? assignedHandlerName = null;

            if (!effectiveToggle)
            {
                assignedHandlerName = await AutoAssignSurveyorAsync(claim.ClaimId);
            }

            await _context.SaveChangesAsync();

            return (
                true,
                null,
                new RaiseStep1ResponseDto
                {
                    ClaimId = claim.ClaimId,
                    ClaimNumber = claim.ClaimNumber,
                    AssignedHandlerName = assignedHandlerName
                });
        }

        // =========================================================
        // AUTO-ASSIGN SURVEYOR (non-Instant-Claim path only)
        // =========================================================
        //
        // Picks whichever active Surveyor currently has the fewest
        // open assignments, so claims aren't all dumped on the same
        // person. Returns null (and leaves the claim unassigned) if
        // no Surveyor accounts exist yet - an Admin can still assign
        // one manually from the All Claims screen.
        // =========================================================

        private async Task<string?> AutoAssignSurveyorAsync(Guid claimId)
        {
            var openAssignmentStatuses = new[]
            {
                AssignmentStatusConstants.Assigned,
                AssignmentStatusConstants.Accepted,
                AssignmentStatusConstants.InProgress
            };

            var candidate = await _context.Users
                .Where(u => u.RoleId == RoleConstants.SurveyorId && u.IsActive)
                .Select(u => new
                {
                    u.UserId,
                    u.FirstName,
                    u.LastName,
                    OpenCount = _context.SurveyAssignments
                        .Count(a =>
                            a.SurveyorId == u.UserId &&
                            openAssignmentStatuses.Contains(a.AssignmentStatusId))
                })
                .OrderBy(u => u.OpenCount)
                .FirstOrDefaultAsync();

            if (candidate == null)
            {
                return null;
            }

            _context.SurveyAssignments.Add(new SurveyAssignment
            {
                SurveyAssignmentId = Guid.NewGuid(),
                ClaimId = claimId,
                SurveyorId = candidate.UserId,

                // System auto-assignment has no human "assigned by"
                // actor - recorded as self-assigned by the Surveyor
                // rather than an arbitrary or fabricated admin id.
                AssignedBy = candidate.UserId,

                AssignedDate = DateTime.UtcNow,
                AssignmentStatusId = AssignmentStatusConstants.Assigned,
                InspectionMode = InspectionModeConstants.Physical,
                Remarks = "Auto-assigned at claim intake (Instant Claim not selected).",
                CreatedDate = DateTime.UtcNow
            });

            var claimEntity = await _context.Claims
                .FirstOrDefaultAsync(c => c.ClaimId == claimId);

            if (claimEntity != null &&
                (claimEntity.StatusId == null ||
                 claimEntity.StatusId.Value < ClaimStatusConstants.SurveyAssigned))
            {
                claimEntity.StatusId = ClaimStatusConstants.SurveyAssigned;
                claimEntity.UpdatedDate = DateTime.UtcNow;
            }

            return string.IsNullOrWhiteSpace(candidate.LastName)
                ? candidate.FirstName
                : $"{candidate.FirstName} {candidate.LastName}";
        }

        // =========================================================
        // STEP 2
        // =========================================================

        public async Task<(bool, string?, RaiseStep2ResponseDto?)> Step2Async(
            Guid claimId,
            Guid userId,
            RaiseStep2Request request)
        {
            var claim = await GetOwnedClaimAsync(claimId, userId);

            if (claim == null)
            {
                return (false, "Claim not found.", null);
            }

            var intake =
                await _context.ClaimIntakes
                    .FirstOrDefaultAsync(x => x.ClaimId == claimId);

            if (intake == null)
            {
                return (false, "Claim intake details not found.", null);
            }

            intake.VehicleParkedSafely = request.VehicleParkedSafely;
            intake.DeathOccurred = request.DeathOccurred;

            if (request.DeathOccurred)
            {
                // Hard disqualifier - the claim proceeds, but Instant
                // Claim is off the table regardless of anything else.
                // No OCR/estimate is attempted at all in this case.
                await _context.SaveChangesAsync();

                await _auditLogService.LogAsync(
                    userId,
                    "ClaimIntake.DeathFlagRaised",
                    "Claim",
                    claimId,
                    null,
                    new { DeathOccurred = true });

                return (
                    true,
                    null,
                    new RaiseStep2ResponseDto
                    {
                        MatchStatus = RcMatchStatusConstants.Pending,
                        RoutedToSurveyor = true,
                        Message =
                            "This claim will be routed to a Surveyor for assessment. " +
                            "Our team will contact you shortly."
                    });
            }

            var documents = await _claimDocumentService.GetByClaimAsync(claimId);

            var rcDoc =
                documents.FirstOrDefault(
                    x => x.DocumentTypeId == DocumentTypeConstants.RegistrationCertificate);

            var plateDoc =
                documents.FirstOrDefault(
                    x => x.DocumentTypeId == DocumentTypeConstants.NumberPlate);

            if (rcDoc == null || plateDoc == null)
            {
                return (
                    false,
                    "Please upload your RC document and number plate photo before verifying.",
                    null);
            }

            var policy =
                await _policyRepository.GetByIdAsync(claim.PolicyId);

            var vehicle =
                await _vehicleRepository.GetByIdAsync(claim.VehicleId);

            var rcBytes = await _storageService.DownloadAsync(rcDoc.FilePath);
            var plateBytes = await _storageService.DownloadAsync(plateDoc.FilePath);

            var rcResult = await _ocrService.ExtractAsync(rcBytes);
            var plateResult = await _ocrService.ExtractAsync(plateBytes);

            var policyRegNumber = vehicle?.RegistrationNumber?.Replace(" ", "").ToUpperInvariant();
            var rcRegNumber = rcResult.RegistrationNumber?.ToUpperInvariant();
            var plateRegNumber = plateResult.RegistrationNumber?.ToUpperInvariant();

            var matched =
                !string.IsNullOrWhiteSpace(policyRegNumber) &&
                !string.IsNullOrWhiteSpace(rcRegNumber) &&
                !string.IsNullOrWhiteSpace(plateRegNumber) &&
                policyRegNumber == rcRegNumber &&
                policyRegNumber == plateRegNumber;

            var matchStatus =
                matched ? RcMatchStatusConstants.Matched : RcMatchStatusConstants.Mismatched;

            var existingOcr =
                await _context.ClaimRcOcrResults
                    .FirstOrDefaultAsync(x => x.ClaimId == claimId);

            if (existingOcr == null)
            {
                existingOcr = new ClaimRcOcrResult { ClaimId = claimId };
                _context.ClaimRcOcrResults.Add(existingOcr);
            }

            existingOcr.ExtractedRegNumber = rcResult.RegistrationNumber;
            existingOcr.ExtractedOwnerName = rcResult.OwnerName;
            existingOcr.ExtractedChassisNumber = rcResult.ChassisNumber;
            existingOcr.PlatePhotoExtractedRegNumber = plateResult.RegistrationNumber;
            existingOcr.PolicyRegNumber = vehicle?.RegistrationNumber;
            existingOcr.MatchStatus = matchStatus;
            existingOcr.RawOcrConfidence = rcResult.Confidence;
            existingOcr.ProcessedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            if (!matched)
            {
                await _auditLogService.LogAsync(
                    userId,
                    "ClaimIntake.RcMismatch",
                    "Claim",
                    claimId,
                    null,
                    new
                    {
                        PolicyRegNumber = policyRegNumber,
                        RcRegNumber = rcRegNumber,
                        PlateRegNumber = plateRegNumber
                    });

                return (
                    true,
                    null,
                    new RaiseStep2ResponseDto
                    {
                        MatchStatus = matchStatus,
                        RoutedToSurveyor = true,
                        Message =
                            "We couldn't verify your vehicle's registration details. " +
                            "This claim will be routed to a Surveyor for assessment."
                    });
            }

            await _auditLogService.LogAsync(
                userId,
                "ClaimIntake.RcVerified",
                "Claim",
                claimId,
                null,
                new { RegNumber = policyRegNumber });

            return (
                true,
                null,
                new RaiseStep2ResponseDto
                {
                    MatchStatus = matchStatus,
                    RoutedToSurveyor = false,
                    Message = "Verification successful."
                });
        }

        // =========================================================
        // ESTIMATE
        // =========================================================

        public async Task<(bool, string?, EstimateOrNotEligible?)> GenerateEstimateAsync(
            Guid claimId,
            Guid userId)
        {
            var claim = await GetOwnedClaimAsync(claimId, userId);

            if (claim == null)
            {
                return (false, "Claim not found.", null);
            }

            var eligibility = await CheckEligibilityAsync(claimId);

            if (!eligibility.Eligible)
            {
                return (
                    true,
                    null,
                    new EstimateOrNotEligible
                    {
                        Eligible = false,
                        Reason = eligibility.Reason
                    });
            }

            try
            {
                var estimate = await _estimateEngineService.GenerateAsync(claimId);

                return (
                    true,
                    null,
                    new EstimateOrNotEligible
                    {
                        Eligible = true,
                        Estimate = estimate
                    });
            }
            catch (InvalidOperationException ex)
            {
                return (false, ex.Message, null);
            }
        }

        // =========================================================
        // ACCEPT / DECLINE
        // =========================================================

        public async Task<(bool, string?, ClaimRaiseActionResult?)> AcceptAsync(
            Guid claimId,
            Guid userId)
        {
            var claim = await GetOwnedClaimAsync(claimId, userId);

            if (claim == null)
            {
                return (false, "Claim not found.", null);
            }

            // Re-validate eligibility one more time - conditions can
            // change between estimate generation and accept.
            var eligibility = await CheckEligibilityAsync(claimId);

            if (!eligibility.Eligible)
            {
                return (
                    false,
                    $"This claim is no longer eligible for Instant Claim ({eligibility.Reason}).",
                    null);
            }

            var estimate =
                await _context.ClaimEstimateResults
                    .FirstOrDefaultAsync(x => x.ClaimId == claimId);

            if (estimate == null)
            {
                return (false, "No estimate has been generated for this claim yet.", null);
            }

            if (estimate.CustomerDecision != null)
            {
                return (false, "A decision has already been recorded for this claim.", null);
            }

            // A login OTP token never satisfies this - only a fresh,
            // unconsumed InstantClaimAccept-purpose verification does.
            var otpConsumed =
                await _otpService.ConsumeFreshVerificationAsync(
                    OtpPurposeConstants.InstantClaimAccept,
                    claimId,
                    OtpFreshWindow);

            if (!otpConsumed)
            {
                return (
                    false,
                    "A freshly-verified OTP is required to accept this offer. Please verify the OTP sent for this claim.",
                    null);
            }

            estimate.CustomerDecision = InstantClaimDecisionConstants.Accepted;
            estimate.DecisionAt = DateTime.UtcNow;
            estimate.OtpVerifiedAt = DateTime.UtcNow;

            var approved =
                await _claimApprovalService.ApproveClaimAsync(
                    claimId,
                    new ApproveClaimRequest
                    {
                        ApprovedAmount = estimate.NetAssessmentAmount,
                        Remarks = "Instant Claim accepted by customer."
                    });

            await _context.SaveChangesAsync();

            await _auditLogService.LogAsync(
                userId,
                "InstantClaim.Accepted",
                "Claim",
                claimId,
                null,
                new { estimate.NetAssessmentAmount, ClaimApproved = approved });

            return (
                true,
                null,
                new ClaimRaiseActionResult
                {
                    Success = true,
                    Message =
                        "Your Instant Claim has been accepted. Your claim is approved " +
                        $"for ₹{estimate.NetAssessmentAmount:N2} and will move to payment processing."
                });
        }

        public async Task<(bool, string?, ClaimRaiseActionResult?)> DeclineAsync(
            Guid claimId,
            Guid userId)
        {
            var claim = await GetOwnedClaimAsync(claimId, userId);

            if (claim == null)
            {
                return (false, "Claim not found.", null);
            }

            var estimate =
                await _context.ClaimEstimateResults
                    .FirstOrDefaultAsync(x => x.ClaimId == claimId);

            if (estimate == null)
            {
                return (false, "No estimate has been generated for this claim yet.", null);
            }

            if (estimate.CustomerDecision != null)
            {
                return (false, "A decision has already been recorded for this claim.", null);
            }

            estimate.CustomerDecision = InstantClaimDecisionConstants.Declined;
            estimate.DecisionAt = DateTime.UtcNow;

            // Claim.StatusId is deliberately left untouched - it stays
            // Submitted, picked up by the existing, unmodified Admin-
            // assigns-Surveyor pipeline.
            await _context.SaveChangesAsync();

            await _auditLogService.LogAsync(
                userId,
                "InstantClaim.Declined",
                "Claim",
                claimId,
                null,
                null);

            return (
                true,
                null,
                new ClaimRaiseActionResult
                {
                    Success = true,
                    Message = "Your claim has been routed to a Surveyor for assessment."
                });
        }

        // =========================================================
        // HELPERS
        // =========================================================

        private async Task<Claim?> GetOwnedClaimAsync(
            Guid claimId,
            Guid userId)
        {
            var claim =
                await _context.Claims
                    .FirstOrDefaultAsync(x => x.ClaimId == claimId);

            if (claim == null)
            {
                return null;
            }

            var customer =
                await _customerRepository.GetByIdAsync(claim.CustomerId);

            if (customer == null || customer.UserId != userId)
            {
                return null;
            }

            return claim;
        }

        private async Task<(bool Eligible, string? Reason)> CheckEligibilityAsync(
            Guid claimId)
        {
            var intake =
                await _context.ClaimIntakes
                    .FirstOrDefaultAsync(x => x.ClaimId == claimId);

            if (intake == null)
            {
                return (false, "Claim intake not found");
            }

            if (intake.LossType != LossTypeConstants.MinorAccident ||
                !intake.InstantClaimToggle)
            {
                return (false, "not an Instant Claim candidate");
            }

            if (intake.DeathOccurred == true)
            {
                return (false, "a fatality was reported");
            }

            var ocr =
                await _context.ClaimRcOcrResults
                    .FirstOrDefaultAsync(x => x.ClaimId == claimId);

            if (ocr == null || ocr.MatchStatus != RcMatchStatusConstants.Matched)
            {
                return (false, "vehicle registration could not be verified");
            }

            var scoring =
                await _claimScoringService.GetInternalScoringAsync(claimId);

            if (scoring == null)
            {
                return (false, "risk assessment not yet available");
            }

            var eligibilityConfig =
                await _context.InstantClaimEligibilities
                    .FirstOrDefaultAsync(x => x.IsActive);

            // Fail-safe: no config = most conservative default
            // (Green-only), same philosophy as ScoringThreshold's
            // fail-safe-to-Red when unconfigured.
            var minEligibleBand =
                eligibilityConfig?.MinEligibleBand ?? ScoringBandConstants.Green;

            if (scoring.CompositeBand > minEligibleBand)
            {
                return (false, "risk band is not eligible for Instant Claim");
            }

            return (true, null);
        }
    }
}