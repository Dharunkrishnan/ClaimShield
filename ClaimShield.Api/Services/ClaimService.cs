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

            var intake = await _context.ClaimIntakes
                .FirstOrDefaultAsync(x => x.ClaimId == claimId);

            dto.LossTypeId = intake?.LossType;
            dto.InstantClaimToggle = intake?.InstantClaimToggle;
            dto.InstantClaimParts = intake?.InstantClaimParts;

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

        // =========================================================
        // UTC TIMESTAMP FIX
        // =========================================================
        //
        // The Claims table's date columns are Postgres "timestamp
        // without time zone" (no explicit column type was configured,
        // so EF Core used its default). Every date is written with
        // DateTime.UtcNow, so the VALUE is correct UTC - but reading
        // it back gives DateTime.Kind = Unspecified, which System.Text.Json
        // then serializes WITHOUT a trailing "Z" (e.g.
        // "2026-08-19T14:30:00" instead of "...Z"). The browser's
        // `new Date(...)` treats a timezone-less string as already
        // being LOCAL time, not UTC - so instead of converting UTC to
        // IST (+5:30), it displays the raw UTC numbers as if they were
        // already IST, showing a claim as raised ~5.5 hours earlier
        // (sometimes on the wrong calendar day) than it actually was.
        //
        // This explicitly stamps Kind=Utc before the value leaves the
        // API, so the JSON gets its "Z" back and the frontend converts
        // correctly. The proper long-term fix is migrating these
        // columns to "timestamptz" - this is the safe fix that doesn't
        // require a schema migration.
        // =========================================================

        private static DateTime AsUtc(DateTime value) =>
            DateTime.SpecifyKind(value, DateTimeKind.Utc);

        private static DateTime? AsUtc(DateTime? value) =>
            value.HasValue ? DateTime.SpecifyKind(value.Value, DateTimeKind.Utc) : null;

        private static ClaimResponseDto MapToDto(Claim claim)
        {
            return new ClaimResponseDto
            {
                ClaimId = claim.ClaimId,
                PolicyId = claim.PolicyId,
                CustomerId = claim.CustomerId,
                VehicleId = claim.VehicleId,
                ClaimNumber = claim.ClaimNumber,
                IncidentDate = AsUtc(claim.IncidentDate),
                ReportedDate = AsUtc(claim.ReportedDate),
                IncidentLocation = claim.IncidentLocation,
                IncidentDescription = claim.IncidentDescription,
                EstimatedLossAmount = claim.EstimatedLossAmount,
                ApprovedAmount = claim.ApprovedAmount,
                IsFraudSuspected = claim.IsFraudSuspected,
                StatusId = claim.StatusId,
                CreatedDate = AsUtc(claim.CreatedDate),
                UpdatedDate = AsUtc(claim.UpdatedDate),
                PolicyNumber = claim.Policy?.PolicyNumber,
                VehicleRegistrationNumber = claim.Vehicle?.RegistrationNumber
            };
        }
    }
}