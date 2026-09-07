using ClaimShield.Api.Constants;
using ClaimShield.Api.Data.Context;
using ClaimShield.Api.Interfaces.Services;
using ClaimShield.Api.Models.DTOs.ReassessmentComments;
using ClaimShield.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace ClaimShield.Api.Services
{
    public class ReassessmentCommentService : IReassessmentCommentService
    {
        private readonly ClaimShieldDbContext _context;

        public ReassessmentCommentService(
            ClaimShieldDbContext context)
        {
            _context = context;
        }

        // =========================================================
        // GET BY CLAIM
        // =========================================================

        public async Task<IEnumerable<ReassessmentCommentResponseDto>> GetByClaimAsync(
            Guid claimId)
        {
            var comments =
                await _context.ReassessmentComments
                    .Where(x => x.ClaimId == claimId)
                    .OrderBy(x => x.CreatedDate)
                    .ToListAsync();

            var result = new List<ReassessmentCommentResponseDto>();

            foreach (var comment in comments)
            {
                result.Add(
                    await MapToDtoAsync(comment));
            }

            return result;
        }

        // =========================================================
        // CREATE (reassessment-response)
        // =========================================================

        public async Task<(bool Success, string? ErrorMessage, ReassessmentCommentResponseDto? Comment)> CreateAsync(
            Guid authorId,
            CreateReassessmentCommentRequest request)
        {
            var claim =
                await _context.Claims
                    .FirstOrDefaultAsync(
                        x => x.ClaimId == request.ClaimId);

            if (claim == null)
            {
                return (false, "Claim not found.", null);
            }

            // -----------------------------------------------------
            // A reassessment comment thread only makes sense while
            // the claim has an open Surveyor decision awaiting
            // Approver review (same open-escalation rule used by
            // ClaimDecisionService).
            // -----------------------------------------------------

            // Checkpoint 5 - ClaimDecisions also holds Hold/Resume/Return
            // for Rework/Request Info rows now, not just real maker-
            // checker outcomes, so this must filter to Approve/Review/
            // Deny - otherwise a claim merely held-then-resumed while
            // SurveyCompleted would look like an open escalation.
            var latestDecision =
                await _context.ClaimDecisions
                    .Where(
                        x =>
                            x.ClaimId == request.ClaimId &&
                            (x.Decision == ClaimDecisionConstants.Approve ||
                             x.Decision == ClaimDecisionConstants.Review ||
                             x.Decision == ClaimDecisionConstants.Deny))
                    .OrderByDescending(x => x.DecisionDate)
                    .FirstOrDefaultAsync();

            var isOpenEscalation =
                latestDecision != null &&
                latestDecision.RoleId == RoleConstants.SurveyorId &&
                claim.StatusId == ClaimStatusConstants.SurveyCompleted;

            if (!isOpenEscalation)
            {
                return (
                    false,
                    "This claim does not have a decision currently under Approver review.",
                    null);
            }

            var comment = new ReassessmentComment
            {
                ReassessmentCommentId = Guid.NewGuid(),

                ClaimId = request.ClaimId,

                AuthorId = authorId,

                Comment = request.Comment,

                CreatedDate = DateTime.UtcNow
            };

            _context.ReassessmentComments.Add(comment);

            await _context.SaveChangesAsync();

            return (true, null, await MapToDtoAsync(comment));
        }

        // =========================================================
        // MAPPING
        // =========================================================

        private async Task<ReassessmentCommentResponseDto> MapToDtoAsync(
            ReassessmentComment comment)
        {
            var user =
                await _context.Users
                    .FirstOrDefaultAsync(
                        x => x.UserId == comment.AuthorId);

            return new ReassessmentCommentResponseDto
            {
                ReassessmentCommentId = comment.ReassessmentCommentId,

                ClaimId = comment.ClaimId,

                AuthorId = comment.AuthorId,

                AuthorName = GetUserDisplayName(user),

                Comment = comment.Comment,

                CreatedDate = comment.CreatedDate
            };
        }

        private static string GetUserDisplayName(
            User? user)
        {
            if (user == null)
            {
                return "Unknown";
            }

            var firstName = user.FirstName?.Trim();
            var lastName = user.LastName?.Trim();

            if (!string.IsNullOrWhiteSpace(firstName) &&
                !string.IsNullOrWhiteSpace(lastName))
            {
                return $"{firstName} {lastName}";
            }

            if (!string.IsNullOrWhiteSpace(firstName))
            {
                return firstName;
            }

            if (!string.IsNullOrWhiteSpace(lastName))
            {
                return lastName;
            }

            return "Unknown";
        }
    }
}
