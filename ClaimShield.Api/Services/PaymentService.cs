using ClaimShield.Api.Constants;
using ClaimShield.Api.Data.Context;
using ClaimShield.Api.Interfaces.Repositories;
using ClaimShield.Api.Interfaces.Services;
using ClaimShield.Api.Models.DTOs.Payments;
using ClaimShield.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace ClaimShield.Api.Services
{
    public class PaymentService : IPaymentService
    {
        private readonly IPaymentRepository _paymentRepository;
        private readonly ClaimShieldDbContext _context;

        public PaymentService(
            IPaymentRepository paymentRepository,
            ClaimShieldDbContext context)
        {
            _paymentRepository = paymentRepository;
            _context = context;
        }

        // =========================================================
        // GET ALL
        // =========================================================

        public async Task<IEnumerable<PaymentResponseDto>> GetAllAsync()
        {
            var payments =
                await _paymentRepository.GetAllAsync();

            return payments.Select(MapToDto);
        }

        // =========================================================
        // GET BY ID
        // =========================================================

        public async Task<PaymentResponseDto?> GetByIdAsync(
            Guid paymentId)
        {
            var payment =
                await _paymentRepository.GetByIdAsync(
                    paymentId);

            if (payment == null)
            {
                return null;
            }

            return MapToDto(payment);
        }

        // =========================================================
        // GET BY CLAIM
        // =========================================================

        public async Task<IEnumerable<PaymentResponseDto>> GetByClaimAsync(
            Guid claimId)
        {
            var payments =
                await _paymentRepository.GetByClaimAsync(
                    claimId);

            return payments.Select(MapToDto);
        }

        // =========================================================
        // CREATE PAYMENT
        // =========================================================

        public async Task<PaymentResponseDto> CreateAsync(
            CreatePaymentRequest request)
        {
            var claim = await _context.Claims
                .FirstOrDefaultAsync(
                    x => x.ClaimId == request.ClaimId);

            if (claim == null)
            {
                throw new InvalidOperationException(
                    "Claim not found.");
            }

            // Claims can reach payment-eligibility two ways: the older
            // formal Decision flow (which sets StatusId to Approved
            // directly), or the newer Liability-submit flow (used by
            // claims with a text-based Workshop/Repair Recommendation
            // rather than a real assigned Repairer account, which never
            // transitions StatusId to Approved at all) - accept either,
            // matching the same "either path" gating already used on
            // the frontend's stepper and Approval-stage visibility.
            if (claim.StatusId != ClaimStatusConstants.Approved && !claim.LiabilitySubmitted)
            {
                throw new InvalidOperationException(
                    "Payment can only be created for an approved claim.");
            }

            // claim.ApprovedAmount is the authoritative cap when it's
            // actually set - but for claims on the newer Liability-
            // submit path it can still be stale/unset even after a
            // real amount has been computed and shown on the frontend
            // (the Liability* figures are the reliable source there).
            // Only enforce the cap when ApprovedAmount genuinely has a
            // value; otherwise fall through to the plain positive-
            // amount check below, trusting the amount the person was
            // actually shown and confirmed.
            if (claim.ApprovedAmount.HasValue && request.Amount > claim.ApprovedAmount.Value)
            {
                throw new InvalidOperationException(
                    "Payment amount cannot exceed the approved claim amount.");
            }

            if (request.Amount <= 0)
            {
                throw new InvalidOperationException(
                    "Payment amount must be greater than zero.");
            }

            var existingPayments =
                await _paymentRepository.GetByClaimAsync(
                    request.ClaimId);

            var activePayment =
                existingPayments.FirstOrDefault(
                    x =>
                        x.PaymentStatusId == PaymentStatusConstants.Pending ||
                        x.PaymentStatusId == PaymentStatusConstants.Processing ||
                        x.PaymentStatusId == PaymentStatusConstants.Paid);

            if (activePayment != null)
            {
                throw new InvalidOperationException(
                    "An active or completed payment already exists for this claim.");
            }

            if (request.PaymentMethodId != PaymentMethodConstants.Neft &&
                request.PaymentMethodId != PaymentMethodConstants.Imps &&
                request.PaymentMethodId != PaymentMethodConstants.Upi &&
                request.PaymentMethodId != PaymentMethodConstants.Cheque &&
                request.PaymentMethodId != PaymentMethodConstants.Rtgs)
            {
                throw new InvalidOperationException(
                    "A valid payment method (NEFT, RTGS, IMPS, UPI, or Cheque) is required.");
            }

            if (request.PayeeType != PayeeTypeConstants.Customer &&
                request.PayeeType != PayeeTypeConstants.Repairer)
            {
                throw new InvalidOperationException(
                    "Payments To must be either Customer or Repairer.");
            }

            if (string.IsNullOrWhiteSpace(request.PayeeCode))
            {
                throw new InvalidOperationException(
                    "Payee code is required.");
            }

            if (string.IsNullOrWhiteSpace(request.BeneficiaryName))
            {
                throw new InvalidOperationException(
                    "Beneficiary name is required.");
            }

            // Cheque payments are addressed to the payee by name and don't
            // need a bank account/IFSC to be recorded up front; the other
            // three methods are direct bank transfers and can't be made
            // without them.
            if (request.PaymentMethodId != PaymentMethodConstants.Cheque &&
                (string.IsNullOrWhiteSpace(request.BankAccountNumber) ||
                 string.IsNullOrWhiteSpace(request.IfscCode)))
            {
                throw new InvalidOperationException(
                    "Bank account number and IFSC code are required for NEFT, IMPS, and UPI payments.");
            }

            var payment = new Payment
            {
                PaymentId = Guid.NewGuid(),

                ClaimId =
                    request.ClaimId,

                Amount =
                    request.Amount,

                PaymentStatusId = PaymentStatusConstants.Pending,

                TransactionReference =
                    request.TransactionReference,

                PaymentDate =
                    request.PaymentDate,

                Remarks =
                    request.Remarks,

                PaymentMethodId =
                    request.PaymentMethodId,

                PayeeType =
                    request.PayeeType,

                PayeeCode =
                    request.PayeeCode,

                BeneficiaryName =
                    request.BeneficiaryName,

                BankAccountNumber =
                    request.PaymentMethodId == PaymentMethodConstants.Cheque
                        ? null
                        : request.BankAccountNumber,

                IfscCode =
                    request.PaymentMethodId == PaymentMethodConstants.Cheque
                        ? null
                        : request.IfscCode,

                BankName =
                    request.PaymentMethodId == PaymentMethodConstants.Cheque
                        ? null
                        : request.BankName,

                BranchName =
                    request.PaymentMethodId == PaymentMethodConstants.Cheque
                        ? null
                        : request.BranchName,

                MobileNumber =
                    request.MobileNumber,

                CreatedDate =
                    DateTime.UtcNow
            };

            await _paymentRepository.AddAsync(
                payment);

            return MapToDto(payment);
        }

        // =========================================================
        // PROCESS
        // =========================================================

        public async Task<bool> ProcessAsync(
            Guid paymentId)
        {
            var payment =
                await _paymentRepository.GetByIdAsync(
                    paymentId);

            if (payment == null)
            {
                return false;
            }

            if (payment.PaymentStatusId != PaymentStatusConstants.Pending)
            {
                return false;
            }

            payment.PaymentStatusId = PaymentStatusConstants.Processing;

            await _paymentRepository.UpdateAsync(
                payment);

            return true;
        }

        // =========================================================
        // COMPLETE
        // =========================================================

        public async Task<(bool Success, string? ErrorMessage)> CompleteAsync(
            Guid paymentId)
        {
            var payment =
                await _paymentRepository.GetByIdAsync(
                    paymentId);

            if (payment == null)
            {
                return (false, "Payment not found.");
            }

            if (payment.PaymentStatusId != PaymentStatusConstants.Processing)
            {
                return (false, "This payment is not currently in Processing status.");
            }

            var claimForApprovalCheck =
                await _context.Claims
                    .FirstOrDefaultAsync(
                        x => x.ClaimId == payment.ClaimId);

            if (claimForApprovalCheck == null)
            {
                return (false, "Claim not found.");
            }

            payment.PaymentStatusId = PaymentStatusConstants.Paid;

            payment.PaymentDate =
                DateTime.UtcNow;

            if (string.IsNullOrWhiteSpace(
                payment.TransactionReference))
            {
                payment.TransactionReference =
                    $"CS-PAY-{DateTime.UtcNow:yyyyMMddHHmmss}";
            }

            await _paymentRepository.UpdateAsync(
                payment);

            claimForApprovalCheck.StatusId = ClaimStatusConstants.Settled;

            claimForApprovalCheck.UpdatedDate =
                DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return (true, null);
        }

        // =========================================================
        // FAIL
        // =========================================================

        public async Task<bool> FailAsync(
            Guid paymentId,
            string? remarks)
        {
            var payment =
                await _paymentRepository.GetByIdAsync(
                    paymentId);

            if (payment == null)
            {
                return false;
            }

            // Only Pending or Processing can fail
            if (payment.PaymentStatusId != PaymentStatusConstants.Pending &&
                payment.PaymentStatusId != PaymentStatusConstants.Processing)
            {
                return false;
            }

            payment.PaymentStatusId = PaymentStatusConstants.Failed;

            if (!string.IsNullOrWhiteSpace(remarks))
            {
                payment.Remarks = remarks;
            }

            await _paymentRepository.UpdateAsync(
                payment);

            return true;
        }

        // =========================================================
        // CANCEL
        // =========================================================

        public async Task<bool> CancelAsync(
            Guid paymentId,
            string? remarks)
        {
            var payment =
                await _paymentRepository.GetByIdAsync(
                    paymentId);

            if (payment == null)
            {
                return false;
            }

            // Only Pending or Processing can be cancelled
            if (payment.PaymentStatusId != PaymentStatusConstants.Pending &&
                payment.PaymentStatusId != PaymentStatusConstants.Processing)
            {
                return false;
            }

            payment.PaymentStatusId = PaymentStatusConstants.Cancelled;

            if (!string.IsNullOrWhiteSpace(remarks))
            {
                payment.Remarks = remarks;
            }

            await _paymentRepository.UpdateAsync(
                payment);

            return true;
        }

        // =========================================================
        // DELETE
        // =========================================================

        public async Task<bool> DeleteAsync(
            Guid paymentId)
        {
            var payment =
                await _paymentRepository.GetByIdAsync(
                    paymentId);

            if (payment == null)
            {
                return false;
            }

            // Do not delete Paid payments
            if (payment.PaymentStatusId == PaymentStatusConstants.Paid)
            {
                return false;
            }

            await _paymentRepository.DeleteAsync(
                paymentId);

            return true;
        }

        // =========================================================
        // MAP TO DTO
        // =========================================================

        private static PaymentResponseDto MapToDto(
            Payment payment)
        {
            return new PaymentResponseDto
            {
                PaymentId =
                    payment.PaymentId,

                ClaimId =
                    payment.ClaimId,

                Amount =
                    payment.Amount,

                PaymentStatusId =
                    payment.PaymentStatusId,

                PaymentStatus =
                    GetPaymentStatusName(
                        payment.PaymentStatusId),

                TransactionReference =
                    payment.TransactionReference,

                PaymentDate =
                    payment.PaymentDate,

                Remarks =
                    payment.Remarks,

                PaymentMethodId =
                    payment.PaymentMethodId,

                PaymentMethod =
                    GetPaymentMethodName(
                        payment.PaymentMethodId),

                PayeeType =
                    payment.PayeeType,

                PayeeTypeName =
                    GetPayeeTypeName(
                        payment.PayeeType),

                PayeeCode =
                    payment.PayeeCode,

                BeneficiaryName =
                    payment.BeneficiaryName,

                BankAccountNumber =
                    payment.BankAccountNumber,

                IfscCode =
                    payment.IfscCode,

                BankName =
                    payment.BankName,

                BranchName =
                    payment.BranchName,

                MobileNumber =
                    payment.MobileNumber,

                CreatedDate =
                    payment.CreatedDate
            };
        }

        // =========================================================
        // STATUS NAME
        // =========================================================

        private static string GetPaymentStatusName(
            int paymentStatusId)
        {
            return paymentStatusId switch
            {
                PaymentStatusConstants.Pending => "Pending",
                PaymentStatusConstants.Processing => "Processing",
                PaymentStatusConstants.Paid => "Paid",
                PaymentStatusConstants.Failed => "Failed",
                PaymentStatusConstants.Cancelled => "Cancelled",
                _ => "Unknown"
            };
        }

        private static string? GetPaymentMethodName(
            int? paymentMethodId)
        {
            return paymentMethodId switch
            {
                null => null,
                PaymentMethodConstants.Neft => "NEFT",
                PaymentMethodConstants.Imps => "IMPS",
                PaymentMethodConstants.Upi => "UPI",
                PaymentMethodConstants.Cheque => "Cheque",
                PaymentMethodConstants.Rtgs => "RTGS",
                _ => "Unknown"
            };
        }

        private static string? GetPayeeTypeName(
            int? payeeType)
        {
            return payeeType switch
            {
                null => null,
                PayeeTypeConstants.Customer => "Customer",
                PayeeTypeConstants.Repairer => "Repairer",
                _ => "Unknown"
            };
        }
    }
}