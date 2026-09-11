using System.Text;
using System.Text.RegularExpressions;

using ClaimShield.Api.AI.Interfaces;
using ClaimShield.Api.AI.Models;
using ClaimShield.Api.Authentication;
using ClaimShield.Api.Constants;

using ClaimShield.Api.Interfaces.Repositories;
using ClaimShield.Api.Interfaces.Services;

using ClaimShield.Api.Models.DTOs.Claims;
using ClaimShield.Api.Models.Entities;

using Microsoft.AspNetCore.Http;

namespace ClaimShield.Api.AI.Services
{
    public class MockAiService : IAiService
    {
        // =========================================================
        // SERVICES
        // =========================================================

        private readonly IClaimService _claimService;
        private readonly IPaymentService _paymentService;
        private readonly IClaimDocumentService _claimDocumentService;
        private readonly ISurveyAssignmentService _surveyAssignmentService;
        private readonly IRepairAssignmentService _repairAssignmentService;
        private readonly IClaimClosureService _claimClosureService;

        // =========================================================
        // REPOSITORIES
        // =========================================================

        private readonly IUserRepository _userRepository;
        private readonly ICustomerRepository _customerRepository;
        private readonly IVehicleRepository _vehicleRepository;
        private readonly IPolicyRepository _policyRepository;

        // =========================================================
        // HTTP CONTEXT
        // =========================================================

        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly ICurrentUserService _currentUserService;

        // =========================================================
        // CONSTRUCTOR
        // =========================================================

        public MockAiService(
            IClaimService claimService,
            IPaymentService paymentService,
            IClaimDocumentService claimDocumentService,
            ISurveyAssignmentService surveyAssignmentService,
            IRepairAssignmentService repairAssignmentService,
            IClaimClosureService claimClosureService,
            IUserRepository userRepository,
            ICustomerRepository customerRepository,
            IVehicleRepository vehicleRepository,
            IPolicyRepository policyRepository,
            IHttpContextAccessor httpContextAccessor,
            ICurrentUserService currentUserService)
        {
            _claimService = claimService;
            _paymentService = paymentService;
            _claimDocumentService = claimDocumentService;
            _surveyAssignmentService = surveyAssignmentService;
            _repairAssignmentService = repairAssignmentService;
            _claimClosureService = claimClosureService;

            _userRepository = userRepository;
            _customerRepository = customerRepository;
            _vehicleRepository = vehicleRepository;
            _policyRepository = policyRepository;

            _httpContextAccessor = httpContextAccessor;
            _currentUserService = currentUserService;
        }

        // =========================================================
        // MAIN CHAT METHOD
        // =========================================================

        public async Task<AiChatResponse> ChatAsync(
            AiChatRequest request)
        {
            if (request == null ||
                string.IsNullOrWhiteSpace(request.Message))
            {
                return new AiChatResponse
                {
                    Success = false,
                    Message = "Please provide a message.",
                    Intent = "GENERAL_CHAT"
                };
            }

            var originalMessage =
                request.Message.Trim();

            var message =
                originalMessage.ToLowerInvariant();

            // =====================================================
            // CLAIM NUMBER DETECTION & CONTEXT RESOLUTION
            // =====================================================

            if (!request.ClaimId.HasValue)
            {
                var extractedClaimId =
                    await GetClaimIdFromMessageAsync(
                        originalMessage);

                if (extractedClaimId.HasValue)
                {
                    request.ClaimId =
                        extractedClaimId.Value;
                }
                else
                {
                    request.ClaimId =
                        await GetDefaultClaimIdForCurrentUserAsync();
                }
            }

            // =====================================================
            // APPROVER - PENDING APPROVALS
            // =====================================================

            if (IsPendingApprovalIntent(message))
            {
                return await HandlePendingApprovalsAsync();
            }

            // =====================================================
            // APPROVER - APPROVE CLAIM
            // =====================================================

            if (IsApproveClaimIntent(message))
            {
                return await HandleApproveClaimAsync(
                    request.ClaimId,
                    originalMessage);
            }

            // =====================================================
            // CONFIRMATION
            // =====================================================

            if (request.Confirmed &&
                IsConfirmation(message))
            {
                return await HandleConfirmedActionAsync(
                    request.ClaimId);
            }

            // =====================================================
            // CANCELLATION
            // =====================================================

            if (IsCancellation(message))
            {
                return new AiChatResponse
                {
                    Success = true,
                    Message = "Okay. I will not perform the requested action.",
                    Intent = "ACTION_CANCELLED"
                };
            }

            // =====================================================
            // CLAIM CLOSURE
            // =====================================================

            if (IsCloseClaimIntent(message))
            {
                return await HandleCloseClaimAsync(
                    request.ClaimId);
            }

            // =====================================================
            // CLAIM SECURITY
            // =====================================================

            if (request.ClaimId.HasValue)
            {
                var authorized =
                    await IsClaimAccessibleByCurrentUserAsync(
                        request.ClaimId.Value);

                if (!authorized)
                {
                    return ClaimAccessDenied();
                }
            }

            // =====================================================
            // INTENT DETECTION
            // =====================================================

            var intents =
                DetectAllIntents(message);

            // =====================================================
            // MULTIPLE QUESTIONS
            // =====================================================

            if (intents.Count > 1)
            {
                return await HandleMultiIntentAsync(
                    request.ClaimId,
                    intents,
                    originalMessage);
            }

            // =====================================================
            // SINGLE QUESTION
            // =====================================================

            var intent =
                intents.Count == 1
                    ? intents[0]
                    : "GENERAL_CHAT";

            switch (intent)
            {
                case "GET_VEHICLE_DETAILS":
                    return await HandleVehicleDetailsAsync(
                        request.ClaimId);

                case "INSURANCE_FAQ_IDV":
                    return HandleIdvFaq(
                        request.ClaimId);

                case "WHY_CLAIMSHIELD":
                    return HandleWhyClaimShield(
                        request.ClaimId);

                case "GREETING_HELP":
                    return await GeneralResponseAsync(originalMessage);

                case "GET_CLAIM_STATUS":
                    return await HandleClaimStatusAsync(
                        request.ClaimId,
                        originalMessage);

                case "GET_CLAIM_DETAILS":
                    return await HandleClaimDetailsAsync(
                        request.ClaimId);

                case "GET_PAYMENT_STATUS":
                    return await HandlePaymentStatusAsync(
                        request.ClaimId);

                case "GET_SURVEY_STATUS":
                    return await HandleSurveyStatusAsync(
                        request.ClaimId);

                case "GET_REPAIR_STATUS":
                    return await HandleRepairStatusAsync(
                        request.ClaimId);

                case "GET_DOCUMENTS":
                    return await HandleDocumentsAsync(
                        request.ClaimId);

                default:
                    return await GeneralResponseAsync(originalMessage);
            }
        }

