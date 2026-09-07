using ClaimShield.Api.Constants;
using ClaimShield.Api.Data.Context;
using ClaimShield.Api.Interfaces.Repositories;
using ClaimShield.Api.Interfaces.Services;
using ClaimShield.Api.Models.DTOs.SurveyReports;
using ClaimShield.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using System.Linq;

namespace ClaimShield.Api.Services
{
    public class SurveyReportService : ISurveyReportService
    {
        private readonly ISurveyReportRepository _surveyReportRepository;
        private readonly IClaimScoringService _claimScoringService;

        // Only used by the new Phase 13 assessment methods below - the
        // original 8 methods above stay on the plain repository, exactly
        // as before. The atomic cross-entity writes SaveDraftAsync/
        // CompleteAssessmentAsync need (SurveyReport + DamageAssessmentItems,
        // or SurveyReport + Claim + SurveyAssignment together) don't fit the
        // repository's one-SaveChangesAsync-per-call design, so they go
        // through the context directly - same mixed-DI convention already
        // used by ClaimDecisionService/EstimateEngineService.
        private readonly ClaimShieldDbContext _context;
        private readonly IAuditLogService _auditLogService;
        private readonly IUserRepository _userRepository;

        public SurveyReportService(
            ISurveyReportRepository surveyReportRepository,
            IClaimScoringService claimScoringService,
            ClaimShieldDbContext context,
            IAuditLogService auditLogService,
            IUserRepository userRepository)
        {
            _surveyReportRepository = surveyReportRepository;
            _claimScoringService = claimScoringService;
            _context = context;
            _auditLogService = auditLogService;
            _userRepository = userRepository;
        }

        // -----------------------------------------------------
        // Stage 2 (Survey) scoring - fires on both initial
        // submission and every resubmission/revision. Must never
        // block the survey report action if the rule engine
        // hiccups; see ClaimService.CreateClaimAsync for the same
        // fail-safe reasoning on Stage 1.
        // -----------------------------------------------------

        private async Task TriggerStage2ScoringAsync(
            Guid claimId)
        {
            try
            {
                await _claimScoringService.ScoreStageAsync(
                    claimId,
                    ScoringStageConstants.Stage2_Survey);
            }
            catch
            {
                // Intentionally swallowed - see comment above.
            }
        }

        public async Task<IEnumerable<SurveyReportResponseDto>> GetAllAsync()
        {
            var reports = await _surveyReportRepository.GetAllAsync();

            return reports.Select(MapToDto);
        }

        public async Task<SurveyReportResponseDto?> GetByIdAsync(
            Guid surveyReportId)
        {
            var report =
                await _surveyReportRepository.GetByIdAsync(surveyReportId);

            if (report == null)
                return null;

            return MapToDto(report);
        }

        public async Task<IEnumerable<SurveyReportResponseDto>> GetByClaimAsync(
            Guid claimId)
        {
            var reports =
                await _surveyReportRepository.GetByClaimAsync(claimId);

            return reports.Select(MapToDto);
        }

        public async Task<IEnumerable<SurveyReportResponseDto>> GetByAssignmentAsync(
            Guid surveyAssignmentId)
        {
            var reports =
                await _surveyReportRepository.GetByAssignmentAsync(
                    surveyAssignmentId);

            return reports.Select(MapToDto);
        }

        public async Task<IEnumerable<SurveyReportResponseDto>> GetBySurveyorAsync(
            Guid surveyorId)
        {
            var reports =
                await _surveyReportRepository.GetBySurveyorAsync(surveyorId);

            return reports.Select(MapToDto);
        }

