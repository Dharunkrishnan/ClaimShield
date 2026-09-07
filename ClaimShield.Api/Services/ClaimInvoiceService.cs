using ClaimShield.Api.Constants;
using ClaimShield.Api.Data.Context;
using ClaimShield.Api.Interfaces.Services;
using ClaimShield.Api.Models.DTOs.ClaimInvoices;
using ClaimShield.Api.Models.Entities;

using Microsoft.EntityFrameworkCore;

namespace ClaimShield.Api.Services
{
    public class ClaimInvoiceService : IClaimInvoiceService
    {
        private readonly ClaimShieldDbContext _context;

        public ClaimInvoiceService(
            ClaimShieldDbContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<InvoiceResponseDto>> GetByClaimAsync(
            Guid claimId)
        {
            var invoices =
                await _context.ClaimInvoices
                    .Where(x => x.ClaimId == claimId)
                    .OrderBy(x => x.InvoiceDate)
                    .ToListAsync();

            return invoices.Select(MapToDto);
        }

        public async Task<InvoiceResponseDto> CreateAsync(
            Guid claimId,
            CreateInvoiceRequest request)
        {
            ValidateFavour(
                request.InvoiceFavour);

            var invoice = new ClaimInvoice
            {
                ClaimInvoiceId = Guid.NewGuid(),
                ClaimId = claimId,
                InvoiceDate = request.InvoiceDate,
                InvoiceNumber = request.InvoiceNumber,
                InvoiceAmount = request.InvoiceAmount,
                InvoiceFavour = request.InvoiceFavour,
                CreatedDate = DateTime.UtcNow
            };

            _context.ClaimInvoices.Add(invoice);
            await _context.SaveChangesAsync();

            return MapToDto(invoice);
        }

        public async Task<InvoiceResponseDto?> UpdateAsync(
            Guid claimInvoiceId,
            UpdateInvoiceRequest request)
        {
            var invoice =
                await _context.ClaimInvoices
                    .FirstOrDefaultAsync(x => x.ClaimInvoiceId == claimInvoiceId);

            if (invoice == null)
            {
                return null;
            }

            ValidateFavour(
                request.InvoiceFavour);

            invoice.InvoiceDate = request.InvoiceDate;
            invoice.InvoiceNumber = request.InvoiceNumber;
            invoice.InvoiceAmount = request.InvoiceAmount;
            invoice.InvoiceFavour = request.InvoiceFavour;
            invoice.UpdatedDate = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return MapToDto(invoice);
        }

        public async Task<bool> DeleteAsync(
            Guid claimInvoiceId)
        {
            var invoice =
                await _context.ClaimInvoices
                    .FirstOrDefaultAsync(x => x.ClaimInvoiceId == claimInvoiceId);

            if (invoice == null)
            {
                return false;
            }

            _context.ClaimInvoices.Remove(invoice);
            await _context.SaveChangesAsync();

            return true;
        }

        private static void ValidateFavour(
            int invoiceFavour)
        {
            if (invoiceFavour != InvoiceFavourConstants.ClaimShieldPlus &&
                invoiceFavour != InvoiceFavourConstants.Insured &&
                invoiceFavour != InvoiceFavourConstants.Financier &&
                invoiceFavour != InvoiceFavourConstants.CorporateCustomer)
            {
                throw new InvalidOperationException(
                    "Invoice favour must be one of ClaimShield+, Insured, Financier, or Corporate Customer.");
            }
        }

        private static InvoiceResponseDto MapToDto(
            ClaimInvoice invoice)
        {
            return new InvoiceResponseDto
            {
                ClaimInvoiceId = invoice.ClaimInvoiceId,
                ClaimId = invoice.ClaimId,
                InvoiceDate = invoice.InvoiceDate,
                InvoiceNumber = invoice.InvoiceNumber,
                InvoiceAmount = invoice.InvoiceAmount,
                InvoiceFavour = invoice.InvoiceFavour,
                InvoiceFavourName = GetInvoiceFavourName(invoice.InvoiceFavour),
                CreatedDate = invoice.CreatedDate,
                UpdatedDate = invoice.UpdatedDate
            };
        }

        private static string GetInvoiceFavourName(
            int invoiceFavour)
        {
            return invoiceFavour switch
            {
                InvoiceFavourConstants.ClaimShieldPlus => "ClaimShield+",
                InvoiceFavourConstants.Insured => "Insured",
                InvoiceFavourConstants.Financier => "Financier",
                InvoiceFavourConstants.CorporateCustomer => "Corporate Customer",
                _ => "Unknown"
            };
        }
    }
}