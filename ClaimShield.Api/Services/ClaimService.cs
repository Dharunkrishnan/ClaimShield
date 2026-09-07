using ClaimShield.Api.Constants;
using ClaimShield.Api.Data.Context;
using ClaimShield.Api.Interfaces.Repositories;
using ClaimShield.Api.Interfaces.Services;
using ClaimShield.Api.Models.DTOs.Claims;
using ClaimShield.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace ClaimShield.Api.Services
{
    public class ClaimService : IClaimService
    {
        private readonly IClaimRepository _claimRepository;
        private readonly IClaimScoringService _claimScoringService;

        // Only used by GetClaimByIdAsync's Phase 13 enrichment (a single
        // ClaimIntakes lookup for the claim-type display field) - every
        // other method on this service is untouched and stays purely
        // repository-based.
        private readonly ClaimShieldDbContext _context;

        public ClaimService(
            IClaimRepository claimRepository,
            IClaimScoringService claimScoringService,
            ClaimShieldDbContext context)
        {
            _claimRepository = claimRepository;
            _claimScoringService = claimScoringService;
            _context = context;
        }

        public async Task<IEnumerable<ClaimResponseDto>> GetAllClaimsAsync()
        {
            var claims = await _claimRepository.GetAllAsync();

            return claims.Select(MapToDto);
        }

        public async Task<ClaimResponseDto?> GetClaimByIdAsync(Guid claimId)
        {
            var claim = await _claimRepository.GetByIdWithDetailsAsync(claimId);

            if (claim == null)
                return null;

            var dto = MapToDto(claim);

            dto.CustomerName = GetUserDisplayName(claim.Customer?.User);
            dto.PolicyNumber = claim.Policy?.PolicyNumber;
            dto.VehicleRegistrationNumber = claim.Vehicle?.RegistrationNumber;

            var intake = await _context.ClaimIntakes
                .FirstOrDefaultAsync(x => x.ClaimId == claimId);

            dto.LossTypeId = intake?.LossType;

            if (claim.PreferredRepairerId.HasValue)
            {
                var repairerUser =
                    await _context.Users
                        .FirstOrDefaultAsync(
                            x => x.UserId == claim.PreferredRepairerId.Value);

                dto.PreferredRepairerName = GetUserDisplayName(repairerUser);
            }

            return dto;
        }

        private static string? GetUserDisplayName(User? user)
        {
            if (user == null)
            {
                return null;
            }

            var firstName = user.FirstName?.Trim();
            var lastName = user.LastName?.Trim();

            if (!string.IsNullOrWhiteSpace(firstName) && !string.IsNullOrWhiteSpace(lastName))
            {
                return $"{firstName} {lastName}";
            }

            return !string.IsNullOrWhiteSpace(firstName) ? firstName : lastName;
        }

        public async Task<IEnumerable<ClaimResponseDto>> GetClaimsByCustomerAsync(Guid customerId)
        {
            var claims = await _claimRepository.GetByCustomerAsync(customerId);

            return claims.Select(MapToDto);
        }

        public async Task<IEnumerable<ClaimResponseDto>> GetClaimsByPolicyAsync(Guid policyId)
        {
            var claims = await _claimRepository.GetByPolicyAsync(policyId);

            return claims.Select(MapToDto);
        }

        public async Task<IEnumerable<ClaimResponseDto>> GetClaimsByVehicleAsync(Guid vehicleId)
        {
            var claims = await _claimRepository.GetByVehicleAsync(vehicleId);

            return claims.Select(MapToDto);
        }

        public async Task<ClaimResponseDto> CreateClaimAsync(CreateClaimRequest request)
        {
            var claim = new Claim
            {
                ClaimId = Guid.NewGuid(),
                PolicyId = request.PolicyId,
                CustomerId = request.CustomerId,
                VehicleId = request.VehicleId,
                ClaimNumber = GenerateClaimNumber(),
                IncidentDate = request.IncidentDate,
                ReportedDate = request.ReportedDate ?? DateTime.UtcNow,
                IncidentLocation = request.IncidentLocation,
                IncidentDescription = request.IncidentDescription,
                EstimatedLossAmount = request.EstimatedLossAmount,
                ApprovedAmount = request.ApprovedAmount,
                IsFraudSuspected = request.IsFraudSuspected ?? false,
                StatusId = request.StatusId ?? 1,
                CreatedDate = DateTime.UtcNow
            };

            await _claimRepository.AddAsync(claim);

            // -----------------------------------------------------
            // Stage 1 (FNOL) scoring - must never block claim
            // submission if the rule engine hiccups. No result row
            // simply means downstream checks (Surveyor auto-finalize)
            // treat this claim as needing escalation, same fail-safe
            // principle used elsewhere in this system.
            // -----------------------------------------------------

            try
            {
                await _claimScoringService.ScoreStageAsync(
                    claim.ClaimId,
                    ScoringStageConstants.Stage1_FNOL);
            }
            catch
            {
                // Intentionally swallowed - see comment above.
            }

            return MapToDto(claim);
        }

        public async Task<bool> UpdateClaimAsync(UpdateClaimRequest request)
        {
            var claim = await _claimRepository.GetByIdAsync(request.ClaimId);

            if (claim == null)
                return false;

            claim.PolicyId = request.PolicyId;
            claim.CustomerId = request.CustomerId;
            claim.VehicleId = request.VehicleId;
            claim.ClaimNumber = request.ClaimNumber;
            claim.IncidentDate = request.IncidentDate;
            claim.ReportedDate = request.ReportedDate;
            claim.IncidentLocation = request.IncidentLocation;
            claim.IncidentDescription = request.IncidentDescription;
            claim.EstimatedLossAmount = request.EstimatedLossAmount;
            claim.ApprovedAmount = request.ApprovedAmount;
            claim.IsFraudSuspected = request.IsFraudSuspected;
            claim.StatusId = request.StatusId;
            claim.UpdatedDate = DateTime.UtcNow;

            await _claimRepository.UpdateAsync(claim);

            return true;
        }

        // Claim 360 - only ever touches these four fields, deliberately
        // never StatusId/ApprovedAmount/PolicyId/CustomerId/VehicleId/
        // ClaimNumber/IsFraudSuspected - see UpdateClaimDetailsRequest.
        public async Task<bool> UpdateClaimDetailsAsync(UpdateClaimDetailsRequest request)
        {
            var claim = await _claimRepository.GetByIdAsync(request.ClaimId);

            if (claim == null)
                return false;

            claim.IncidentDate = request.IncidentDate;
            claim.IncidentLocation = request.IncidentLocation;
            claim.IncidentDescription = request.IncidentDescription;
            claim.EstimatedLossAmount = request.EstimatedLossAmount;
            claim.UpdatedDate = DateTime.UtcNow;

            await _claimRepository.UpdateAsync(claim);

            return true;
        }

        public async Task<bool> UpdateRepairAuthorizationAsync(UpdateRepairAuthorizationRequest request)
        {
            var claim = await _claimRepository.GetByIdAsync(request.ClaimId);

            if (claim == null)
                return false;

            claim.RepairAuthorizationStatusId = request.RepairAuthorizationStatusId;
            claim.RepairAuthorizationDate = request.RepairAuthorizationDate;
            claim.UpdatedDate = DateTime.UtcNow;

            await _claimRepository.UpdateAsync(claim);

            return true;
        }

        public async Task<bool> UpdateApprovedAmountAsync(UpdateApprovedAmountRequest request)
        {
            var claim = await _claimRepository.GetByIdAsync(request.ClaimId);

            if (claim == null)
                return false;

            claim.ApprovedAmount = request.ApprovedAmount;
            claim.UpdatedDate = DateTime.UtcNow;

            await _claimRepository.UpdateAsync(claim);

            return true;
        }

        public async Task<bool> UpdateLiabilityFiguresAsync(UpdateLiabilityFiguresRequest request)
        {
            var claim = await _claimRepository.GetByIdAsync(request.ClaimId);

            if (claim == null)
                return false;

            claim.LiabilityTaxAmount = request.LiabilityTaxAmount;
            claim.LiabilityTotalLabour = request.LiabilityTotalLabour;
            claim.LiabilityTotalParts = request.LiabilityTotalParts;
            claim.LiabilityDepWaiver = request.LiabilityDepWaiver;
            claim.LiabilityDepreciationAmount = request.LiabilityDepreciationAmount;
            claim.LiabilityCompulsoryExcess = request.LiabilityCompulsoryExcess;
            claim.LiabilityImposedExcess = request.LiabilityImposedExcess;
            claim.LiabilitySalvageDeductions = request.LiabilitySalvageDeductions;
            claim.LiabilityOtherDeduction = request.LiabilityOtherDeduction;
            claim.LiabilityTowingAmount = request.LiabilityTowingAmount;
            claim.UpdatedDate = DateTime.UtcNow;

            await _claimRepository.UpdateAsync(claim);

            return true;
        }

        public async Task<bool> SubmitLiabilityAsync(Guid claimId)
        {
            var claim = await _claimRepository.GetByIdAsync(claimId);

            if (claim == null)
                return false;

            claim.LiabilitySubmitted = true;
            claim.LiabilitySubmittedDate = DateTime.UtcNow;

            // Same reasoning as the "Final Liability Amount" field this
            // replaced: claims that reach Approved via this newer
            // Liability-submit path (rather than the older repair
            // estimate approval flow) never otherwise get
            // ApprovedAmount set at all - Payments and the "approved
            // amount" shown on the Bank account details form would
            // stay blank forever without this. Computed here from the
            // same Liability* figures and formula
            // (ClaimSettlementCard's own Net Assessment calculation),
            // so what gets set here matches what was shown on-screen
            // when Liability was submitted.
            var gross =
                (claim.LiabilityTotalLabour ?? 0) + (claim.LiabilityTotalParts ?? 0) +
                (claim.LiabilityTaxAmount ?? 0);
            var totalDeduction =
                (claim.LiabilityDepreciationAmount ?? 0) + (claim.LiabilityCompulsoryExcess ?? 0) +
                (claim.LiabilityImposedExcess ?? 0) + (claim.LiabilitySalvageDeductions ?? 0) +
                (claim.LiabilityOtherDeduction ?? 0);
            var net = gross - totalDeduction;

            claim.ApprovedAmount = net < 0 ? 0 : net;
            claim.UpdatedDate = DateTime.UtcNow;

            await _claimRepository.UpdateAsync(claim);

            return true;
        }

        // Liability stage - per-component damage table. Finds the
        // claim's SurveyReport, reads its DamageAssessmentItems (the
        // real source for Item Name/Repair-Replace/Category/Labour/
        // Parts), left-joins any already-saved LiabilityDamageItemAdjustment
        // per item so Depn/R&R/T&D/Painting/Others show real saved
        // values once edited, or null (displayed as 0) the first time.
        public async Task<List<LiabilityDamageItemResponseDto>> GetLiabilityDamageItemsAsync(
            Guid claimId)
        {
            var surveyReport = await _context.SurveyReports
                .Where(sr => sr.ClaimId == claimId)
                .OrderByDescending(sr => sr.CreatedDate)
                .FirstOrDefaultAsync();

            if (surveyReport == null)
                return new List<LiabilityDamageItemResponseDto>();

            var items = await _context.DamageAssessmentItems
                .Where(i => i.SurveyReportId == surveyReport.SurveyReportId)
                .ToListAsync();

            var itemIds = items.Select(i => i.DamageAssessmentItemId).ToList();

            var adjustments = await _context.LiabilityDamageItemAdjustments
                .Where(a => itemIds.Contains(a.DamageAssessmentItemId))
                .ToListAsync();

            return items.Select(i =>
            {
                var adjustment = adjustments.FirstOrDefault(
                    a => a.DamageAssessmentItemId == i.DamageAssessmentItemId);

                return new LiabilityDamageItemResponseDto
                {
                    DamageAssessmentItemId = i.DamageAssessmentItemId,
                    ComponentName = i.ComponentName,
                    DamageCategoryId = i.DamageCategoryId,
                    RepairRequired = i.RepairRequired,
                    ReplacementRequired = i.ReplacementRequired,
                    LabourAmount = i.LabourAmount,
                    PartsAmount = i.PartsAmount,
                    DepreciationAmount = adjustment?.DepreciationAmount,
                    RRAmount = adjustment?.RRAmount,
                    TDAmount = adjustment?.TDAmount,
                    PaintingAmount = adjustment?.PaintingAmount,
                    OthersAmount = adjustment?.OthersAmount
                };
            }).ToList();
        }

        public async Task<bool> UpdateLiabilityDamageItemsAsync(
            UpdateLiabilityDamageItemsRequest request)
        {
            foreach (var input in request.Items)
            {
                var existing = await _context.LiabilityDamageItemAdjustments
                    .FirstOrDefaultAsync(
                        a => a.DamageAssessmentItemId == input.DamageAssessmentItemId);

                if (existing == null)
                {
                    existing = new LiabilityDamageItemAdjustment
                    {
                        LiabilityDamageItemAdjustmentId = Guid.NewGuid(),
                        ClaimId = request.ClaimId,
                        DamageAssessmentItemId = input.DamageAssessmentItemId
                    };
                    _context.LiabilityDamageItemAdjustments.Add(existing);
                }

                existing.DepreciationAmount = input.DepreciationAmount;
                existing.RRAmount = input.RRAmount;
                existing.TDAmount = input.TDAmount;
                existing.PaintingAmount = input.PaintingAmount;
                existing.OthersAmount = input.OthersAmount;
                existing.UpdatedDate = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();

            return true;
        }

        public async Task<bool> DeleteClaimAsync(Guid claimId)
        {
            var claim = await _claimRepository.GetByIdAsync(claimId);

            if (claim == null)
                return false;

            await _claimRepository.DeleteAsync(claimId);

            return true;
        }

        private static string GenerateClaimNumber()
        {
            return "CLM" + Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();
        }

        private static ClaimResponseDto MapToDto(Claim claim)
        {
            return new ClaimResponseDto
            {
                ClaimId = claim.ClaimId,
                PolicyId = claim.PolicyId,
                CustomerId = claim.CustomerId,
                VehicleId = claim.VehicleId,
                ClaimNumber = claim.ClaimNumber,
                IncidentDate = claim.IncidentDate,
                ReportedDate = claim.ReportedDate,
                IncidentLocation = claim.IncidentLocation,
                IncidentDescription = claim.IncidentDescription,
                EstimatedLossAmount = claim.EstimatedLossAmount,
                ApprovedAmount = claim.ApprovedAmount,
                IsFraudSuspected = claim.IsFraudSuspected,
                ClosureRemarks = claim.ClosureRemarks,
                ClosureReasonId = claim.ClosureReasonId,
                PriorStatusId = claim.PriorStatusId,
                HoldReason = claim.HoldReason,
                OnHoldDate = claim.OnHoldDate,
                InfoRequestReason = claim.InfoRequestReason,
                InfoRequestedDate = claim.InfoRequestedDate,
                InfoRequestedFromRoleId = claim.InfoRequestedFromRoleId,
                PreferredRepairerId = claim.PreferredRepairerId,
                RegisteredByUserId = claim.RegisteredByUserId,
                InitialReserveAmount = claim.InitialReserveAmount,
                StatusId = claim.StatusId,
                CreatedDate = claim.CreatedDate,
                UpdatedDate = claim.UpdatedDate,
                DriverName = claim.DriverName,
                DriverDob = claim.DriverDob,
                WorkshopRecommendation = claim.WorkshopRecommendation,
                PreferredRepairerTypeId = claim.PreferredRepairerTypeId,
                RepairAuthorizationStatusId = claim.RepairAuthorizationStatusId,
                RepairAuthorizationDate = claim.RepairAuthorizationDate,
                RepairAuthClosureReasonId = claim.RepairAuthClosureReasonId,
                RepairAuthDenialReasonId = claim.RepairAuthDenialReasonId,
                RepairAuthClosureRemarks = claim.RepairAuthClosureRemarks,
                SurveyDate = claim.SurveyDate,
                LiabilityTaxAmount = claim.LiabilityTaxAmount,
                LiabilityTotalLabour = claim.LiabilityTotalLabour,
                LiabilityTotalParts = claim.LiabilityTotalParts,
                LiabilityDepWaiver = claim.LiabilityDepWaiver,
                LiabilityDepreciationAmount = claim.LiabilityDepreciationAmount,
                LiabilityCompulsoryExcess = claim.LiabilityCompulsoryExcess,
                LiabilityImposedExcess = claim.LiabilityImposedExcess,
                LiabilitySalvageDeductions = claim.LiabilitySalvageDeductions,
                LiabilityOtherDeduction = claim.LiabilityOtherDeduction,
                LiabilityTowingAmount = claim.LiabilityTowingAmount,
                LiabilitySubmitted = claim.LiabilitySubmitted,
                LiabilitySubmittedDate = claim.LiabilitySubmittedDate
            };
        }
    }
}