        public async Task<SurveyReportResponseDto> CreateAsync(
            CreateSurveyReportRequest request)
        {
            var surveyReport = new SurveyReport
            {
                SurveyReportId = Guid.NewGuid(),

                SurveyAssignmentId = request.SurveyAssignmentId,

                ClaimId = request.ClaimId,

                SurveyorId = request.SurveyorId,

                InspectionDate = request.InspectionDate,

                OdometerReading = request.OdometerReading,

                DamageTypeId = request.DamageTypeId,

                DamageDescription = request.DamageDescription,

                EstimatedRepairCost = request.EstimatedRepairCost,

                TotalLoss = request.TotalLoss ?? false,

                SurveyRemarks = request.SurveyRemarks,

                CreatedDate = DateTime.UtcNow
            };

            await _surveyReportRepository.AddAsync(surveyReport);

            await TriggerStage2ScoringAsync(
                surveyReport.ClaimId);

            return MapToDto(surveyReport);
        }

        public async Task<bool> UpdateAsync(
            UpdateSurveyReportRequest request)
        {
            var surveyReport =
                await _surveyReportRepository.GetByIdAsync(
                    request.SurveyReportId);

            if (surveyReport == null)
                return false;

            surveyReport.SurveyAssignmentId =
                request.SurveyAssignmentId;

            surveyReport.ClaimId =
                request.ClaimId;

            surveyReport.SurveyorId =
                request.SurveyorId;

            surveyReport.InspectionDate =
                request.InspectionDate;

            surveyReport.OdometerReading =
                request.OdometerReading;

            surveyReport.DamageTypeId =
                request.DamageTypeId;

            surveyReport.DamageDescription =
                request.DamageDescription;

            surveyReport.EstimatedRepairCost =
                request.EstimatedRepairCost;

            surveyReport.TotalLoss =
                request.TotalLoss;

            surveyReport.SurveyRemarks =
                request.SurveyRemarks;

            surveyReport.UpdatedDate =
                DateTime.UtcNow;

            await _surveyReportRepository.UpdateAsync(surveyReport);

            await TriggerStage2ScoringAsync(
                surveyReport.ClaimId);

            return true;
        }

        public async Task<bool> DeleteAsync(Guid surveyReportId)
        {
            var surveyReport =
                await _surveyReportRepository.GetByIdAsync(
                    surveyReportId);

            if (surveyReport == null)
                return false;

            await _surveyReportRepository.DeleteAsync(surveyReportId);

            return true;
        }

        private static SurveyReportResponseDto MapToDto(
            SurveyReport surveyReport)
        {
            return new SurveyReportResponseDto
            {
                SurveyReportId =
                    surveyReport.SurveyReportId,

                SurveyAssignmentId =
                    surveyReport.SurveyAssignmentId,

                ClaimId =
                    surveyReport.ClaimId,

                SurveyorId =
                    surveyReport.SurveyorId,

                InspectionDate =
                    surveyReport.InspectionDate,

                OdometerReading =
                    surveyReport.OdometerReading,

                DamageTypeId =
                    surveyReport.DamageTypeId,

                DamageDescription =
                    surveyReport.DamageDescription,

                EstimatedRepairCost =
                    surveyReport.EstimatedRepairCost,

                TotalLoss =
                    surveyReport.TotalLoss,

                SurveyRemarks =
                    surveyReport.SurveyRemarks,

                CreatedDate =
                    surveyReport.CreatedDate,

                UpdatedDate =
                    surveyReport.UpdatedDate
            };
        }

        // =====================================================
        // Phase 13 - Surveyor Survey & Assessment screen
        // =====================================================

        public async Task<SurveyAssessmentResponseDto?> GetAssessmentByClaimAsync(
            Guid claimId)
        {
            var report =
                await _context.SurveyReports
                    .Where(x => x.ClaimId == claimId)
                    .OrderByDescending(x => x.CreatedDate)
                    .FirstOrDefaultAsync();

            if (report == null)
            {
                return null;
            }

            return await MapToAssessmentDtoAsync(report);
        }

