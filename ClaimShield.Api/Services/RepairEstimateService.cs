using ClaimShield.Api.Constants;
using ClaimShield.Api.Interfaces.Repositories;
using ClaimShield.Api.Interfaces.Services;
using ClaimShield.Api.Models.DTOs.RepairEstimates;
using ClaimShield.Api.Models.Entities;

namespace ClaimShield.Api.Services
{
    public class RepairEstimateService : IRepairEstimateService
    {
        private readonly IRepairEstimateRepository _repairEstimateRepository;
        private readonly IClaimDecisionService _claimDecisionService;
        private readonly IAuditLogService _auditLogService;
        private readonly IClaimSettlementService _claimSettlementService;

        public RepairEstimateService(
            IRepairEstimateRepository repairEstimateRepository,
            IClaimDecisionService claimDecisionService,
            IAuditLogService auditLogService,
            IClaimSettlementService claimSettlementService)
        {
            _repairEstimateRepository = repairEstimateRepository;
            _claimDecisionService = claimDecisionService;
            _auditLogService = auditLogService;
            _claimSettlementService = claimSettlementService;
        }

        // =========================================================
        // GET ALL
        // =========================================================

        public async Task<IEnumerable<RepairEstimateResponseDto>> GetAllAsync()
        {
            var estimates =
                await _repairEstimateRepository.GetAllAsync();

            return estimates.Select(MapToDto);
        }

        // =========================================================
        // GET BY ID
        // =========================================================

        public async Task<RepairEstimateResponseDto?> GetByIdAsync(
            Guid repairEstimateId)
        {
            var estimate =
                await _repairEstimateRepository.GetByIdAsync(
                    repairEstimateId);

            if (estimate == null)
            {
                return null;
            }

            return MapToDto(estimate);
        }

        // =========================================================
        // GET BY CLAIM
        // =========================================================

        public async Task<IEnumerable<RepairEstimateResponseDto>> GetByClaimAsync(
            Guid claimId)
        {
            var estimates =
                await _repairEstimateRepository.GetByClaimAsync(
                    claimId);

            return estimates.Select(MapToDto);
        }

        // =========================================================
        // GET BY REPAIR ASSIGNMENT
        // =========================================================

        public async Task<IEnumerable<RepairEstimateResponseDto>> GetByAssignmentAsync(
            Guid repairAssignmentId)
        {
            var estimates =
                await _repairEstimateRepository.GetByAssignmentAsync(
                    repairAssignmentId);

            return estimates.Select(MapToDto);
        }

        // =========================================================
        // CREATE
        // =========================================================

        public async Task<RepairEstimateResponseDto> CreateAsync(
            CreateRepairEstimateRequest request)
        {
            var repairEstimate = new RepairEstimate
            {
                RepairEstimateId = Guid.NewGuid(),

                RepairAssignmentId =
                    request.RepairAssignmentId,

                ClaimId =
                    request.ClaimId,

                EstimatedAmount =
                    request.EstimatedAmount,

                EstimatedCompletionDays =
                    request.EstimatedCompletionDays,

                EstimateRemarks =
                    request.EstimateRemarks,

                SubmittedDate =
                    request.SubmittedDate ?? DateTime.UtcNow,

                ApprovedAmount = null,

                ApprovalDate = null,

                CreatedDate = DateTime.UtcNow
            };

            await _repairEstimateRepository.AddAsync(
                repairEstimate);

            return MapToDto(repairEstimate);
        }

        // =========================================================
        // UPDATE
        // =========================================================

        public async Task<bool> UpdateAsync(
            UpdateRepairEstimateRequest request)
        {
            var repairEstimate =
                await _repairEstimateRepository.GetByIdAsync(
                    request.RepairEstimateId);

            if (repairEstimate == null)
            {
                return false;
            }

            repairEstimate.RepairAssignmentId =
                request.RepairAssignmentId;

            repairEstimate.ClaimId =
                request.ClaimId;

            repairEstimate.EstimatedAmount =
                request.EstimatedAmount;

            repairEstimate.EstimatedCompletionDays =
                request.EstimatedCompletionDays;

            repairEstimate.EstimateRemarks =
                request.EstimateRemarks;

            repairEstimate.SubmittedDate =
                request.SubmittedDate;

            await _repairEstimateRepository.UpdateAsync(
                repairEstimate);

            return true;
        }

        // =========================================================
        // APPROVE
        //
        // Auto-advances the claim itself (via IClaimDecisionService's
        // canonical direct-decision path - Phase 14 reconciliation)
        // in the same step, mirroring how completing a Payment already
        // auto-settles the claim. The claim-level decision is applied
        // FIRST: if it's blocked by AuthorityLimits, the repair estimate
        // itself is left untouched (still pending) rather than ending up
        // approved-on-the-estimate-but-not-on-the-claim.
        // =========================================================

