using ClaimShield.Api.Data.Context;
using ClaimShield.Api.Interfaces.Repositories;
using ClaimShield.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace ClaimShield.Api.Repositories
{
    public class ClaimRepository : IClaimRepository
    {
        private readonly ClaimShieldDbContext _context;

        public ClaimRepository(ClaimShieldDbContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<Claim>> GetAllAsync()
        {
            return await _context.Claims
                .Include(c => c.Policy)
                .Include(c => c.Vehicle)
                .OrderByDescending(c => c.ReportedDate)
                .ToListAsync();
        }

        public async Task<Claim?> GetByIdAsync(Guid claimId)
        {
            return await _context.Claims
                .FirstOrDefaultAsync(c => c.ClaimId == claimId);
        }

        public async Task<Claim?> GetByIdWithDetailsAsync(Guid claimId)
        {
            return await _context.Claims
                .Include(c => c.Policy)
                .Include(c => c.Customer)
                    .ThenInclude(customer => customer!.User)
                .Include(c => c.Vehicle)
                .FirstOrDefaultAsync(c => c.ClaimId == claimId);
        }

        public async Task<IEnumerable<Claim>> GetByCustomerAsync(Guid customerId)
        {
            return await _context.Claims
                .Include(c => c.Policy)
                .Include(c => c.Vehicle)
                .Where(c => c.CustomerId == customerId)
                .OrderByDescending(c => c.ReportedDate)
                .ToListAsync();
        }

        public async Task<IEnumerable<Claim>> GetByPolicyAsync(Guid policyId)
        {
            return await _context.Claims
                .Include(c => c.Policy)
                .Include(c => c.Vehicle)
                .Where(c => c.PolicyId == policyId)
                .OrderByDescending(c => c.ReportedDate)
                .ToListAsync();
        }

        public async Task<IEnumerable<Claim>> GetByVehicleAsync(Guid vehicleId)
        {
            return await _context.Claims
                .Include(c => c.Policy)
                .Include(c => c.Vehicle)
                .Where(c => c.VehicleId == vehicleId)
                .OrderByDescending(c => c.ReportedDate)
                .ToListAsync();
        }

        public async Task AddAsync(Claim claim)
        {
            await _context.Claims.AddAsync(claim);
            await _context.SaveChangesAsync();
        }

        public async Task UpdateAsync(Claim claim)
        {
            _context.Claims.Update(claim);
            await _context.SaveChangesAsync();
        }

        public async Task DeleteAsync(Guid claimId)
        {
            var claim = await _context.Claims.FindAsync(claimId);

            if (claim != null)
            {
                _context.Claims.Remove(claim);
                await _context.SaveChangesAsync();
            }
        }
    }
}