        public async Task<SurveyAssessmentResponseDto> SaveDraftAsync(
            Guid surveyorId,
            SaveSurveyAssessmentRequest request)
        {
            var report =
                await _context.SurveyReports
                    .FirstOrDefaultAsync(
                        x => x.SurveyAssignmentId == request.SurveyAssignmentId);

            if (report == null)
            {
                report = new SurveyReport
                {
                    SurveyReportId = Guid.NewGuid(),
                    SurveyAssignmentId = request.SurveyAssignmentId,
                    ClaimId = request.ClaimId,
                    SurveyorId = surveyorId,
                    AssessmentStatusId = AssessmentStatusConstants.Assigned,
                    CreatedDate = DateTime.UtcNow
                };

                _context.SurveyReports.Add(report);
            }
            else if (report.AssessmentStatusId == AssessmentStatusConstants.SubmittedForReview)
            {
                throw new InvalidOperationException(
                    "This assessment has already been submitted for review and can no longer be edited.");
            }

            report.InspectionDate = request.InspectionDate;
            report.SurveyLocation = request.SurveyLocation;
            report.SurveyRemarks = request.SurveyRemarks;

            if (request.AssessmentStatusId.HasValue &&
                request.AssessmentStatusId.Value >= AssessmentStatusConstants.Assigned &&
                request.AssessmentStatusId.Value < AssessmentStatusConstants.SubmittedForReview)
            {
                report.AssessmentStatusId = request.AssessmentStatusId.Value;
            }

            report.VehicleConditionId = request.VehicleConditionId;
            report.OdometerReading = request.OdometerReading;
            report.PreExistingDamageNotes = request.PreExistingDamageNotes;
            report.SurveyorFlaggedSuspicious = request.SurveyorFlaggedSuspicious;
            report.PreExistingDamageSuspected = request.PreExistingDamageSuspected;
            report.DamageTypeId = request.DamageTypeId;
            report.DamageDescription = request.DamageDescription;
            report.RepairabilityStatusId = request.RepairabilityStatusId;
            report.TotalLoss = request.TotalLoss;

            report.EstimatedRepairerName = request.EstimatedRepairerName;
            report.RepairerTypeId = request.RepairerTypeId;
            report.LabourCost = request.LabourCost;
            report.PartsCost = request.PartsCost;
            report.TowingCharges = request.TowingCharges;
            report.PaintCost = request.PaintCost;
            report.EstimatedDurationDays = request.EstimatedDurationDays;

            report.TaxAmount = request.TaxAmount;
            report.DepreciationAmount = request.DepreciationAmount;
            report.CompulsoryExcess = request.CompulsoryExcess;
            report.SalvageAmount = request.SalvageAmount;

            // Server-computed only - deterministic, mirrors
            // EstimateEngineService's own "never trust the client total"
            // principle. Sums Labour/Parts from the actual damage
            // component line items (the real source of these figures
            // since the flat LabourCost/PartsCost fields on the request
            // were retired when that per-component UI was added) -
            // matches the same formula the frontend's own preview uses,
            // so what's shown while editing matches what's actually
            // saved and read back everywhere else (Decision Support
            // Summary included). Paint/Towing are deliberately excluded
            // from this formula, matching that same redesign.
            var totalLabourAmount = request.DamageAssessmentItems.Sum(x => x.LabourAmount ?? 0);
            var totalPartsAmount = request.DamageAssessmentItems.Sum(x => x.PartsAmount ?? 0);

            report.EstimatedRepairCost = totalLabourAmount + totalPartsAmount;

            var gross = totalLabourAmount + totalPartsAmount + (request.TaxAmount ?? 0);

            var net =
                gross - (request.DepreciationAmount ?? 0) - (request.CompulsoryExcess ?? 0) -
                (request.SalvageAmount ?? 0);

            report.GrossAssessmentAmount = gross;
            report.NetAssessmentAmount = net < 0 ? 0 : net;

            report.RepairRecommended = request.RepairRecommended;
            report.ReplaceRecommended = request.ReplaceRecommended;
            report.CashSettlementRecommended = request.CashSettlementRecommended;
            report.TotalLossRecommended = request.TotalLossRecommended;
            report.OverallRecommendationId = request.OverallRecommendationId;
            report.AssessmentRemarks = request.AssessmentRemarks;

            report.UpdatedDate = DateTime.UtcNow;

            var existingItems =
                _context.DamageAssessmentItems
                    .Where(x => x.SurveyReportId == report.SurveyReportId);

            _context.DamageAssessmentItems.RemoveRange(existingItems);

            foreach (var item in request.DamageAssessmentItems)
            {
                _context.DamageAssessmentItems.Add(new DamageAssessmentItem
                {
                    DamageAssessmentItemId = Guid.NewGuid(),
                    SurveyReportId = report.SurveyReportId,
                    ComponentName = item.ComponentName,
                    DamageCategoryId = item.DamageCategoryId,
                    SeverityId = item.SeverityId,
                    RepairRequired = item.RepairRequired,
                    ReplacementRequired = item.ReplacementRequired,
                    Remarks = item.Remarks,
                    LabourAmount = item.LabourAmount,
                    PartsAmount = item.PartsAmount,
                    CreatedDate = DateTime.UtcNow
                });
            }

            await _context.SaveChangesAsync();

            await _auditLogService.LogAsync(
                surveyorId,
                "SurveyReport.DraftSaved",
                "Claim",
                report.ClaimId,
                null,
                new { report.AssessmentStatusId, report.NetAssessmentAmount });

            await TriggerStage2ScoringAsync(report.ClaimId);

            return await MapToAssessmentDtoAsync(report);
        }