        public async Task<bool> ApproveAsync(
            Guid repairEstimateId,
            Guid approvedBy,
            int approvedByRoleId,
            ApproveRepairEstimateRequest request)
        {
            var repairEstimate =
                await _repairEstimateRepository.GetByIdAsync(
                    repairEstimateId);

            if (repairEstimate == null)
            {
                return false;
            }

            var claimDecision =
                await _claimDecisionService.RecordDirectApproverDecisionAsync(
                    repairEstimate.ClaimId,
                    approvedBy,
                    approvedByRoleId,
                    ClaimDecisionConstants.Approve,
                    request.Remarks ?? "Approved via repair estimate approval.",
                    request.ApprovedAmount,
                    requireRepairInProgress: true);

            if (!claimDecision.Success)
            {
                throw new InvalidOperationException(claimDecision.ErrorMessage);
            }

            repairEstimate.ApprovedAmount =
                request.ApprovedAmount;

            repairEstimate.ApprovalDate =
                DateTime.UtcNow;

            repairEstimate.ApprovalStatusId =
                RepairEstimateApprovalStatusConstants.Approved;

            repairEstimate.ApprovalRemarks =
                request.Remarks;

            await _repairEstimateRepository.UpdateAsync(
                repairEstimate);

            await _auditLogService.LogAsync(
                approvedBy,
                "RepairEstimate.Approved",
                "RepairEstimate",
                repairEstimateId,
                null,
                new
                {
                    repairEstimate.ApprovedAmount,
                    repairEstimate.ApprovalRemarks,
                    ClaimApproved = true
                });

            // The repair estimate is now persisted as Approved (above),
            // so this is the earliest point a Settlement computation can
            // actually see it - triggering it any earlier (e.g. from
            // inside RecordDirectApproverDecisionAsync) would read the
            // estimate as still pending. Never let a settlement-computation
            // hiccup fail the approval that already succeeded.
            try
            {
                await _claimSettlementService.ComputeAsync(repairEstimate.ClaimId);
            }
            catch
            {
                // Intentionally swallowed - settlement can be recomputed
                // manually via ClaimSettlementsController if this fails.
            }

            return true;
        }

        // =========================================================
        // REJECT
        //
        // Does not touch Claim.StatusId - the Repairer can submit a
        // fresh estimate against the same assignment.
        // =========================================================

        public async Task<bool> RejectAsync(
            Guid repairEstimateId,
            Guid rejectedBy,
            RejectRepairEstimateRequest request)
        {
            var repairEstimate =
                await _repairEstimateRepository.GetByIdAsync(
                    repairEstimateId);

            if (repairEstimate == null)
            {
                return false;
            }

            repairEstimate.ApprovalDate =
                DateTime.UtcNow;

            repairEstimate.ApprovalStatusId =
                RepairEstimateApprovalStatusConstants.Rejected;

            repairEstimate.ApprovalRemarks =
                request.Remarks;

            await _repairEstimateRepository.UpdateAsync(
                repairEstimate);

            await _auditLogService.LogAsync(
                rejectedBy,
                "RepairEstimate.Rejected",
                "RepairEstimate",
                repairEstimateId,
                null,
                new
                {
                    repairEstimate.ApprovalRemarks
                });

            return true;
        }

        // =========================================================
        // DELETE
        // =========================================================

        public async Task<bool> DeleteAsync(
            Guid repairEstimateId)
        {
            var repairEstimate =
                await _repairEstimateRepository.GetByIdAsync(
                    repairEstimateId);

            if (repairEstimate == null)
            {
                return false;
            }

            await _repairEstimateRepository.DeleteAsync(
                repairEstimateId);

            return true;
        }

        // =========================================================
        // MAPPING
        // =========================================================

        private static RepairEstimateResponseDto MapToDto(
            RepairEstimate repairEstimate)
        {
            return new RepairEstimateResponseDto
            {
                RepairEstimateId =
                    repairEstimate.RepairEstimateId,

                RepairAssignmentId =
                    repairEstimate.RepairAssignmentId,

                ClaimId =
                    repairEstimate.ClaimId,

                EstimatedAmount =
                    repairEstimate.EstimatedAmount,

                EstimatedCompletionDays =
                    repairEstimate.EstimatedCompletionDays,

                EstimateRemarks =
                    repairEstimate.EstimateRemarks,

                SubmittedDate =
                    repairEstimate.SubmittedDate,

                ApprovedAmount =
                    repairEstimate.ApprovedAmount,

                ApprovalDate =
                    repairEstimate.ApprovalDate,

                ApprovalStatusId =
                    repairEstimate.ApprovalStatusId,

                ApprovalStatus =
                    GetApprovalStatusName(
                        repairEstimate.ApprovalStatusId),

                ApprovalRemarks =
                    repairEstimate.ApprovalRemarks,

                CreatedDate =
                    repairEstimate.CreatedDate
            };
        }

        private static string? GetApprovalStatusName(
            int? approvalStatusId)
        {
            return approvalStatusId switch
            {
                null => "Pending",
                RepairEstimateApprovalStatusConstants.Approved => "Approved",
                RepairEstimateApprovalStatusConstants.Rejected => "Rejected",
                _ => "Unknown"
            };
        }
    }
}