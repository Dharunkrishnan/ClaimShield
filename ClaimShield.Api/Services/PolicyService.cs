using ClaimShield.Api.Interfaces.Repositories;
using ClaimShield.Api.Interfaces.Services;
using ClaimShield.Api.Models.DTOs.Policies;
using ClaimShield.Api.Models.Entities;

namespace ClaimShield.Api.Services
{
    public class PolicyService : IPolicyService
    {
        private readonly IPolicyRepository _policyRepository;

        public PolicyService(IPolicyRepository policyRepository)
        {
            _policyRepository = policyRepository;
        }

        public async Task<IEnumerable<PolicyResponseDto>> GetAllPoliciesAsync()
        {
            var policies = await _policyRepository.GetAllAsync();

            return policies.Select(MapToDto);
        }

        public async Task<PolicyResponseDto?> GetPolicyByIdAsync(Guid policyId)
        {
            var policy = await _policyRepository.GetByIdAsync(policyId);

            if (policy == null)
                return null;

            return MapToDto(policy);
        }

        public async Task<IEnumerable<PolicyResponseDto>> GetPoliciesByCustomerAsync(Guid customerId)
        {
            var policies = await _policyRepository.GetByCustomerAsync(customerId);

            return policies.Select(MapToDto);
        }

        public async Task<PolicyResponseDto> CreatePolicyAsync(CreatePolicyRequest request)
        {
            var policy = new Policy
            {
                PolicyId = Guid.NewGuid(),
                CustomerId = request.CustomerId,
                VehicleId = request.VehicleId,
                PolicyNumber = request.PolicyNumber,
                CoverageAmount = request.CoverageAmount,
                PremiumAmount = request.PremiumAmount,
                StartDate = request.StartDate,
                EndDate = request.EndDate,
                PolicyTypeId = request.PolicyTypeId,
                PolicyStatusId = request.PolicyStatusId,
                CreatedDate = DateTime.UtcNow
            };

            await _policyRepository.AddAsync(policy);

            return (await GetPolicyByIdAsync(policy.PolicyId))!;
        }

        public async Task<bool> UpdatePolicyAsync(UpdatePolicyRequest request)
        {
            var policy = await _policyRepository.GetByIdAsync(request.PolicyId);

            if (policy == null)
                return false;

            policy.CustomerId = request.CustomerId;
            policy.VehicleId = request.VehicleId;
            policy.PolicyNumber = request.PolicyNumber;
            policy.CoverageAmount = request.CoverageAmount;
            policy.PremiumAmount = request.PremiumAmount;
            policy.IDV = request.IDV;
            policy.AddOns = request.AddOns;
            policy.StartDate = request.StartDate;
            policy.EndDate = request.EndDate;
            policy.PolicyTypeId = request.PolicyTypeId;
            policy.PolicyStatusId = request.PolicyStatusId;
            policy.UpdatedDate = DateTime.UtcNow;

            await _policyRepository.UpdateAsync(policy);

            return true;
        }

        public async Task<bool> DeletePolicyAsync(Guid policyId)
        {
            var policy = await _policyRepository.GetByIdAsync(policyId);

            if (policy == null)
                return false;

            await _policyRepository.DeleteAsync(policyId);

            return true;
        }

        private static PolicyResponseDto MapToDto(Policy policy)
        {
            return new PolicyResponseDto
            {
                PolicyId = policy.PolicyId,
                CustomerId = policy.CustomerId,
                VehicleId = policy.VehicleId,
                PolicyNumber = policy.PolicyNumber,
                CoverageAmount = policy.CoverageAmount,
                PremiumAmount = policy.PremiumAmount,
                StartDate = policy.StartDate,
                EndDate = policy.EndDate,
                PolicyTypeId = policy.PolicyTypeId,
                PolicyStatusId = policy.PolicyStatusId,
                IDV = policy.IDV,
                Excess = policy.Excess,
                AddOns = policy.AddOns
            };
        }
    }
}