        public async Task<SurveyAssessmentResponseDto> CompleteAssessmentAsync(
            Guid surveyorId,
            CompleteSurveyAssessmentRequest request)
        {
            var report =
                await _context.SurveyReports
                    .FirstOrDefaultAsync(x => x.SurveyReportId == request.SurveyReportId);

            if (report == null || report.SurveyorId != surveyorId)
            {
                throw new InvalidOperationException(
                    "Survey report not found or does not belong to you.");
            }

            var claim =
                await _context.Claims
                    .FirstOrDefaultAsync(x => x.ClaimId == report.ClaimId);

            if (claim == null)
            {
                throw new InvalidOperationException("Claim not found.");
            }

            var beforeState = new { claim.StatusId, report.AssessmentStatusId };

            report.AssessmentStatusId = AssessmentStatusConstants.SubmittedForReview;
            report.UpdatedDate = DateTime.UtcNow;

            if (claim.StatusId == null ||
                claim.StatusId.Value < ClaimStatusConstants.SurveyCompleted)
            {
                claim.StatusId = ClaimStatusConstants.SurveyCompleted;
                claim.UpdatedDate = DateTime.UtcNow;
            }

            // TAT Performance dashboard reads this - only set once, the
            // first time a report is actually submitted for this claim,
            // so a later re-submission/correction doesn't quietly shift
            // the recorded completion time.
            claim.SurveyDate ??= DateTime.UtcNow;

            // Keep the coarser SurveyAssignment.AssignmentStatusId (what
            // MockAiService's chat assistant actually reads to answer "what's
            // my survey status") in sync with the finer AssessmentStatusId,
            // so completing an assessment here doesn't leave the customer
            // chat assistant's answer stale - the same "no parallel data
            // path" principle the rest of this feature follows.
            var assignment =
                await _context.SurveyAssignments
                    .FirstOrDefaultAsync(x => x.SurveyAssignmentId == report.SurveyAssignmentId);

            if (assignment != null)
            {
                assignment.AssignmentStatusId = AssignmentStatusConstants.Completed;
                assignment.UpdatedDate = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();

            await _auditLogService.LogAsync(
                surveyorId,
                "SurveyReport.AssessmentCompleted",
                "Claim",
                claim.ClaimId,
                beforeState,
                new { claim.StatusId, report.AssessmentStatusId });

            await TriggerStage2ScoringAsync(claim.ClaimId);

            return await MapToAssessmentDtoAsync(report);
        }

        private async Task<SurveyAssessmentResponseDto> MapToAssessmentDtoAsync(
            SurveyReport report)
        {
            var items =
                await _context.DamageAssessmentItems
                    .Where(x => x.SurveyReportId == report.SurveyReportId)
                    .ToListAsync();

            var surveyor = await _userRepository.GetByIdAsync(report.SurveyorId);

            var assignment =
                await _context.SurveyAssignments
                    .FirstOrDefaultAsync(x => x.SurveyAssignmentId == report.SurveyAssignmentId);

            return new SurveyAssessmentResponseDto
            {
                SurveyReportId = report.SurveyReportId,
                SurveyAssignmentId = report.SurveyAssignmentId,
                ClaimId = report.ClaimId,
                SurveyorId = report.SurveyorId,
                SurveyorName = GetUserDisplayName(surveyor),

                InspectionDate = report.InspectionDate,
                SurveyLocation = report.SurveyLocation,
                SurveyRemarks = report.SurveyRemarks,
                SurveyTypeId = assignment?.InspectionMode,
                AssessmentStatusId = report.AssessmentStatusId,

                VehicleConditionId = report.VehicleConditionId,
                OdometerReading = report.OdometerReading,
                PreExistingDamageNotes = report.PreExistingDamageNotes,
                SurveyorFlaggedSuspicious = report.SurveyorFlaggedSuspicious,
                PreExistingDamageSuspected = report.PreExistingDamageSuspected,
                DamageTypeId = report.DamageTypeId,
                DamageDescription = report.DamageDescription,
                RepairabilityStatusId = report.RepairabilityStatusId,
                TotalLoss = report.TotalLoss,

                DamageAssessmentItems = items.Select(item => new DamageAssessmentItemResponseDto
                {
                    DamageAssessmentItemId = item.DamageAssessmentItemId,
                    ComponentName = item.ComponentName,
                    DamageCategoryId = item.DamageCategoryId,
                    SeverityId = item.SeverityId,
                    RepairRequired = item.RepairRequired,
                    ReplacementRequired = item.ReplacementRequired,
                    Remarks = item.Remarks,
                    LabourAmount = item.LabourAmount,
                    PartsAmount = item.PartsAmount
                }).ToList(),

                EstimatedRepairerName = report.EstimatedRepairerName,
                RepairerTypeId = report.RepairerTypeId,
                LabourCost = report.LabourCost,
                PartsCost = report.PartsCost,
                TowingCharges = report.TowingCharges,
                PaintCost = report.PaintCost,
                EstimatedDurationDays = report.EstimatedDurationDays,
                EstimatedRepairCost = report.EstimatedRepairCost,

                TaxAmount = report.TaxAmount,
                DepreciationAmount = report.DepreciationAmount,
                CompulsoryExcess = report.CompulsoryExcess,
                SalvageAmount = report.SalvageAmount,
                GrossAssessmentAmount = report.GrossAssessmentAmount,
                NetAssessmentAmount = report.NetAssessmentAmount,

                RepairRecommended = report.RepairRecommended,
                ReplaceRecommended = report.ReplaceRecommended,
                CashSettlementRecommended = report.CashSettlementRecommended,
                TotalLossRecommended = report.TotalLossRecommended,
                OverallRecommendationId = report.OverallRecommendationId,
                AssessmentRemarks = report.AssessmentRemarks,

                CreatedDate = report.CreatedDate,
                UpdatedDate = report.UpdatedDate
            };
        }

        private static string GetUserDisplayName(User? user)
        {
            if (user == null)
            {
                return "Unknown";
            }

            var firstName = user.FirstName?.Trim();
            var lastName = user.LastName?.Trim();

            if (!string.IsNullOrWhiteSpace(firstName) && !string.IsNullOrWhiteSpace(lastName))
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