        // =========================================================
        // DEFAULT CLAIM RESOLUTION
        // =========================================================

        private async Task<Guid?> GetDefaultClaimIdForCurrentUserAsync()
        {
            try
            {
                var currentUserId = _currentUserService.UserId;
                if (!currentUserId.HasValue) return null;

                var customer = await _customerRepository.GetByUserIdAsync(currentUserId.Value);
                if (customer == null) return null;

                var claims = await _claimService.GetClaimsByCustomerAsync(customer.CustomerId);
                var latest = claims?.OrderByDescending(c => c.CreatedDate ?? c.IncidentDate).FirstOrDefault();
                return latest?.ClaimId;
            }
            catch
            {
                return null;
            }
        }

        // =========================================================
        // CLAIM NUMBER -> CLAIM ID
        // =========================================================

        private async Task<Guid?> GetClaimIdFromMessageAsync(
            string message)
        {
            if (string.IsNullOrWhiteSpace(message))
            {
                return null;
            }

            var match =
                Regex.Match(
                    message,
                    @"\bCLM[0-9A-Za-z\-]{4,20}\b",
                    RegexOptions.IgnoreCase);

            if (!match.Success)
            {
                return null;
            }

            var claimNumber =
                match.Value.ToUpperInvariant();

            var claims =
                await _claimService.GetAllClaimsAsync();

            var claim =
                claims.FirstOrDefault(
                    x =>
                        string.Equals(
                            x.ClaimNumber,
                            claimNumber,
                            StringComparison.OrdinalIgnoreCase) ||
                        x.ClaimNumber.StartsWith(
                            claimNumber,
                            StringComparison.OrdinalIgnoreCase));

            return claim?.ClaimId;
        }

        // =========================================================
        // CLAIM ACCESS CONTROL
        // =========================================================

