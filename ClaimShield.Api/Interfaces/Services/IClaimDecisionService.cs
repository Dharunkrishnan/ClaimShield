using ClaimShield.Api.Models.DTOs.ClaimDecisions;

namespace ClaimShield.Api.Interfaces.Services
{
    public interface IClaimDecisionService
    {
        Task<ClaimDecisionResponseDto?> GetLatestDecisionAsync(
            Guid claimId);

        Task<IEnumerable<ClaimDecisionResponseDto>> GetHistoryAsync(
            Guid claimId);

        Task<IEnumerable<ClaimQueueItemResponseDto>> GetMyQueueAsync(
            Guid userId,
            int roleId);

        Task<ClaimDecisionResult> RecordSurveyorDecisionAsync(
            Guid claimId,
            Guid surveyorId,
            SurveyorDecisionRequest request);

        Task<ClaimDecisionResult> RecordApproverDecisionAsync(
            Guid claimId,
            Guid approverId,
            int decidedByRoleId,
            ApproverDecisionRequest request);

        // Phase 14 reconciliation - the ONE other place an Approver/Admin
        // can finalize a claim, outside the survey-escalation flow (direct
        // approve/reject via ClaimApprovalController, and as a side effect
        // of repair-estimate approval). Writes the same ClaimDecisions
        // history and applies the same AuthorityLimits enforcement as
        // RecordApproverDecisionAsync, rather than being a silent,
        // unaudited, unchecked second writer.
        //
        // requireRepairInProgress (Phase 16): when true, an Approve is
        // only allowed once the claim has genuinely passed through
        // RepairInProgress (the Repairer has accepted/started the work) -
        // used by the repair-estimate-approval path so a claim can no
        // longer jump straight from "just assigned" to "financially
        // approved". The generic ClaimApprovalController path passes
        // false, unchanged from Phase 14.
        Task<ClaimDecisionResult> RecordDirectApproverDecisionAsync(
            Guid claimId,
            Guid decidedBy,
            int decidedByRoleId,
            int decision,
            string reasoning,
            decimal? approvedAmount,
            bool requireRepairInProgress = false);

        // =========================================================
        // Checkpoint 5 (Module 5) - On Hold / Resume, Return for
        // Rework, Request Additional Information. All recorded
        // through this same service/ClaimDecisions table - the same
        // canonical decision path as everything above, not a new
        // parallel writer.
        // =========================================================

        Task<ClaimDecisionResult> PutOnHoldAsync(
            Guid claimId,
            Guid actingUserId,
            int actingRoleId,
            HoldClaimRequest request);

        Task<ClaimDecisionResult> ResumeAsync(
            Guid claimId,
            Guid actingUserId,
            int actingRoleId);

        Task<ClaimDecisionResult> ReturnForReworkAsync(
            Guid claimId,
            Guid actingUserId,
            int actingRoleId,
            ReturnForReworkRequest request);

        Task<ClaimDecisionResult> RequestAdditionalInfoAsync(
            Guid claimId,
            Guid actingUserId,
            int actingRoleId,
            RequestAdditionalInfoRequest request);

        Task<ClaimDecisionResult> ClearInfoRequestAsync(
            Guid claimId,
            Guid actingUserId,
            int actingRoleId);
    }
}
