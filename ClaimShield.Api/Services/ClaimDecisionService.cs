using System.Text.Json;
using ClaimShield.Api.Constants;
using ClaimShield.Api.Data.Context;
using ClaimShield.Api.Interfaces.Services;
using ClaimShield.Api.Models.DTOs.ClaimDecisions;
using ClaimShield.Api.Models.DTOs.RepairAssignments;
using ClaimShield.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace ClaimShield.Api.Services
{
    // =============================================================
    // Maker-checker workflow.
    //
    // Surveyor (maker) records Approve/Review/Deny. Approve
    // auto-finalizes only if the claim amount is within the
    // Surveyor's AuthorityLimits.MaxApprovalAmount AND the current
    // composite scoring band (Phase 9's two-stage rule engine) is
    // Green (missing AuthorityLimits row, missing scoring result, or
    // any Amber/Red band = always escalate). Review/Deny always
    // escalate. There is no dedicated "pending approval" claim
    // status - while escalated, Claim.StatusId simply stays at
    // SurveyCompleted, and the open escalation is derived from
    // "latest decision is Surveyor-authored AND status is still
    // SurveyCompleted."
    //
    // Scoring itself is NOT triggered here - Stage 2 already ran
    // when the survey report was submitted
    // (SurveyReportService.CreateAsync/UpdateAsync). This just reads
    // the current composite result.
    // =============================================================

    public class ClaimDecisionService : IClaimDecisionService
    {
        // Checkpoint 5 - ClaimDecisions holds both real maker-checker
        // outcomes (Approve/Review/Deny) and the newer administrative
        // actions (Hold/Resume/Return for Rework/Request Info). Anywhere
        // this service asks "has a real decision been made on this
        // claim" or "what was the latest real decision", it must filter
        // to this set - otherwise an administrative action gets
        // mistaken for a maker-checker outcome (e.g. a claim that was
        // merely held-then-resumed looking "already decided", or looking
        // like an open Approver escalation).
        private static readonly HashSet<int> MakerCheckerDecisionIds = new()
        {
            ClaimDecisionConstants.Approve,
            ClaimDecisionConstants.Review,
            ClaimDecisionConstants.Deny,
        };

        private readonly ClaimShieldDbContext _context;
        private readonly IClaimScoringService _claimScoringService;
        private readonly IAuditLogService _auditLogService;
        private readonly IRepairAssignmentService _repairAssignmentService;

        public ClaimDecisionService(
            ClaimShieldDbContext context,
            IClaimScoringService claimScoringService,
            IAuditLogService auditLogService,
            IRepairAssignmentService repairAssignmentService)
        {
            _context = context;
            _claimScoringService = claimScoringService;
            _auditLogService = auditLogService;
            _repairAssignmentService = repairAssignmentService;
        }

        // Mirrors the Checkpoint 5 (Module 3) StaffRegisterAsync fix -
        // a Claim.PreferredRepairerId set at registration was only ever
        // a preference field, never actually wired to a real
        // RepairAssignment row. A claim could reach Repair Authorization
        // with no Repairer able to see or act on it, requiring a manual
        // Admin > Claims > Assign a Repairer step every time. Auto-create
        // the assignment the moment the claim is actually approved into
        // RepairAssigned, same as the auto-assigned Surveyor at intake.
        private async Task AutoAssignPreferredRepairerAsync(
            Claim claim,
            Guid assignedBy)
        {
            if (claim.StatusId != ClaimStatusConstants.RepairAssigned ||
                claim.PreferredRepairerId == null)
            {
                return;
            }

            var hasRepairAssignment =
                await _context.RepairAssignments
                    .AnyAsync(x => x.ClaimId == claim.ClaimId);

            if (hasRepairAssignment)
            {
                return;
            }

            await _repairAssignmentService.CreateAsync(
                new CreateRepairAssignmentRequest
                {
                    ClaimId = claim.ClaimId,
                    RepairerId = claim.PreferredRepairerId.Value,
                    AssignedBy = assignedBy,
                    AssignmentStatusId = AssignmentStatusConstants.Assigned,
                    Remarks = "Auto-assigned from the claim's preferred repairer on approval.",
                });
        }

        // =========================================================
        // SURVEYOR DECISION
        // =========================================================

        public async Task<ClaimDecisionResult> RecordSurveyorDecisionAsync(
            Guid claimId,
            Guid surveyorId,
            SurveyorDecisionRequest request)
        {
            var claim =
                await _context.Claims
                    .FirstOrDefaultAsync(
                        x => x.ClaimId == claimId);

            if (claim == null)
            {
                return Fail("Claim not found.");
            }

            var isOwner =
                await _context.SurveyAssignments
                    .AnyAsync(
                        x =>
                            x.ClaimId == claimId &&
                            x.SurveyorId == surveyorId);

            if (!isOwner)
            {
                return Fail(
                    "You are not assigned to survey this claim.");
            }

            if (claim.StatusId != ClaimStatusConstants.SurveyCompleted)
            {
                return Fail(
                    "A decision can only be recorded once the survey report has been completed.");
            }

            // Checkpoint 5 - ClaimDecisions now also holds Hold/Resume/
            // Return for Rework/Request Info rows (same canonical table,
            // deliberately not a parallel writer), so "already decided"
            // must only look at real maker-checker outcomes - otherwise
            // a claim that was merely put on hold and resumed would be
            // permanently blocked from ever getting a real decision.
            var alreadyDecided =
                await _context.ClaimDecisions
                    .AnyAsync(
                        x => x.ClaimId == claimId && MakerCheckerDecisionIds.Contains(x.Decision));

            if (alreadyDecided)
            {
                return Fail(
                    "A decision has already been recorded for this claim.");
            }

            var composite =
                await _claimScoringService.GetInternalScoringAsync(
                    claimId);

            var latestSurveyReport =
                await _context.SurveyReports
                    .Where(x => x.ClaimId == claimId)
                    .OrderByDescending(x => x.CreatedDate)
                    .FirstOrDefaultAsync();

            var claimAmount =
                latestSurveyReport?.EstimatedRepairCost
                ?? claim.EstimatedLossAmount
                ?? 0m;

            var authorityLimit =
                await _context.AuthorityLimits
                    .FirstOrDefaultAsync(
                        x => x.RoleId == RoleConstants.SurveyorId);

            // A Surveyor's own Assessment Recommendation (Phase 13's
            // SurveyReport.OverallRecommendationId) can explicitly call for
            // Approver review regardless of amount/band - previously this
            // value was stored but never consumed anywhere.
            var referredToApprover =
                latestSurveyReport?.OverallRecommendationId ==
                    SurveyorRecommendationConstants.ReferToApprover;

            var withinAuthority =
                request.Decision == ClaimDecisionConstants.Approve &&
                !referredToApprover &&
                authorityLimit != null &&
                (authorityLimit.MaxApprovalAmount == null ||
                    claimAmount <= authorityLimit.MaxApprovalAmount.Value);
                // Risk score band no longer gates advancement here -
                // the score/loopholes are shown to the Surveyor as
                // advisory information on the Decision Support Risk
                // page, but a Green band is not required for the
                // Surveyor's own Approve decision to move the claim
                // forward. Authority limit (claim amount) and an
                // explicit "refer to approver" recommendation still
                // apply, since those are separate rules from the
                // score itself.

            var escalated = !withinAuthority;

            var beforeState =
                new
                {
                    claim.StatusId,
                    claim.ReserveAmount
                };

            if (!escalated)
            {
                claim.StatusId = ClaimStatusConstants.RepairAssigned;
                claim.ReserveAmount = claimAmount;
                claim.UpdatedDate = DateTime.UtcNow;
            }

            var decision = new ClaimDecision
            {
                ClaimDecisionId = Guid.NewGuid(),

                ClaimId = claimId,

                DecidedBy = surveyorId,

                RoleId = RoleConstants.SurveyorId,

                Decision = request.Decision,

                Reasoning = request.Reasoning,

                AiScoresSnapshot =
                    JsonSerializer.Serialize(
                        new
                        {
                            composite?.CompositeScore,
                            composite?.CompositeBandName,
                            Stages = composite?.Stages,
                            ClaimAmount = claimAmount
                        }),

                DecisionDate = DateTime.UtcNow
            };

            _context.ClaimDecisions.Add(decision);

            await _context.SaveChangesAsync();

            await AutoAssignPreferredRepairerAsync(claim, surveyorId);

            var afterState =
                new
                {
                    claim.StatusId,
                    claim.ReserveAmount
                };

            await _auditLogService.LogAsync(
                surveyorId,
                $"SurveyorDecision.{GetDecisionName(request.Decision)}." +
                    (escalated ? "Escalated" : "AutoFinalized"),
                "Claim",
                claimId,
                beforeState,
                afterState);

            return new ClaimDecisionResult
            {
                Success = true,
                Escalated = escalated,
                UpdatedClaimStatusId = claim.StatusId,
                Decision = await MapToDtoAsync(decision, escalated)
            };
        }

        // =========================================================
        // APPROVER DECISION
        // =========================================================

        public async Task<ClaimDecisionResult> RecordApproverDecisionAsync(
            Guid claimId,
            Guid approverId,
            int decidedByRoleId,
            ApproverDecisionRequest request)
        {
            if (request.Decision != ClaimDecisionConstants.Approve &&
                request.Decision != ClaimDecisionConstants.Deny)
            {
                return Fail(
                    "An Approver decision must be either Approve or Deny.");
            }

            var claim =
                await _context.Claims
                    .FirstOrDefaultAsync(
                        x => x.ClaimId == claimId);

            if (claim == null)
            {
                return Fail("Claim not found.");
            }

            // Only a real maker-checker decision can open an escalation -
            // an intervening Hold/Resume/Request Info row (also latest by
            // date) must not be mistaken for one.
            var latestDecision =
                await _context.ClaimDecisions
                    .Where(x => x.ClaimId == claimId && MakerCheckerDecisionIds.Contains(x.Decision))
                    .OrderByDescending(x => x.DecisionDate)
                    .FirstOrDefaultAsync();

            var isOpenEscalation =
                latestDecision != null &&
                latestDecision.RoleId == RoleConstants.SurveyorId &&
                claim.StatusId == ClaimStatusConstants.SurveyCompleted;

            if (!isOpenEscalation)
            {
                return Fail(
                    "This claim does not have a pending Surveyor decision awaiting Approver review.");
            }

            var beforeState =
                new
                {
                    claim.StatusId,
                    claim.ApprovedAmount
                };

            if (request.Decision == ClaimDecisionConstants.Approve)
            {
                var latestSurveyReport =
                    await _context.SurveyReports
                        .Where(x => x.ClaimId == claimId)
                        .OrderByDescending(x => x.CreatedDate)
                        .FirstOrDefaultAsync();

                var claimAmount =
                    latestSurveyReport?.EstimatedRepairCost
                    ?? claim.EstimatedLossAmount
                    ?? 0m;

                var authorityCheck =
                    await CheckApproverAuthorityAsync(
                        claimId,
                        claimAmount,
                        decidedByRoleId);

                if (!authorityCheck.Allowed)
                {
                    return Fail(authorityCheck.Reason!);
                }

                claim.StatusId = ClaimStatusConstants.RepairAssigned;
                claim.ReserveAmount = claimAmount;
            }
            else
            {
                claim.StatusId = ClaimStatusConstants.Rejected;
                claim.DecisionRemarks = request.Reasoning;
            }

            claim.UpdatedDate = DateTime.UtcNow;

            var decision = new ClaimDecision
            {
                ClaimDecisionId = Guid.NewGuid(),

                ClaimId = claimId,

                DecidedBy = approverId,

                RoleId = decidedByRoleId,

                Decision = request.Decision,

                Reasoning = request.Reasoning,

                AiScoresSnapshot = latestDecision!.AiScoresSnapshot,

                DecisionDate = DateTime.UtcNow
            };

            _context.ClaimDecisions.Add(decision);

            await _context.SaveChangesAsync();

            await AutoAssignPreferredRepairerAsync(claim, approverId);

            var afterState =
                new
                {
                    claim.StatusId,
                    claim.ApprovedAmount
                };

            await _auditLogService.LogAsync(
                approverId,
                $"ApproverDecision.{GetDecisionName(request.Decision)}.Finalized",
                "Claim",
                claimId,
                beforeState,
                afterState);

            return new ClaimDecisionResult
            {
                Success = true,
                Escalated = false,
                UpdatedClaimStatusId = claim.StatusId,
                Decision = await MapToDtoAsync(decision, false)
            };
        }

        // =========================================================
        // DIRECT APPROVER DECISION (Phase 14 reconciliation)
        //
        // Covers every Approve/Reject that happens OUTSIDE the open-
        // escalation flow above: ClaimApprovalController's direct
        // endpoints, and the side effect of approving a repair
        // estimate. Both used to write straight to Claim.StatusId via
        // ClaimApprovalService with no ClaimDecisions row, no audit
        // trail beyond a generic log line, and no AuthorityLimits
        // check at all. This is now the one place both of those go
        // through, so there is a single decision history and a single
        // enforcement point regardless of which stage of the claim
        // lifecycle triggered it.
        // =========================================================

        public async Task<ClaimDecisionResult> RecordDirectApproverDecisionAsync(
            Guid claimId,
            Guid decidedBy,
            int decidedByRoleId,
            int decision,
            string reasoning,
            decimal? approvedAmount,
            bool requireRepairInProgress = false)
        {
            if (decision != ClaimDecisionConstants.Approve &&
                decision != ClaimDecisionConstants.Deny)
            {
                return Fail(
                    "A direct Approver decision must be either Approve or Deny.");
            }

            var claim =
                await _context.Claims
                    .FirstOrDefaultAsync(
                        x => x.ClaimId == claimId);

            if (claim == null)
            {
                return Fail("Claim not found.");
            }

            if (claim.StatusId == ClaimStatusConstants.Approved ||
                claim.StatusId == ClaimStatusConstants.Rejected ||
                claim.StatusId == ClaimStatusConstants.Closed)
            {
                return Fail(
                    "This claim has already been finalized and can no longer be decided.");
            }

            var beforeState =
                new
                {
                    claim.StatusId,
                    claim.ApprovedAmount
                };

            if (decision == ClaimDecisionConstants.Approve)
            {
                if (approvedAmount == null ||
                    approvedAmount.Value <= 0)
                {
                    return Fail(
                        "An approved amount is required to approve a claim.");
                }

                // Phase 16 - Repair Authorization sequencing. Previously a
                // repair estimate could be approved (jumping the claim
                // straight to Approved) with no requirement that the
                // repair had actually been accepted/started. Only the
                // repair-estimate-approval entry point sets this flag -
                // the generic ClaimApprovalController path is unaffected.
                if (requireRepairInProgress &&
                    claim.StatusId != ClaimStatusConstants.RepairInProgress)
                {
                    return Fail(
                        "This claim's repair has not been marked In Progress yet - " +
                            "the Repairer must accept/start the repair assignment " +
                            "before the estimate can be approved.");
                }

                var authorityCheck =
                    await CheckApproverAuthorityAsync(
                        claimId,
                        approvedAmount.Value,
                        decidedByRoleId);

                if (!authorityCheck.Allowed)
                {
                    return Fail(authorityCheck.Reason!);
                }

                claim.StatusId = ClaimStatusConstants.Approved;
                claim.ApprovedAmount = approvedAmount.Value;
                claim.DecisionRemarks = reasoning;
            }
            else
            {
                claim.StatusId = ClaimStatusConstants.Rejected;
                claim.ApprovedAmount = null;
                claim.DecisionRemarks = reasoning;
            }

            claim.UpdatedDate = DateTime.UtcNow;

            var composite =
                await _claimScoringService.GetInternalScoringAsync(
                    claimId);

            var decisionRow = new ClaimDecision
            {
                ClaimDecisionId = Guid.NewGuid(),

                ClaimId = claimId,

                DecidedBy = decidedBy,

                RoleId = decidedByRoleId,

                Decision = decision,

                Reasoning =
                    string.IsNullOrWhiteSpace(reasoning)
                        ? "No reasoning provided."
                        : reasoning,

                AiScoresSnapshot =
                    JsonSerializer.Serialize(
                        new
                        {
                            composite?.CompositeScore,
                            composite?.CompositeBandName
                        }),

                DecisionDate = DateTime.UtcNow
            };

            _context.ClaimDecisions.Add(decisionRow);

            await _context.SaveChangesAsync();

            var afterState =
                new
                {
                    claim.StatusId,
                    claim.ApprovedAmount
                };

            await _auditLogService.LogAsync(
                decidedBy,
                $"ApproverDecision.{GetDecisionName(decision)}.Direct",
                "Claim",
                claimId,
                beforeState,
                afterState);

            // Settlement auto-compute is triggered by
            // RepairEstimateService.ApproveAsync AFTER it persists the
            // estimate's own ApprovalStatusId - not here. This method runs
            // before that write, so computing settlement at this point
            // would read the repair estimate as not-yet-approved.

            return new ClaimDecisionResult
            {
                Success = true,
                Escalated = false,
                UpdatedClaimStatusId = claim.StatusId,
                Decision = await MapToDtoAsync(decisionRow, false)
            };
        }

        // =========================================================
        // ON HOLD (Checkpoint 5 / Module 5)
        // =========================================================

        public async Task<ClaimDecisionResult> PutOnHoldAsync(
            Guid claimId,
            Guid actingUserId,
            int actingRoleId,
            HoldClaimRequest request)
        {
            var claim =
                await _context.Claims
                    .FirstOrDefaultAsync(x => x.ClaimId == claimId);

            if (claim == null)
            {
                return Fail("Claim not found.");
            }

            if (claim.StatusId == ClaimStatusConstants.OnHold)
            {
                return Fail("This claim is already on hold.");
            }

            if (claim.StatusId == ClaimStatusConstants.Approved ||
                claim.StatusId == ClaimStatusConstants.Rejected ||
                claim.StatusId == ClaimStatusConstants.Settled ||
                claim.StatusId == ClaimStatusConstants.Closed)
            {
                return Fail(
                    "A finalized claim (Approved, Rejected, Settled, or Closed) cannot be put on hold.");
            }

            var beforeState = new { claim.StatusId };

            claim.PriorStatusId = claim.StatusId;
            claim.HoldReason = request.Reason;
            claim.OnHoldDate = DateTime.UtcNow;
            claim.StatusId = ClaimStatusConstants.OnHold;
            claim.UpdatedDate = DateTime.UtcNow;

            await SaveDecisionAsync(
                claimId,
                actingUserId,
                actingRoleId,
                ClaimDecisionConstants.Hold,
                request.Reason);

            await _auditLogService.LogAsync(
                actingUserId,
                "Claim.OnHold",
                "Claim",
                claimId,
                beforeState,
                new { claim.StatusId, claim.HoldReason });

            return Ok(claim.StatusId);
        }

        // =========================================================
        // RESUME (Checkpoint 5 / Module 5)
        // =========================================================

        public async Task<ClaimDecisionResult> ResumeAsync(
            Guid claimId,
            Guid actingUserId,
            int actingRoleId)
        {
            var claim =
                await _context.Claims
                    .FirstOrDefaultAsync(x => x.ClaimId == claimId);

            if (claim == null)
            {
                return Fail("Claim not found.");
            }

            if (claim.StatusId != ClaimStatusConstants.OnHold)
            {
                return Fail("This claim is not currently on hold.");
            }

            if (claim.PriorStatusId == null)
            {
                return Fail(
                    "This claim has no recorded prior status to resume to.");
            }

            var beforeState = new { claim.StatusId };

            claim.StatusId = claim.PriorStatusId.Value;
            claim.PriorStatusId = null;
            claim.UpdatedDate = DateTime.UtcNow;

            await SaveDecisionAsync(
                claimId,
                actingUserId,
                actingRoleId,
                ClaimDecisionConstants.Resume,
                $"Resumed from hold. Reason it was held: {claim.HoldReason}");

            await _auditLogService.LogAsync(
                actingUserId,
                "Claim.Resumed",
                "Claim",
                claimId,
                beforeState,
                new { claim.StatusId });

            return Ok(claim.StatusId);
        }

        // =========================================================
        // RETURN FOR REWORK (Checkpoint 5 / Module 5)
        //
        // Scoped to the one clean, unambiguous backward transition:
        // a completed survey, not yet decided (or under open
        // escalation), gets sent back to Survey for redoing - rather
        // than a fully generic "pick any earlier stage" jump, which
        // would risk invalid/unsafe backward transitions from stages
        // whose forward side effects (settlement, payment) can't be
        // cleanly undone.
        // =========================================================

        public async Task<ClaimDecisionResult> ReturnForReworkAsync(
            Guid claimId,
            Guid actingUserId,
            int actingRoleId,
            ReturnForReworkRequest request)
        {
            var claim =
                await _context.Claims
                    .FirstOrDefaultAsync(x => x.ClaimId == claimId);

            if (claim == null)
            {
                return Fail("Claim not found.");
            }

            if (claim.StatusId != ClaimStatusConstants.SurveyCompleted)
            {
                return Fail(
                    "A claim can only be returned for rework once its survey has been completed and is awaiting a decision.");
            }

            var beforeState = new { claim.StatusId };

            claim.StatusId = ClaimStatusConstants.SurveyAssigned;
            claim.DecisionRemarks = request.Remarks;
            claim.UpdatedDate = DateTime.UtcNow;

            // Moving the claim back to SurveyAssigned isn't enough on its
            // own - SurveyReportService.SaveDraftAsync refuses to edit a
            // report once its own AssessmentStatusId is
            // SubmittedForReview, so without this the Surveyor would see
            // the claim "back at Survey" but be unable to actually redo
            // it. Reset the fine-grained assessment status too, back to
            // the start of its own stepper.
            var latestSurveyReport =
                await _context.SurveyReports
                    .Where(x => x.ClaimId == claimId)
                    .OrderByDescending(x => x.CreatedDate)
                    .FirstOrDefaultAsync();

            if (latestSurveyReport != null)
            {
                latestSurveyReport.AssessmentStatusId = AssessmentStatusConstants.Assigned;
                latestSurveyReport.UpdatedDate = DateTime.UtcNow;
            }

            await SaveDecisionAsync(
                claimId,
                actingUserId,
                actingRoleId,
                ClaimDecisionConstants.ReturnForRework,
                request.Remarks);

            await _auditLogService.LogAsync(
                actingUserId,
                "Claim.ReturnedForRework",
                "Claim",
                claimId,
                beforeState,
                new { claim.StatusId });

            return Ok(claim.StatusId);
        }

        // =========================================================
        // REQUEST ADDITIONAL INFORMATION (Checkpoint 5 / Module 5)
        //
        // Non-blocking - Claim.StatusId is untouched. Visible via
        // GetMyQueueAsync's new "InfoRequested" bucket below.
        // =========================================================

        public async Task<ClaimDecisionResult> RequestAdditionalInfoAsync(
            Guid claimId,
            Guid actingUserId,
            int actingRoleId,
            RequestAdditionalInfoRequest request)
        {
            if (request.FromRoleId != RoleConstants.CustomerId &&
                request.FromRoleId != RoleConstants.RepairerId)
            {
                return Fail(
                    "Additional information can only be requested from the Customer or the Repairer.");
            }

            var claim =
                await _context.Claims
                    .FirstOrDefaultAsync(x => x.ClaimId == claimId);

            if (claim == null)
            {
                return Fail("Claim not found.");
            }

            if (claim.StatusId == ClaimStatusConstants.Closed)
            {
                return Fail("A closed claim cannot have an information request raised against it.");
            }

            claim.InfoRequestReason = request.Reason;
            claim.InfoRequestedDate = DateTime.UtcNow;
            claim.InfoRequestedFromRoleId = request.FromRoleId;
            claim.UpdatedDate = DateTime.UtcNow;

            await SaveDecisionAsync(
                claimId,
                actingUserId,
                actingRoleId,
                ClaimDecisionConstants.RequestInfo,
                request.Reason);

            await _auditLogService.LogAsync(
                actingUserId,
                "Claim.InfoRequested",
                "Claim",
                claimId,
                null,
                new { claim.InfoRequestReason, claim.InfoRequestedFromRoleId });

            return Ok(claim.StatusId);
        }

        public async Task<ClaimDecisionResult> ClearInfoRequestAsync(
            Guid claimId,
            Guid actingUserId,
            int actingRoleId)
        {
            var claim =
                await _context.Claims
                    .FirstOrDefaultAsync(x => x.ClaimId == claimId);

            if (claim == null)
            {
                return Fail("Claim not found.");
            }

            if (claim.InfoRequestReason == null)
            {
                return Fail("This claim has no open information request.");
            }

            claim.InfoRequestReason = null;
            claim.InfoRequestedDate = null;
            claim.InfoRequestedFromRoleId = null;
            claim.UpdatedDate = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            await _auditLogService.LogAsync(
                actingUserId,
                "Claim.InfoRequestCleared",
                "Claim",
                claimId,
                null,
                null);

            return Ok(claim.StatusId);
        }

        // Shared write path for the 4 actions above - one ClaimDecisions
        // row + SaveChangesAsync, mirroring the exact shape
        // RecordDirectApproverDecisionAsync already writes.
        private async Task SaveDecisionAsync(
            Guid claimId,
            Guid actingUserId,
            int actingRoleId,
            int decision,
            string reasoning)
        {
            _context.ClaimDecisions.Add(
                new ClaimDecision
                {
                    ClaimDecisionId = Guid.NewGuid(),
                    ClaimId = claimId,
                    DecidedBy = actingUserId,
                    RoleId = actingRoleId,
                    Decision = decision,
                    Reasoning = reasoning,
                    DecisionDate = DateTime.UtcNow
                });

            await _context.SaveChangesAsync();
        }

        private static ClaimDecisionResult Ok(int? statusId)
        {
            return new ClaimDecisionResult
            {
                Success = true,
                Escalated = false,
                UpdatedClaimStatusId = statusId
            };
        }

        // Shared by both approver-decision entry points above. A missing
        // AuthorityLimits row for the Approver role is treated the same
        // conservative way the Surveyor path already treats a missing row
        // (block rather than assume unrestricted) - an Admin must
        // configure a real limit before Approver-role approvals can
        // proceed. Admin callers bypass this entirely, matching this
        // codebase's existing "Admin is a superuser" convention used
        // everywhere else (document access, claim access, survey access).
        private async Task<(bool Allowed, string? Reason)> CheckApproverAuthorityAsync(
            Guid claimId,
            decimal amount,
            int decidedByRoleId = RoleConstants.ApproverId)
        {
            if (decidedByRoleId == RoleConstants.AdminId)
            {
                return (true, null);
            }

            var authorityLimit =
                await _context.AuthorityLimits
                    .FirstOrDefaultAsync(
                        x => x.RoleId == RoleConstants.ApproverId);

            if (authorityLimit == null)
            {
                return (
                    false,
                    "No spend/risk authority limit is configured for the Approver role yet. " +
                        "An Admin must configure one before approvals can proceed.");
            }

            if (authorityLimit.MaxApprovalAmount.HasValue &&
                amount > authorityLimit.MaxApprovalAmount.Value)
            {
                return (
                    false,
                    $"This claim's amount (₹{amount:N2}) exceeds the Approver role's " +
                        $"configured limit of ₹{authorityLimit.MaxApprovalAmount.Value:N2}. " +
                        "An Admin can approve this instead.");
            }

            if (authorityLimit.MaxRiskScore.HasValue)
            {
                var composite =
                    await _claimScoringService.GetInternalScoringAsync(
                        claimId);

                if (composite != null &&
                    composite.CompositeScore > authorityLimit.MaxRiskScore.Value)
                {
                    return (
                        false,
                        $"This claim's risk score ({composite.CompositeScore}) exceeds the " +
                            $"Approver role's configured maximum of {authorityLimit.MaxRiskScore.Value}. " +
                            "An Admin can approve this instead.");
                }
            }

            return (true, null);
        }

        // =========================================================
        // LATEST / HISTORY
        // =========================================================

        public async Task<ClaimDecisionResponseDto?> GetLatestDecisionAsync(
            Guid claimId)
        {
            var claim =
                await _context.Claims
                    .FirstOrDefaultAsync(
                        x => x.ClaimId == claimId);

            var latest =
                await _context.ClaimDecisions
                    .Where(x => x.ClaimId == claimId)
                    .OrderByDescending(x => x.DecisionDate)
                    .FirstOrDefaultAsync();

            if (latest == null)
            {
                return null;
            }

            var isOpen =
                claim != null &&
                latest.RoleId == RoleConstants.SurveyorId &&
                MakerCheckerDecisionIds.Contains(latest.Decision) &&
                claim.StatusId == ClaimStatusConstants.SurveyCompleted;

            return await MapToDtoAsync(latest, isOpen);
        }

        public async Task<IEnumerable<ClaimDecisionResponseDto>> GetHistoryAsync(
            Guid claimId)
        {
            var claim =
                await _context.Claims
                    .FirstOrDefaultAsync(
                        x => x.ClaimId == claimId);

            var decisions =
                await _context.ClaimDecisions
                    .Where(x => x.ClaimId == claimId)
                    .OrderByDescending(x => x.DecisionDate)
                    .ToListAsync();

            var result = new List<ClaimDecisionResponseDto>();

            for (var i = 0; i < decisions.Count; i++)
            {
                var decision = decisions[i];

                var isOpen =
                    i == 0 &&
                    claim != null &&
                    decision.RoleId == RoleConstants.SurveyorId &&
                    MakerCheckerDecisionIds.Contains(decision.Decision) &&
                    claim.StatusId == ClaimStatusConstants.SurveyCompleted;

                result.Add(
                    await MapToDtoAsync(decision, isOpen));
            }

            return result;
        }

        // =========================================================
        // MY QUEUE
        // =========================================================

        public async Task<IEnumerable<ClaimQueueItemResponseDto>> GetMyQueueAsync(
            Guid userId,
            int roleId)
        {
            var result = new List<ClaimQueueItemResponseDto>();

            var candidateClaims =
                await _context.Claims
                    .Where(x => x.StatusId == ClaimStatusConstants.SurveyCompleted)
                    .ToListAsync();

            // =====================================================
            // AWAITING SURVEY (Phase 13 - assigned but the Survey &
            // Assessment screen hasn't been completed yet; the moment it
            // is, Claim.StatusId moves to SurveyCompleted and the claim
            // falls into the "AWAITING SURVEYOR DECISION" bucket below,
            // so these two are mutually exclusive by construction).
            // =====================================================

            if (roleId == RoleConstants.SurveyorId ||
                roleId == RoleConstants.AdminId)
            {
                var awaitingSurveyClaims =
                    await _context.Claims
                        .Where(x => x.StatusId == ClaimStatusConstants.SurveyAssigned)
                        .ToListAsync();

                var relevantAssignments =
                    await _context.SurveyAssignments
                        .Where(
                            x =>
                                (roleId != RoleConstants.SurveyorId ||
                                 x.SurveyorId == userId) &&
                                awaitingSurveyClaims.Select(c => c.ClaimId).Contains(x.ClaimId))
                        .ToListAsync();

                var assignmentByClaimId =
                    relevantAssignments
                        .GroupBy(x => x.ClaimId)
                        .ToDictionary(
                            g => g.Key,
                            g => g.OrderByDescending(x => x.AssignedDate).First());

                var customerNamesA =
                    await GetCustomerNamesAsync(
                        awaitingSurveyClaims.Select(c => c.CustomerId));

                foreach (var claim in awaitingSurveyClaims)
                {
                    if (!assignmentByClaimId.TryGetValue(claim.ClaimId, out var assignment))
                    {
                        continue;
                    }

                    result.Add(
                        new ClaimQueueItemResponseDto
                        {
                            ClaimId = claim.ClaimId,
                            ClaimNumber = claim.ClaimNumber,
                            StatusId = claim.StatusId ?? 0,
                            EstimatedLossAmount = claim.EstimatedLossAmount,
                            QueueReason = "AwaitingSurvey",
                            RelevantDate = assignment.AssignedDate,
                            CustomerName = customerNamesA.GetValueOrDefault(claim.CustomerId)
                        });
                }
            }

            // =====================================================
            // AWAITING SURVEYOR DECISION
            // =====================================================

            if (roleId == RoleConstants.SurveyorId ||
                roleId == RoleConstants.AdminId)
            {
                List<Guid>? assignedClaimIds = null;

                if (roleId == RoleConstants.SurveyorId)
                {
                    assignedClaimIds =
                        await _context.SurveyAssignments
                            .Where(x => x.SurveyorId == userId)
                            .Select(x => x.ClaimId)
                            .Distinct()
                            .ToListAsync();
                }

                var decidedClaimIds =
                    await _context.ClaimDecisions
                        .Where(x => MakerCheckerDecisionIds.Contains(x.Decision))
                        .Select(x => x.ClaimId)
                        .Distinct()
                        .ToListAsync();

                var eligibleClaims =
                    candidateClaims
                        .Where(c => !decidedClaimIds.Contains(c.ClaimId))
                        .Where(
                            c =>
                                assignedClaimIds == null ||
                                assignedClaimIds.Contains(c.ClaimId))
                        .ToList();

                var latestReports =
                    await _context.SurveyReports
                        .Where(x => eligibleClaims.Select(c => c.ClaimId).Contains(x.ClaimId))
                        .ToListAsync();

                var latestReportByClaimId =
                    latestReports
                        .GroupBy(x => x.ClaimId)
                        .ToDictionary(
                            g => g.Key,
                            g => g.OrderByDescending(x => x.UpdatedDate ?? x.CreatedDate).First());

                var customerNamesB =
                    await GetCustomerNamesAsync(eligibleClaims.Select(c => c.CustomerId));

                foreach (var claim in eligibleClaims)
                {
                    latestReportByClaimId.TryGetValue(claim.ClaimId, out var report);

                    result.Add(
                        new ClaimQueueItemResponseDto
                        {
                            ClaimId = claim.ClaimId,
                            ClaimNumber = claim.ClaimNumber,
                            StatusId = claim.StatusId ?? 0,
                            EstimatedLossAmount = claim.EstimatedLossAmount,
                            QueueReason = "AwaitingSurveyorDecision",
                            RelevantDate = report?.UpdatedDate ?? report?.CreatedDate,
                            CustomerName = customerNamesB.GetValueOrDefault(claim.CustomerId)
                        });
                }
            }

            // =====================================================
            // AWAITING APPROVER DECISION
            // =====================================================

            if (roleId == RoleConstants.ApproverId ||
                roleId == RoleConstants.AdminId)
            {
                var customerNamesC =
                    await GetCustomerNamesAsync(candidateClaims.Select(c => c.CustomerId));

                foreach (var claim in candidateClaims)
                {
                    var latestDecision =
                        await _context.ClaimDecisions
                            .Where(x => x.ClaimId == claim.ClaimId && MakerCheckerDecisionIds.Contains(x.Decision))
                            .OrderByDescending(x => x.DecisionDate)
                            .FirstOrDefaultAsync();

                    if (latestDecision == null ||
                        latestDecision.RoleId != RoleConstants.SurveyorId)
                    {
                        continue;
                    }

                    result.Add(
                        new ClaimQueueItemResponseDto
                        {
                            ClaimId = claim.ClaimId,
                            ClaimNumber = claim.ClaimNumber,
                            StatusId = claim.StatusId ?? 0,
                            EstimatedLossAmount = claim.EstimatedLossAmount,
                            QueueReason = "AwaitingApproverDecision",
                            PendingDecisionId = latestDecision.ClaimDecisionId,
                            RelevantDate = latestDecision.DecisionDate,
                            CustomerName = customerNamesC.GetValueOrDefault(claim.CustomerId)
                        });
                }
            }

            // =====================================================
            // INFO REQUESTED (Checkpoint 5 / Module 5) - non-blocking,
            // can apply at any non-Closed status, so this is queried
            // independently of the SurveyCompleted-scoped candidateClaims
            // list above.
            // =====================================================

            if (roleId == RoleConstants.SurveyorId ||
                roleId == RoleConstants.AdminId)
            {
                var infoRequestedClaims =
                    await _context.Claims
                        .Where(
                            x =>
                                x.InfoRequestReason != null &&
                                x.StatusId != ClaimStatusConstants.Closed)
                        .ToListAsync();

                if (roleId == RoleConstants.SurveyorId)
                {
                    var myAssignedClaimIds =
                        await _context.SurveyAssignments
                            .Where(x => x.SurveyorId == userId)
                            .Select(x => x.ClaimId)
                            .Distinct()
                            .ToListAsync();

                    infoRequestedClaims =
                        infoRequestedClaims
                            .Where(c => myAssignedClaimIds.Contains(c.ClaimId))
                            .ToList();
                }

                var customerNamesD =
                    await GetCustomerNamesAsync(
                        infoRequestedClaims.Select(c => c.CustomerId));

                foreach (var claim in infoRequestedClaims)
                {
                    result.Add(
                        new ClaimQueueItemResponseDto
                        {
                            ClaimId = claim.ClaimId,
                            ClaimNumber = claim.ClaimNumber,
                            StatusId = claim.StatusId ?? 0,
                            EstimatedLossAmount = claim.EstimatedLossAmount,
                            QueueReason = "InfoRequested",
                            RelevantDate = claim.InfoRequestedDate,
                            CustomerName = customerNamesD.GetValueOrDefault(claim.CustomerId)
                        });
                }
            }

            return result;
        }

        // Batched Customer -> User display-name lookup, avoiding an N+1
        // query per queue row.
        private async Task<Dictionary<Guid, string>> GetCustomerNamesAsync(
            IEnumerable<Guid> customerIds)
        {
            var ids = customerIds.Distinct().ToList();

            var customers =
                await _context.Customers
                    .Where(x => ids.Contains(x.CustomerId))
                    .ToListAsync();

            var userIds = customers.Select(c => c.UserId).Distinct().ToList();

            var users =
                await _context.Users
                    .Where(x => userIds.Contains(x.UserId))
                    .ToDictionaryAsync(x => x.UserId);

            return customers.ToDictionary(
                c => c.CustomerId,
                c => users.TryGetValue(c.UserId, out var user)
                    ? GetUserDisplayName(user)
                    : "Unknown");
        }

        // =========================================================
        // MAPPING / HELPERS
        // =========================================================

        private async Task<ClaimDecisionResponseDto> MapToDtoAsync(
            ClaimDecision decision,
            bool escalated)
        {
            var user =
                await _context.Users
                    .FirstOrDefaultAsync(
                        x => x.UserId == decision.DecidedBy);

            return new ClaimDecisionResponseDto
            {
                ClaimDecisionId = decision.ClaimDecisionId,
                ClaimId = decision.ClaimId,
                DecidedBy = decision.DecidedBy,
                DecidedByName = GetUserDisplayName(user),
                RoleId = decision.RoleId,
                RoleName = GetRoleName(decision.RoleId),
                Decision = decision.Decision,
                DecisionName = GetDecisionName(decision.Decision),
                Reasoning = decision.Reasoning,
                AiScoresSnapshot = decision.AiScoresSnapshot,
                DecisionDate = decision.DecisionDate,
                Escalated = escalated
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

        private static string GetRoleName(
            int roleId)
        {
            return roleId switch
            {
                RoleConstants.CustomerId => RoleConstants.Customer,
                RoleConstants.RepairerId => RoleConstants.Repairer,
                RoleConstants.SurveyorId => RoleConstants.Surveyor,
                RoleConstants.ApproverId => RoleConstants.Approver,
                RoleConstants.AdminId => RoleConstants.Admin,
                _ => "Unknown"
            };
        }

        private static string GetDecisionName(
            int decision)
        {
            return decision switch
            {
                ClaimDecisionConstants.Approve => "Approve",
                ClaimDecisionConstants.Review => "Review",
                ClaimDecisionConstants.Deny => "Deny",
                ClaimDecisionConstants.Hold => "Hold",
                ClaimDecisionConstants.Resume => "Resume",
                ClaimDecisionConstants.ReturnForRework => "Return for Rework",
                ClaimDecisionConstants.RequestInfo => "Request Additional Information",
                _ => "Unknown"
            };
        }

        private static ClaimDecisionResult Fail(
            string message)
        {
            return new ClaimDecisionResult
            {
                Success = false,
                ErrorMessage = message
            };
        }
    }
}