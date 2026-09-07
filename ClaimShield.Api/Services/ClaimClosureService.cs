using ClaimShield.Api.Constants;
using ClaimShield.Api.Data.Context;
using ClaimShield.Api.Interfaces.Services;
using ClaimShield.Api.Models.DTOs.Claims;
using Microsoft.EntityFrameworkCore;

namespace ClaimShield.Api.Services
{
    public class ClaimClosureService : IClaimClosureService
    {
        private readonly ClaimShieldDbContext _context;

        public ClaimClosureService(
            ClaimShieldDbContext context)
        {
            _context = context;
        }

        // =========================================================
        // CLOSE CLAIM
        // =========================================================

        public async Task<bool> CloseClaimAsync(
            Guid claimId,
            CloseClaimRequest request)
        {
            // -----------------------------------------------------
            // Find claim
            // -----------------------------------------------------

            var claim = await _context.Claims
                .FirstOrDefaultAsync(
                    x => x.ClaimId == claimId);

            if (claim == null)
            {
                return false;
            }

            // -----------------------------------------------------
            // A Settled claim (the normal happy path) or a Rejected
            // claim (denied, never reached payment) can both be
            // closed - the ClosureReasonId on the request is what
            // actually records which of these this closure represents,
            // this check just gates WHEN closure is possible at all.
            // -----------------------------------------------------

            if (claim.StatusId != ClaimStatusConstants.Settled &&
                claim.StatusId != ClaimStatusConstants.Rejected)
            {
                return false;
            }

            claim.StatusId = ClaimStatusConstants.Closed;

            claim.ClosureReasonId = request.ClosureReasonId;

            // -----------------------------------------------------
            // Persist closure remarks (Checkpoint 3 - previously
            // accepted by the request but silently discarded here).
            // -----------------------------------------------------

            if (!string.IsNullOrWhiteSpace(request.Remarks))
            {
                claim.ClosureRemarks = request.Remarks;
            }

            // -----------------------------------------------------
            // Updated date
            // -----------------------------------------------------

            claim.UpdatedDate = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return true;
        }

        // =========================================================
        // CLOSE OR DENY FROM REPAIR AUTHORIZATION
        // =========================================================

        public async Task<(bool Success, string? ErrorMessage)> CloseOrDenyFromRepairAuthorizationAsync(
            Guid claimId,
            RepairAuthCloseOrDenyRequest request)
        {
            var claim = await _context.Claims
                .FirstOrDefaultAsync(
                    x => x.ClaimId == claimId);

            if (claim == null)
            {
                return (false, "Claim not found.");
            }

            // Only reachable while the claim is genuinely at the
            // Repair Authorization stage - not before (Survey not yet
            // completed) and not after (already moved on to
            // Liability/Approval/Settlement/Closed).
            if (claim.StatusId != ClaimStatusConstants.RepairAssigned &&
                claim.StatusId != ClaimStatusConstants.RepairInProgress)
            {
                return (false, "This claim is not currently at the Repair Authorization stage.");
            }

            if (string.IsNullOrWhiteSpace(request.Remarks))
            {
                return (false, "A description/remarks is required.");
            }

            if (request.Action == "Closure")
            {
                if (request.ClosureReasonId == null)
                {
                    return (false, "Select a closure reason.");
                }

                claim.StatusId = ClaimStatusConstants.Closed;
                claim.RepairAuthClosureReasonId = request.ClosureReasonId;
                claim.RepairAuthDenialReasonId = null;
                claim.RepairAuthClosureRemarks = request.Remarks;
            }
            else if (request.Action == "Denial")
            {
                if (request.DenialReasonId == null)
                {
                    return (false, "Select a denial reason.");
                }

                claim.StatusId = ClaimStatusConstants.Rejected;
                claim.RepairAuthDenialReasonId = request.DenialReasonId;
                claim.RepairAuthClosureReasonId = null;
                claim.RepairAuthClosureRemarks = request.Remarks;
            }
            else
            {
                return (false, "Action must be either 'Closure' or 'Denial'.");
            }

            claim.UpdatedDate = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return (true, null);
        }
    }
}