        private async Task<bool> IsClaimAccessibleByCurrentUserAsync(
            Guid claimId)
        {
            var httpContext =
                _httpContextAccessor.HttpContext;

            if (httpContext == null)
            {
                return false;
            }

            var currentUser =
                httpContext.User;

            if (currentUser == null ||
                currentUser.Identity == null ||
                !currentUser.Identity.IsAuthenticated)
            {
                return false;
            }

            var currentUserId =
                _currentUserService.UserId;

            if (!currentUserId.HasValue)
            {
                return false;
            }

            var databaseUser =
                await _userRepository.GetByIdAsync(
                    currentUserId.Value);

            if (databaseUser == null)
            {
                return false;
            }

            var role =
                _currentUserService.RoleName;

            if (string.Equals(
                    role,
                    "Admin",
                    StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            var claim =
                await _claimService.GetClaimByIdAsync(
                    claimId);

            if (claim == null)
            {
                return false;
            }

            if (string.Equals(
                    role,
                    "Customer",
                    StringComparison.OrdinalIgnoreCase))
            {
                var customer =
                    await _customerRepository.GetByUserIdAsync(
                        currentUserId.Value);

                if (customer == null)
                {
                    return false;
                }

                return
                    claim.CustomerId ==
                    customer.CustomerId;
            }

            if (string.Equals(
                    role,
                    "Surveyor",
                    StringComparison.OrdinalIgnoreCase))
            {
                var surveys =
                    await _surveyAssignmentService.GetByClaimAsync(
                        claimId);

                return
                    surveys.Any(
                        x =>
                            x.SurveyorId ==
                            currentUserId.Value);
            }

            if (string.Equals(
                    role,
                    "Repairer",
                    StringComparison.OrdinalIgnoreCase))
            {
                var repairs =
                    await _repairAssignmentService.GetByClaimAsync(
                        claimId);

                return
                    repairs.Any(
                        x =>
                            x.RepairerId ==
                            currentUserId.Value);
            }

            if (string.Equals(
                    role,
                    "Approver",
                    StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            return false;
        }

        // =========================================================
        // APPROVER - PENDING APPROVALS
        // =========================================================

        private async Task<AiChatResponse>
            HandlePendingApprovalsAsync()
        {
            var role =
                _currentUserService.RoleName;

            if (!string.Equals(
                    role,
                    "Approver",
                    StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(
                    role,
                    "Admin",
                    StringComparison.OrdinalIgnoreCase))
            {
                return new AiChatResponse
                {
                    Success = false,
                    Message = "Only Approvers can view pending approvals.",
                    Intent = "GET_PENDING_APPROVALS"
                };
            }

            var allClaims =
                await _claimService.GetAllClaimsAsync();

            var pendingClaims =
                allClaims
                    .Where(
                        x =>
                            x.StatusId ==
                            ClaimStatusConstants.SurveyCompleted)
                    .OrderByDescending(
                        x =>
                            x.CreatedDate ??
                            DateTime.MinValue)
                    .ToList();

            if (pendingClaims.Count == 0)
            {
                return new AiChatResponse
                {
                    Success = true,
                    Message = "There are no claims currently waiting for your approval.",
                    Intent = "GET_PENDING_APPROVALS"
                };
            }

            var sb = new StringBuilder();
            sb.AppendLine($"There are {pendingClaims.Count} claim(s) waiting for approval:");
            foreach (var c in pendingClaims.Take(5))
            {
                sb.AppendLine($"- Claim **{c.ClaimNumber}** (Loss: ₹{c.EstimatedLossAmount:N0})");
            }

            return new AiChatResponse
            {
                Success = true,
                Message = sb.ToString().Trim(),
                Intent = "GET_PENDING_APPROVALS"
            };
        }

        // =========================================================
        // APPROVER - APPROVE CLAIM
        // =========================================================

        private async Task<AiChatResponse>
            HandleApproveClaimAsync(
                Guid? claimId,
                string message)
        {
            var role =
                _currentUserService.RoleName;

            if (!string.Equals(
                    role,
                    "Approver",
                    StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(
                    role,
                    "Admin",
                    StringComparison.OrdinalIgnoreCase))
            {
                return new AiChatResponse
                {
                    Success = false,
                    Message = "Only Approvers can approve claims.",
                    Intent = "APPROVE_CLAIM"
                };
            }

            if (!claimId.HasValue)
            {
                return ClaimIdRequired(
                    "Please provide the Claim ID or Claim Number to approve.");
            }

            var claim =
                await _claimService.GetClaimByIdAsync(
                    claimId.Value);

            if (claim == null)
            {
                return ClaimNotFound(
                    "APPROVE_CLAIM");
            }

            return new AiChatResponse
            {
                Success = true,
                RequiresConfirmation = true,
                Message = $"Are you sure you want to approve claim {claim.ClaimNumber}?",
                Intent = "APPROVE_CLAIM",
                Action = "APPROVE_CLAIM",
                ClaimId = claim.ClaimId
            };
        }

        // =========================================================
        // CONFIRMED ACTION
        // =========================================================

        private async Task<AiChatResponse>
            HandleConfirmedActionAsync(
                Guid? claimId)
        {
            if (!claimId.HasValue)
            {
                return ClaimIdRequired(
                    "Please provide the Claim ID to perform this action.");
            }

            var claim =
                await _claimService.GetClaimByIdAsync(
                    claimId.Value);

            if (claim == null)
            {
                return ClaimNotFound(
                    "CONFIRMED_ACTION");
            }

            return new AiChatResponse
            {
                Success = true,
                Message = $"Action for claim {claim.ClaimNumber} has been confirmed and processed.",
                Intent = "CONFIRMED_ACTION",
                ClaimId = claim.ClaimId
            };
        }

        // =========================================================
        // VEHICLE DETAILS
        // =========================================================

        private async Task<AiChatResponse>
            HandleVehicleDetailsAsync(
                Guid? claimId)
        {
            var currentUserId = _currentUserService.UserId;
            Customer? customer = null;
            if (currentUserId.HasValue)
            {
                customer = await _customerRepository.GetByUserIdAsync(currentUserId.Value);
            }

            Vehicle? vehicle = null;
            ClaimResponseDto? claim = null;

            if (claimId.HasValue)
            {
                claim = await _claimService.GetClaimByIdAsync(claimId.Value);
                if (claim != null && claim.VehicleId != Guid.Empty)
                {
                    vehicle = await _vehicleRepository.GetByIdAsync(claim.VehicleId);
                }
            }

            if (vehicle == null && customer != null)
            {
                var vehicles = await _vehicleRepository.GetByCustomerIdAsync(customer.CustomerId);
                vehicle = vehicles?.FirstOrDefault();
            }

            var regNo = vehicle?.RegistrationNumber ?? claim?.VehicleRegistrationNumber ?? "TN41AX5452";
            var variant = !string.IsNullOrWhiteSpace(vehicle?.Variant) ? vehicle.Variant : "Sportz 1.2 Petrol";
            var engineNo = !string.IsNullOrWhiteSpace(vehicle?.EngineNumber) ? vehicle.EngineNumber : "G4LA123456";
            var chassisNo = !string.IsNullOrWhiteSpace(vehicle?.ChassisNumber) ? vehicle.ChassisNumber : "MALC123456789";
            var color = !string.IsNullOrWhiteSpace(vehicle?.VehicleColor) ? vehicle.VehicleColor : "Polar White";
            var claimNum = claim?.ClaimNumber ?? "CLM202600107-DRAFT";
            var status = GetClaimStatusName(claim?.StatusId ?? 4);

            var sb = new StringBuilder();
            sb.AppendLine("Here are your vehicle details on record:");
            sb.AppendLine($"• **Vehicle Number**: {regNo}");
            sb.AppendLine($"• **Variant**: {variant}");
            sb.AppendLine($"• **Engine Number**: {engineNo}");
            sb.AppendLine($"• **Chassis Number**: {chassisNo}");
            sb.AppendLine($"• **Color**: {color}");
            sb.AppendLine($"• **Active Claim**: {claimNum} (Status: {status})");

            return new AiChatResponse
            {
                Success = true,
                Message = sb.ToString().Trim(),
                Intent = "GET_VEHICLE_DETAILS",
                ClaimId = claim?.ClaimId
            };
        }

        // =========================================================
        // CLAIM STATUS
        // =========================================================

        private async Task<AiChatResponse>
            HandleClaimStatusAsync(
                Guid? claimId,
                string? userMessage = null)
        {
            if (!claimId.HasValue)
            {
                claimId = await GetDefaultClaimIdForCurrentUserAsync();
            }

            if (!claimId.HasValue)
            {
                return new AiChatResponse
                {
                    Success = true,
                    Message = "No active claims were found for your account. If you have a specific Claim Number, please provide it (e.g. CLM202600107).",
                    Intent = "GET_CLAIM_STATUS"
                };
            }

            var claim =
                await _claimService.GetClaimByIdAsync(
                    claimId.Value);

            if (claim == null)
            {
                return ClaimNotFound(
                    "GET_CLAIM_STATUS");
            }

            var customerName =
                await GetCustomerNameAsync(
                    claim.CustomerId);

            var firstName = customerName.Split(' ')[0];
            var status =
                GetClaimStatusName(
                    claim.StatusId);

            var regNo = claim.VehicleRegistrationNumber ?? "TN41AX5452";

            string surveyorInfo = "Assigned (Physical Inspection)";
            var surveys = await _surveyAssignmentService.GetByClaimAsync(claim.ClaimId);
            var survey = surveys?.OrderByDescending(s => s.AssignedDate ?? DateTime.MinValue).FirstOrDefault();
            if (survey != null)
            {
                var surveyorUser = await _userRepository.GetByIdAsync(survey.SurveyorId);
                var sName = GetUserDisplayName(surveyorUser);
                surveyorInfo = $"{sName} (Physical Inspection)";
            }

            var isTanglish = IsTanglishQuery(userMessage);

            var sb = new StringBuilder();
            if (isTanglish)
            {
                sb.AppendLine($"Vanakkam {firstName}! Unga active claim status update idho:");
                sb.AppendLine($"• **Claim Number**: {claim.ClaimNumber}");
                sb.AppendLine($"• **Vehicle Number**: {regNo}");
                sb.AppendLine($"• **Status**: {status} 📋");
                sb.AppendLine($"• **Assigned Surveyor**: {surveyorInfo}");
                sb.AppendLine($"• **Repair Garage**: Apex Auto Body Works, Coimbatore");
                sb.AppendLine();
                sb.AppendLine("Survey inspection report is verified. Claim approval and repair work order process is progressing!");
            }
            else
            {
                sb.AppendLine($"Hello {firstName}! Here is the status update for your active claim:");
                sb.AppendLine($"• **Claim Number**: {claim.ClaimNumber}");
                sb.AppendLine($"• **Vehicle Number**: {regNo}");
                sb.AppendLine($"• **Status**: {status} 📋");
                sb.AppendLine($"• **Assigned Surveyor**: {surveyorInfo}");
                sb.AppendLine($"• **Repair Garage**: Apex Auto Body Works, Coimbatore");
                sb.AppendLine();
                sb.AppendLine("Your physical inspection has been successfully completed by your assigned surveyor. The survey report is currently being finalized for repair approval and work order issuance.");
            }

            return new AiChatResponse
            {
                Success = true,
                Message = sb.ToString().Trim(),
                Intent = "GET_CLAIM_STATUS",
                ClaimId = claim.ClaimId
            };
        }

        // =========================================================
        // CLAIM DETAILS
        // =========================================================

        private async Task<AiChatResponse>
            HandleClaimDetailsAsync(
                Guid? claimId)
        {
            if (!claimId.HasValue)
            {
                claimId = await GetDefaultClaimIdForCurrentUserAsync();
            }

            if (!claimId.HasValue)
            {
                return ClaimIdRequired(
                    "Please provide the Claim ID so I can retrieve your claim information.");
            }

            var claim =
                await _claimService.GetClaimByIdAsync(
                    claimId.Value);

            if (claim == null)
            {
                return ClaimNotFound(
                    "GET_CLAIM_DETAILS");
            }

            var customerName =
                await GetCustomerNameAsync(
                    claim.CustomerId);

            var status =
                GetClaimStatusName(
                    claim.StatusId);

            var approvedAmount =
                claim.ApprovedAmount.HasValue
                    ? $"₹ {claim.ApprovedAmount.Value:N2}"
                    : "Under Assessment";

            var estimatedLoss =
                claim.EstimatedLossAmount.HasValue
                    ? $"₹ {claim.EstimatedLossAmount.Value:N2}"
                    : "Not reported";

            return new AiChatResponse
            {
                Success = true,
                Message =
                    $"The claim for {customerName}, " +
                    $"claim number **{claim.ClaimNumber}**, " +
                    $"has reported loss of {estimatedLoss} and approved amount of {approvedAmount}. " +
                    $"The current claim status is **{status}**.",
                Intent = "GET_CLAIM_DETAILS",
                ClaimId = claim.ClaimId
            };
        }

        // =========================================================
        // PAYMENT STATUS
        // =========================================================

        private async Task<AiChatResponse>
            HandlePaymentStatusAsync(
                Guid? claimId)
        {
            if (!claimId.HasValue)
            {
                claimId = await GetDefaultClaimIdForCurrentUserAsync();
            }

            if (!claimId.HasValue)
            {
                return ClaimIdRequired(
                    "Please provide the Claim ID so I can retrieve the payment information.");
            }

            var payments =
                await _paymentService.GetByClaimAsync(
                    claimId.Value);

            var paymentList =
                payments?.ToList();

            if (paymentList == null ||
                paymentList.Count == 0)
            {
                return new AiChatResponse
                {
                    Success = true,
                    Message = "No payment transaction has been processed yet for this claim. Payout will be disbursed once repair invoices are approved.",
                    Intent = "GET_PAYMENT_STATUS",
                    ClaimId = claimId.Value
                };
            }

            var payment =
                paymentList
                    .OrderByDescending(
                        x =>
                            x.CreatedDate)
                    .FirstOrDefault();

            return new AiChatResponse
            {
                Success = true,
                Message =
                    $"The latest payment for this claim is " +
                    $"₹ {payment!.Amount:N2}. " +
                    $"Its current payment status is " +
                    $"{payment.PaymentStatus}.",
                Intent = "GET_PAYMENT_STATUS",
                ClaimId = claimId.Value
            };
        }

        // =========================================================
        // SURVEY STATUS
        // =========================================================

        private async Task<AiChatResponse>
            HandleSurveyStatusAsync(
                Guid? claimId)
        {
            if (!claimId.HasValue)
            {
                claimId = await GetDefaultClaimIdForCurrentUserAsync();
            }

            if (!claimId.HasValue)
            {
                return ClaimIdRequired(
                    "Please provide the Claim ID so I can retrieve the survey information.");
            }

            var surveys =
                await _surveyAssignmentService.GetByClaimAsync(
                    claimId.Value);

            var surveyList =
                surveys?.ToList();

            if (surveyList == null ||
                surveyList.Count == 0)
            {
                return new AiChatResponse
                {
                    Success = true,
                    Message = "Surveyor Priya Nair has been assigned for physical inspection at Apex Auto Body Works.",
                    Intent = "GET_SURVEY_STATUS",
                    ClaimId = claimId.Value
                };
            }

            var survey =
                surveyList
                    .OrderByDescending(
                        x =>
                            x.AssignedDate ??
                            DateTime.MinValue)
                    .FirstOrDefault();

            var surveyor =
                await _userRepository.GetByIdAsync(
                    survey!.SurveyorId);

            var surveyorName =
                GetUserDisplayName(
                    surveyor);

            var surveyStatus =
                GetAssignmentStatusName(
                    survey.AssignmentStatusId);

            return new AiChatResponse
            {
                Success = true,
                Message =
                    $"The survey for this claim is assigned to " +
                    $"**{surveyorName}** (Physical Inspection). " +
                    $"The survey status is **{surveyStatus}**.",
                Intent = "GET_SURVEY_STATUS",
                ClaimId = claimId.Value
            };
        }

        // =========================================================
        // REPAIR STATUS
        // =========================================================

        private async Task<AiChatResponse>
            HandleRepairStatusAsync(
                Guid? claimId)
        {
            if (!claimId.HasValue)
            {
                claimId = await GetDefaultClaimIdForCurrentUserAsync();
            }

            if (!claimId.HasValue)
            {
                return ClaimIdRequired(
                    "Please provide the Claim ID so I can retrieve the repair information.");
            }

            var repairs =
                await _repairAssignmentService.GetByClaimAsync(
                    claimId.Value);

            var repairList =
                repairs?.ToList();

            if (repairList == null ||
                repairList.Count == 0)
            {
                return new AiChatResponse
                {
                    Success = true,
                    Message = "Your vehicle is located at Apex Auto Body Works, Coimbatore. Repair work order is pending final survey report approval.",
                    Intent = "GET_REPAIR_STATUS",
                    ClaimId = claimId.Value
                };
            }

            var repair =
                repairList
                    .OrderByDescending(
                        x =>
                            x.AssignedDate ??
                            DateTime.MinValue)
                    .FirstOrDefault();

            var repairer =
                await _userRepository.GetByIdAsync(
                    repair!.RepairerId);

            var repairerName =
                GetUserDisplayName(
                    repairer);

            var repairStatus =
                GetAssignmentStatusName(
                    repair.AssignmentStatusId);

            return new AiChatResponse
            {
                Success = true,
                Message =
                    $"Repair work is assigned to " +
                    $"**{repairerName}** at Apex Auto Body Works. " +
                    $"The current repair status is **{repairStatus}**.",
                Intent = "GET_REPAIR_STATUS",
                ClaimId = claimId.Value
            };
        }

        // =========================================================
        // DOCUMENTS
        // =========================================================

        private async Task<AiChatResponse>
            HandleDocumentsAsync(
                Guid? claimId)
        {
            if (!claimId.HasValue)
            {
                claimId = await GetDefaultClaimIdForCurrentUserAsync();
            }

            if (!claimId.HasValue)
            {
                return ClaimIdRequired(
                    "Please provide the Claim ID so I can retrieve document details.");
            }

            var documents =
                await _claimDocumentService.GetByClaimAsync(
                    claimId.Value);

            var docList =
                documents?.ToList();

            if (docList == null ||
                docList.Count == 0)
            {
                return new AiChatResponse
                {
                    Success = true,
                    Message = "You have uploaded your Vehicle RC certificate and damage photos for this claim. All documents have been verified.",
                    Intent = "GET_DOCUMENTS",
                    ClaimId = claimId.Value
                };
            }

            return new AiChatResponse
            {
                Success = true,
                Message = $"There are {docList.Count} verified document(s) attached to this claim (RC Certificate, Damage Photos).",
                Intent = "GET_DOCUMENTS",
                ClaimId = claimId.Value
            };
        }

        // =========================================================
        // INSURANCE FAQ - IDV vs SETTLEMENT
        // =========================================================

        private static AiChatResponse
            HandleIdvFaq(
                Guid? claimId)
        {
            var sb = new StringBuilder();
            sb.AppendLine("Here is the difference between IDV and Claim Settlement Payout:");
            sb.AppendLine();
            sb.AppendLine("1. **IDV (Insured Declared Value)**:");
            sb.AppendLine("   • The maximum sum insured for your vehicle fixed at policy start (current market value).");
            sb.AppendLine("   • This is the total payout cap in case of total loss or theft.");
            sb.AppendLine();
            sb.AppendLine("2. **Claim Settlement Payout**:");
            sb.AppendLine("   • The actual approved amount for repairs assessed after inspection.");
            sb.AppendLine("   • Calculated as: Assessed Parts + Labor - Policy Excess (deductible: ₹500) - Depreciation - Salvage.");

            return new AiChatResponse
            {
                Success = true,
                Message = sb.ToString().Trim(),
                Intent = "INSURANCE_FAQ_IDV",
                ClaimId = claimId
            };
        }

        // =========================================================
        // WHY CLAIMSHIELD
        // =========================================================

        private static AiChatResponse
            HandleWhyClaimShield(
                Guid? claimId)
        {
            var sb = new StringBuilder();
            sb.AppendLine("Why choose ClaimShield+ for your motor insurance claims:");
            sb.AppendLine("1. **30-Minute AI Fast-Track Payout**: Minor outer panel damages get instant AI assessment and direct UPI settlement.");
            sb.AppendLine("2. **Smart OCR Verification**: Automatic cross-matching of RC certificate, engine/chassis number, and bumper number plate.");
            sb.AppendLine("3. **Real-time Tracking**: Live status updates across survey, garage repairs, and approval milestones.");
            sb.AppendLine("4. **Zero-Hassle Cashless Network**: Direct cashless repair approvals with trusted network workshops.");

            return new AiChatResponse
            {
                Success = true,
                Message = sb.ToString().Trim(),
                Intent = "WHY_CLAIMSHIELD",
                ClaimId = claimId
            };
        }

        // =========================================================
        // MULTI INTENT
        // =========================================================

        private async Task<AiChatResponse>
            HandleMultiIntentAsync(
                Guid? claimId,
                List<string> intents,
                string? userMessage = null)
        {
            if (!claimId.HasValue)
            {
                claimId = await GetDefaultClaimIdForCurrentUserAsync();
            }

            var sections = new List<string>();

            if (intents.Contains("GET_VEHICLE_DETAILS"))
            {
                var resp = await HandleVehicleDetailsAsync(claimId);
                sections.Add(resp.Message);
            }

            if (intents.Contains("GET_CLAIM_STATUS"))
            {
                var resp = await HandleClaimStatusAsync(claimId, userMessage);
                sections.Add(resp.Message);
            }

            if (intents.Contains("GET_SURVEY_STATUS"))
            {
                var resp = await HandleSurveyStatusAsync(claimId);
                sections.Add(resp.Message);
            }

            if (intents.Contains("GET_REPAIR_STATUS"))
            {
                var resp = await HandleRepairStatusAsync(claimId);
                sections.Add(resp.Message);
            }

            if (intents.Contains("GET_PAYMENT_STATUS"))
            {
                var resp = await HandlePaymentStatusAsync(claimId);
                sections.Add(resp.Message);
            }

            if (sections.Count == 0)
            {
                return await GeneralResponseAsync(userMessage);
            }

            return new AiChatResponse
            {
                Success = true,
                Message = string.Join("\n\n---\n\n", sections),
                Intent = "MULTI_INTENT",
                ClaimId = claimId
            };
        }

        // =========================================================
        // CLOSE CLAIM
        // =========================================================

        private async Task<AiChatResponse>
            HandleCloseClaimAsync(
                Guid? claimId)
        {
            if (!claimId.HasValue)
            {
                claimId = await GetDefaultClaimIdForCurrentUserAsync();
            }

            if (!claimId.HasValue)
            {
                return ClaimIdRequired(
                    "Please provide the Claim ID so I can check whether the claim can be closed.");
            }

            var authorized =
                await IsClaimAccessibleByCurrentUserAsync(
                    claimId.Value);

            if (!authorized)
            {
                return ClaimAccessDenied();
            }

            var claim =
                await _claimService.GetClaimByIdAsync(
                    claimId.Value);

            if (claim == null)
            {
                return ClaimNotFound(
                    "CLOSE_CLAIM");
            }

            var statusId =
                Convert.ToInt32(
                    claim.StatusId);

            if (statusId == ClaimStatusConstants.Closed)
            {
                return new AiChatResponse
                {
                    Success = true,
                    Message = $"Your claim {claim.ClaimNumber} is already Closed. No action is required.",
                    Intent = "CLOSE_CLAIM"
                };
            }

            if (statusId != ClaimStatusConstants.Settled)
            {
                return new AiChatResponse
                {
                    Success = false,
                    Message = $"Your claim {claim.ClaimNumber} is currently {GetClaimStatusName(statusId)}. Only a Settled claim can be closed.",
                    Intent = "CLOSE_CLAIM",
                    ClaimId = claim.ClaimId
                };
            }

            return new AiChatResponse
            {
                Success = true,
                RequiresConfirmation = true,
                Message = $"Your claim {claim.ClaimNumber} is currently Settled. Closing the claim will change its status to Closed. Please confirm if you want to proceed.",
                Intent = "CLOSE_CLAIM",
                Action = "CLOSE_CLAIM",
                ClaimId = claim.ClaimId
            };
        }

        // =========================================================
        // CUSTOMER NAME
        // =========================================================

        private async Task<string>
            GetCustomerNameAsync(
                Guid customerId)
        {
            var customer =
                await _customerRepository.GetByIdAsync(
                    customerId);

            if (customer == null)
            {
                return "Valued Customer";
            }

            var user =
                await _userRepository.GetByIdAsync(
                    customer.UserId);

            return GetUserDisplayName(
                user);
        }

        // =========================================================
        // USER NAME
        // =========================================================

        private static string
            GetUserDisplayName(
                User? user)
        {
            if (user == null)
            {
                return "Unknown";
            }

            var firstName =
                user.FirstName?.Trim();

            var lastName =
                user.LastName?.Trim();

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

        // =========================================================
        // CLAIM STATUS
        // =========================================================

        private static string
            GetClaimStatusName(
                int? statusId)
        {
            return statusId switch
            {
                ClaimStatusConstants.Submitted => "Submitted",
                ClaimStatusConstants.UnderReview => "Under Review",
                ClaimStatusConstants.SurveyAssigned => "Survey Assigned",
                ClaimStatusConstants.SurveyCompleted => "Survey Completed",
                ClaimStatusConstants.RepairAssigned => "Repair Assigned",
                ClaimStatusConstants.RepairInProgress => "Repair In Progress",
                ClaimStatusConstants.Approved => "Approved",
                ClaimStatusConstants.Rejected => "Rejected",
                ClaimStatusConstants.Settled => "Settled",
                ClaimStatusConstants.Closed => "Closed",
                _ => "Under Review"
            };
        }

        // =========================================================
        // ASSIGNMENT STATUS
        // =========================================================

        private static string
            GetAssignmentStatusName(
                int statusId)
        {
            return statusId switch
            {
                AssignmentStatusConstants.Assigned => "Assigned",
                AssignmentStatusConstants.Accepted => "Accepted",
                AssignmentStatusConstants.InProgress => "In Progress",
                AssignmentStatusConstants.Completed => "Completed",
                AssignmentStatusConstants.Cancelled => "Cancelled",
                _ => "In Progress"
            };
        }

        // =========================================================
        // INTENT DETECTION
        // =========================================================

        private static List<string>
            DetectAllIntents(
                string message)
        {
            var intents =
                new List<string>();

            // =====================================================
            // VEHICLE DETAILS
            // =====================================================

            if (
                message.Contains("vehicle") ||
                message.Contains("vandi") ||
                message.Contains("car") ||
                message.Contains("bike") ||
                message.Contains("motor") ||
                message.Contains("inoday vehicle") ||
                message.Contains("enoda vehicle") ||
                message.Contains("my vehicle") ||
                message.Contains("vehicle details") ||
                message.Contains("vehicle detail") ||
                message.Contains("vehicle number") ||
                message.Contains("registration number") ||
                message.Contains("reg number") ||
                message.Contains("reg no") ||
                message.Contains("engine number") ||
                message.Contains("engine no") ||
                message.Contains("chassis number") ||
                message.Contains("chassis no") ||
                message.Contains("plate number") ||
                message.Contains("number plate") ||
                message.Contains("variant") ||
                Regex.IsMatch(message, @"\b(tn|ka|mh|dl|ap|ts|kl|hr|up|wb)[0-9]{1,2}[a-z]{1,3}[0-9]{4}\b", RegexOptions.IgnoreCase))
            {
                intents.Add(
                    "GET_VEHICLE_DETAILS");
            }

            // =====================================================
            // PAYMENT
            // =====================================================

            if (
                message.Contains("payment") ||
                message.Contains("paid") ||
                message.Contains("payout") ||
                message.Contains("payment status") ||
                message.Contains("claim payment") ||
                message.Contains("payment received") ||
                message.Contains("when will i get paid") ||
                message.Contains("payment amount"))
            {
                intents.Add(
                    "GET_PAYMENT_STATUS");
            }

            // =====================================================
            // SURVEY
            // =====================================================

            if (
                message.Contains("survey") ||
                message.Contains("surveyor") ||
                message.Contains("inspection") ||
                message.Contains("inspector") ||
                message.Contains("priya"))
            {
                intents.Add(
                    "GET_SURVEY_STATUS");
            }

            // =====================================================
            // REPAIR
            // =====================================================

            if (
                message.Contains("repair") ||
                message.Contains("repairer") ||
                message.Contains("garage") ||
                message.Contains("workshop") ||
                message.Contains("apex") ||
                message.Contains("service") ||
                message.Contains("servicing") ||
                message.Contains("where is my car"))
            {
                intents.Add(
                    "GET_REPAIR_STATUS");
            }

            // =====================================================
            // DOCUMENTS
            // =====================================================

            if (
                message.Contains("document") ||
                message.Contains("documents") ||
                message.Contains("file") ||
                message.Contains("files") ||
                message.Contains("uploaded") ||
                message.Contains("rc book") ||
                message.Contains("rc copy"))
            {
                intents.Add(
                    "GET_DOCUMENTS");
            }

            // =====================================================
            // CLAIM DETAILS
            // =====================================================

            if (
                message.Contains("claim details") ||
                message.Contains("claim detail") ||
                message.Contains("approved amount") ||
                message.Contains("loss amount") ||
                message.Contains("claim amount"))
            {
                intents.Add(
                    "GET_CLAIM_DETAILS");
            }

            // =====================================================
            // CLAIM STATUS
            // =====================================================

            if (
                message.Contains("claim status") ||
                message.Contains("status of my claim") ||
                message.Contains("status of claim") ||
                message.Contains("what is my claim status") ||
                message.Contains("where is my claim") ||
                message.Contains("what happened to my claim") ||
                message.Contains("enache") ||
                message.Contains("ennachu") ||
                message.Contains("na nache") ||
                message.Contains("nwr") ||
                message.Contains("status") ||
                message.Contains("update") ||
                message.Contains("ipo") ||
                message.Contains("last claim") ||
                message.Contains("latest claim") ||
                message.Contains("my claim") ||
                message.Contains("en claim") ||
                message.Contains("claim pathi") ||
                message.Contains("intha claim"))
            {
                intents.Add(
                    "GET_CLAIM_STATUS");
            }

            // =====================================================
            // INSURANCE FAQ - IDV vs SETTLEMENT
            // =====================================================

            if (
                message.Contains("idv") ||
                message.Contains("difference between idv") ||
                message.Contains("settlement payout") ||
                message.Contains("deductible") ||
                message.Contains("excess"))
            {
                intents.Add(
                    "INSURANCE_FAQ_IDV");
            }

            // =====================================================
            // WHY CLAIMSHIELD
            // =====================================================

            if (
                message.Contains("why claimshield") ||
                message.Contains("why i need to choose") ||
                message.Contains("why choose") ||
                message.Contains("features") ||
                message.Contains("advantages") ||
                message.Contains("about claimshield"))
            {
                intents.Add(
                    "WHY_CLAIMSHIELD");
            }

            // =====================================================
            // GREETING / HELP
            // =====================================================

            if (
                message.Contains("who are you") ||
                message.Contains("who r u") ||
                message == "hi" ||
                message == "hello" ||
                message == "hey" ||
                message.Contains("vanakkam") ||
                message.Contains("help") ||
                message.Contains("movo"))
            {
                intents.Add(
                    "GREETING_HELP");
            }

            return intents
                .Distinct()
                .ToList();
        }

        // =========================================================
        // PENDING APPROVAL INTENT
        // =========================================================

        private static bool
            IsPendingApprovalIntent(
                string message)
        {
            return
                message.Contains("which claims are waiting for my approval") ||
                message.Contains("which claims are pending approval") ||
                message.Contains("what claims are waiting for approval") ||
                message.Contains("what claims need my approval") ||
                message.Contains("claims waiting for approval") ||
                message.Contains("claims pending approval") ||
                message.Contains("pending approvals") ||
                message.Contains("show pending approvals") ||
                message.Contains("show claims waiting for approval");
        }

        // =========================================================
        // CLOSE INTENT
        // =========================================================

        private static bool
            IsCloseClaimIntent(
                string message)
        {
            return
                message.Contains("close my claim") ||
                message.Contains("close the claim") ||
                message.Contains("close claim") ||
                message.Contains("close this claim") ||
                message.Contains("close my case") ||
                message.Contains("close the case") ||
                message.Contains("i want to close my claim") ||
                message.Contains("finish my claim") ||
                message.Contains("complete my claim");
        }

        // =========================================================
        // APPROVE CLAIM INTENT
        // =========================================================

        private static bool
            IsApproveClaimIntent(
                string message)
        {
            return
                message.StartsWith("approve claim") ||
                message.StartsWith("approve this claim") ||
                message.Contains("approve the claim") ||
                message.Contains("i want to approve");
        }

        // =========================================================
        // CONFIRMATION
        // =========================================================

        private static bool
            IsConfirmation(
                string message)
        {
            return
                message == "yes" ||
                message == "yes please" ||
                message == "yeah" ||
                message == "sure" ||
                message == "confirm" ||
                message == "confirmed" ||
                message == "proceed" ||
                message == "go ahead" ||
                message == "okay" ||
                message == "ok";
        }

        // =========================================================
        // CANCELLATION
        // =========================================================

        private static bool
            IsCancellation(
                string message)
        {
            return
                message == "no" ||
                message == "no thanks" ||
                message == "cancel" ||
                message == "cancel it" ||
                message == "stop" ||
                message == "never mind";
        }

        // =========================================================
        // CLAIM ID REQUIRED
        // =========================================================

        private static AiChatResponse
            ClaimIdRequired(
                string message)
        {
            return new AiChatResponse
            {
                Success = false,
                Message = message,
                Intent = "CLAIM_ID_REQUIRED"
            };
        }

        // =========================================================
        // CLAIM NOT FOUND
        // =========================================================

        private static AiChatResponse
            ClaimNotFound(
                string intent)
        {
            return new AiChatResponse
            {
                Success = false,
                Message = "I could not find a claim with the provided Claim ID or Claim Number.",
                Intent = intent
            };
        }

        // =========================================================
        // ACCESS DENIED
        // =========================================================

        private static AiChatResponse
            ClaimAccessDenied()
        {
            return new AiChatResponse
            {
                Success = false,
                Message = "You are not authorized to access this claim.",
                Intent = "CLAIM_ACCESS_DENIED"
            };
        }

        // =========================================================
        // TANGLISH DETECTION HELPER
        // =========================================================

        private static bool IsTanglishQuery(string? message)
        {
            if (string.IsNullOrWhiteSpace(message)) return false;
            var msg = message.ToLowerInvariant();
            return msg.Contains("vanakkam") ||
                   msg.Contains("ennachu") ||
                   msg.Contains("enache") ||
                   msg.Contains("na nache") ||
                   msg.Contains("sollu") ||
                   msg.Contains("vandi") ||
                   msg.Contains("ipo") ||
                   msg.Contains("ippo") ||
                   msg.Contains("enoda") ||
                   msg.Contains("inoday") ||
                   msg.Contains("pathina") ||
                   msg.Contains("eppadi") ||
                   msg.Contains("panren") ||
                   msg.Contains("venum");
        }

        // =========================================================
        // GENERAL RESPONSE
        // =========================================================

        private async Task<AiChatResponse>
            GeneralResponseAsync(string? userMessage = null)
        {
            var currentUserId = _currentUserService.UserId;
            string firstName = "there";
            string vehicleReg = "TN41AX5452";
            string claimNum = "CLM202600107-DRAFT";

            if (currentUserId.HasValue)
            {
                var user = await _userRepository.GetByIdAsync(currentUserId.Value);
                if (user != null && !string.IsNullOrWhiteSpace(user.FirstName))
                {
                    firstName = user.FirstName;
                }

                var customer = await _customerRepository.GetByUserIdAsync(currentUserId.Value);
                if (customer != null)
                {
                    var claims = await _claimService.GetClaimsByCustomerAsync(customer.CustomerId);
                    var latest = claims?.OrderByDescending(c => c.CreatedDate ?? c.IncidentDate).FirstOrDefault();
                    if (latest != null)
                    {
                        claimNum = latest.ClaimNumber;
                        if (!string.IsNullOrWhiteSpace(latest.VehicleRegistrationNumber))
                        {
                            vehicleReg = latest.VehicleRegistrationNumber;
                        }
                    }
                }
            }

            var isTanglish = IsTanglishQuery(userMessage);
            string msg;
            if (isTanglish)
            {
                msg = $"Vanakkam {firstName}! 👋 Naan Movo, unga ClaimShield+ AI assistant.\n" +
                      $"Unga claim status ({claimNum}), vehicle details ({vehicleReg}), surveyor updates (Priya Nair), repair progress pathi naan help panren. Enakku sollunga! 😊";
            }
            else
            {
                msg = $"Hello {firstName}! 👋 I'm Movo, your ClaimShield+ AI assistant.\n" +
                      $"I can help you check your claim status ({claimNum}), vehicle details ({vehicleReg}), surveyor updates (Priya Nair), repair progress, or explain insurance terms. How can I help you today?";
            }

            return new AiChatResponse
            {
                Success = true,
                Message = msg,
                Intent = "GENERAL_CHAT"
            };
        }
    }
}