using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using ClaimShield.Api.AI.Configuration;
using ClaimShield.Api.AI.Interfaces;
using ClaimShield.Api.AI.Models;
using ClaimShield.Api.Authentication;
using ClaimShield.Api.Constants;
using ClaimShield.Api.Data.Context;
using ClaimShield.Api.Interfaces.Repositories;
using ClaimShield.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace ClaimShield.Api.AI.Services
{
    public class GeminiAiService : IAiService
    {
        private readonly HttpClient _httpClient;
        private readonly GeminiSettings _settings;
        private readonly MockAiService _mockFallbackService;
        private readonly ClaimShieldDbContext _context;
        private readonly ICustomerRepository _customerRepository;
        private readonly ICurrentUserService _currentUserService;
        private readonly ILogger<GeminiAiService> _logger;

        public GeminiAiService(
            HttpClient httpClient,
            IOptions<GeminiSettings> settings,
            MockAiService mockFallbackService,
            ClaimShieldDbContext context,
            ICustomerRepository customerRepository,
            ICurrentUserService currentUserService,
            ILogger<GeminiAiService> logger)
        {
            _httpClient = httpClient;
            _settings = settings.Value;
            _mockFallbackService = mockFallbackService;
            _context = context;
            _customerRepository = customerRepository;
            _currentUserService = currentUserService;
            _logger = logger;
        }

        public async Task<AiChatResponse> ChatAsync(AiChatRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Message))
            {
                return new AiChatResponse
                {
                    Success = false,
                    Message = "Please provide a message.",
                    Intent = "GENERAL_CHAT"
                };
            }

            // Fall back to MockAiService if Gemini API Key is not configured
            if (string.IsNullOrWhiteSpace(_settings.ApiKey))
            {
                _logger.LogInformation("Gemini API key is not configured. Falling back to internal rule-based AI.");
                return await _mockFallbackService.ChatAsync(request);
            }

            try
            {
                // 1. Gather live contextual data from the database (inspecting both requested claimId and message text)
                var (contextSummary, resolvedClaimId) = await BuildClaimContextAsync(request.ClaimId, request.Message);

                // 2. Build system instructions and prompt
                var systemInstruction = BuildSystemPrompt(contextSummary);

                // 3. Call Google Gemini API
                var geminiResponseText = await CallGeminiApiAsync(systemInstruction, request.Message);

                if (string.IsNullOrWhiteSpace(geminiResponseText))
                {
                    _logger.LogWarning("Gemini API returned empty text. Delegating to mock fallback.");
                    return await _mockFallbackService.ChatAsync(request);
                }

                return new AiChatResponse
                {
                    Success = true,
                    Message = geminiResponseText.Trim(),
                    Intent = "GEMINI_AI",
                    ClaimId = resolvedClaimId ?? request.ClaimId
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while processing Gemini AI chat request. Using resilient fallback.");
                return await _mockFallbackService.ChatAsync(request);
            }
        }

        private static string GetClaimStatusName(int? statusId) => statusId switch
        {
            ClaimStatusConstants.Submitted => "Submitted",
            ClaimStatusConstants.UnderReview => "Under Review",
            ClaimStatusConstants.SurveyAssigned => "Surveyor Assigned",
            ClaimStatusConstants.SurveyCompleted => "Survey Completed",
            ClaimStatusConstants.RepairAssigned => "Repair Assigned",
            ClaimStatusConstants.RepairInProgress => "Repair In Progress",
            ClaimStatusConstants.Approved => "Approved",
            ClaimStatusConstants.Rejected => "Rejected",
            ClaimStatusConstants.Settled => "Settled / Disbursed",
            ClaimStatusConstants.Closed => "Closed",
            _ => "Under Review"
        };

        private async Task<(string ContextSummary, Guid? ResolvedClaimId)> BuildClaimContextAsync(Guid? claimId, string? userMessage)
        {
            var sb = new StringBuilder();
            Guid? activeClaimId = claimId;

            try
            {
                var userId = _currentUserService.UserId;
                Customer? customer = null;
                User? currentUser = null;

                if (userId.HasValue)
                {
                    currentUser = await _context.Users.FirstOrDefaultAsync(u => u.UserId == userId.Value);
                    customer = await _customerRepository.GetByUserIdAsync(userId.Value);
                }

                if (currentUser != null)
                {
                    sb.AppendLine($"CUSTOMER NAME: {currentUser.FirstName} {currentUser.LastName ?? ""}".Trim());
                    sb.AppendLine($"CUSTOMER EMAIL: {currentUser.Email}");
                    if (!string.IsNullOrWhiteSpace(currentUser.PhoneNumber))
                    {
                        sb.AppendLine($"CUSTOMER PHONE: {currentUser.PhoneNumber}");
                    }
                }

                // 1. Check if user explicitly mentioned a claim number in their message (e.g. CLM25DE9488)
                Claim? claim = null;
                if (!string.IsNullOrWhiteSpace(userMessage))
                {
                    var match = Regex.Match(userMessage, @"\b(CLM[0-9A-Za-z]{6,14})\b", RegexOptions.IgnoreCase);
                    if (match.Success)
                    {
                        var mentionedNumber = match.Value.ToUpperInvariant();
                        claim = await _context.Claims
                            .Include(c => c.Policy)
                            .Include(c => c.Vehicle)
                            .FirstOrDefaultAsync(c => c.ClaimNumber.ToUpper() == mentionedNumber);

                        if (claim != null)
                        {
                            activeClaimId = claim.ClaimId;
                            sb.AppendLine($"[USER EXPLICITLY ASKED ABOUT CLAIM: {claim.ClaimNumber}]");
                        }
                    }
                }

                // 2. If not mentioned in message, use supplied claimId or latest customer claim
                if (claim == null)
                {
                    if (activeClaimId.HasValue)
                    {
                        claim = await _context.Claims
                            .Include(c => c.Policy)
                            .Include(c => c.Vehicle)
                            .FirstOrDefaultAsync(c => c.ClaimId == activeClaimId.Value);
                    }
                    else if (customer != null)
                    {
                        claim = await _context.Claims
                            .Include(c => c.Policy)
                            .Include(c => c.Vehicle)
                            .Where(c => c.CustomerId == customer.CustomerId)
                            .OrderByDescending(c => c.CreatedDate)
                            .FirstOrDefaultAsync();

                        if (claim != null)
                        {
                            activeClaimId = claim.ClaimId;
                        }
                    }
                }

                // 3. Provide summary list of ALL customer's claims
                if (customer != null)
                {
                    var allCustomerClaims = await _context.Claims
                        .Include(c => c.Vehicle)
                        .Where(c => c.CustomerId == customer.CustomerId)
                        .OrderByDescending(c => c.CreatedDate)
                        .Take(6)
                        .ToListAsync();

                    if (allCustomerClaims.Count > 0)
                    {
                        sb.AppendLine("\nALL CLAIMS ON FILE FOR THIS CUSTOMER:");
                        foreach (var uc in allCustomerClaims)
                        {
                            var vReg = uc.Vehicle?.RegistrationNumber ?? "N/A";
                            var isCurrent = claim != null && uc.ClaimId == claim.ClaimId ? " (CURRENTLY FOCUSED)" : "";
                            sb.AppendLine($"- Claim Number: {uc.ClaimNumber} | Status: {GetClaimStatusName(uc.StatusId)} | Vehicle: {vReg} | Incident: {uc.IncidentDate:dd-MMM-yyyy}{isCurrent}");
                        }
                        sb.AppendLine();
                    }
                }

                if (claim != null)
                {
                    sb.AppendLine($"--- ACTIVE CLAIM DETAILS ({claim.ClaimNumber}) ---");
                    sb.AppendLine($"CLAIM NUMBER: {claim.ClaimNumber}");
                    sb.AppendLine($"CLAIM STATUS: {GetClaimStatusName(claim.StatusId)} (StatusId: {claim.StatusId})");
                    sb.AppendLine($"INCIDENT DATE: {claim.IncidentDate:dd-MMM-yyyy HH:mm}");
                    if (!string.IsNullOrWhiteSpace(claim.IncidentLocation))
                    {
                        sb.AppendLine($"INCIDENT LOCATION: {claim.IncidentLocation}");
                    }
                    if (!string.IsNullOrWhiteSpace(claim.IncidentDescription))
                    {
                        sb.AppendLine($"INCIDENT DESCRIPTION: {claim.IncidentDescription}");
                    }
                    if (claim.EstimatedLossAmount.HasValue)
                    {
                        sb.AppendLine($"ESTIMATED LOSS REPORTED: ₹{claim.EstimatedLossAmount.Value:N0}");
                    }
                    if (claim.ApprovedAmount.HasValue)
                    {
                        sb.AppendLine($"APPROVED AMOUNT: ₹{claim.ApprovedAmount.Value:N0}");
                    }

                    if (claim.Vehicle != null)
                    {
                        sb.AppendLine($"VEHICLE REG NO: {claim.Vehicle.RegistrationNumber}");
                        if (!string.IsNullOrWhiteSpace(claim.Vehicle.Variant))
                        {
                            sb.AppendLine($"VEHICLE VARIANT: {claim.Vehicle.Variant}");
                        }
                        sb.AppendLine($"ENGINE NO: {claim.Vehicle.EngineNumber}, CHASSIS NO: {claim.Vehicle.ChassisNumber}");
                    }

                    if (claim.Policy != null)
                    {
                        sb.AppendLine($"POLICY NO: {claim.Policy.PolicyNumber}");
                        sb.AppendLine($"POLICY IDV: ₹{claim.Policy.IDV:N0}, EXCESS DEDUCTIBLE: ₹{claim.Policy.Excess ?? 500:N0}");
                        sb.AppendLine($"POLICY VALIDITY: {claim.Policy.StartDate:dd-MMM-yyyy} to {claim.Policy.EndDate:dd-MMM-yyyy}");
                        if (!string.IsNullOrWhiteSpace(claim.Policy.AddOns))
                        {
                            sb.AppendLine($"POLICY ADD-ONS: {claim.Policy.AddOns}");
                        }
                    }

                    // Intake details
                    var intake = await _context.ClaimIntakes.FirstOrDefaultAsync(i => i.ClaimId == claim.ClaimId);
                    if (intake != null)
                    {
                        sb.AppendLine($"LOSS TYPE ID: {intake.LossType}");
                        sb.AppendLine($"INSTANT FAST-TRACK SELECTED: {(intake.InstantClaimToggle ? "Yes" : "No")}");
                        if (!string.IsNullOrWhiteSpace(intake.InstantClaimParts))
                        {
                            sb.AppendLine($"PARTS SELECTED: {intake.InstantClaimParts}");
                        }
                        sb.AppendLine($"PARKED SAFELY: {(intake.VehicleParkedSafely.HasValue ? (intake.VehicleParkedSafely.Value ? "Yes" : "No") : "Not reported")}");
                    }

                    // Surveyor details
                    var assignment = await _context.SurveyAssignments
                        .Where(a => a.ClaimId == claim.ClaimId)
                        .OrderByDescending(a => a.AssignedDate)
                        .FirstOrDefaultAsync();

                    if (assignment != null)
                    {
                        var surveyor = await _context.Users.FirstOrDefaultAsync(u => u.UserId == assignment.SurveyorId);
                        if (surveyor != null)
                        {
                            sb.AppendLine($"ASSIGNED SURVEYOR: {surveyor.FirstName} {surveyor.LastName ?? ""}".Trim());
                        }
                        sb.AppendLine($"SURVEY MODE: {(assignment.InspectionMode == InspectionModeConstants.Virtual ? "Virtual (Instant Claim Fast-Track)" : "Physical Inspection")}");
                        if (!string.IsNullOrWhiteSpace(assignment.Remarks))
                        {
                            sb.AppendLine($"SURVEYOR REMARKS: {assignment.Remarks}");
                        }
                    }

                    // Estimate Breakdown
                    var estimate = await _context.ClaimEstimateResults.FirstOrDefaultAsync(e => e.ClaimId == claim.ClaimId);
                    if (estimate != null)
                    {
                        sb.AppendLine($"NET ASSESSMENT AMOUNT: ₹{estimate.NetAssessmentAmount:N0}");
                        sb.AppendLine($"DAMAGE ESTIMATE LINE ITEMS: {estimate.LineItems}");
                    }

                    // OCR verification status
                    var ocr = await _context.ClaimRcOcrResults.FirstOrDefaultAsync(o => o.ClaimId == claim.ClaimId);
                    if (ocr != null)
                    {
                        sb.AppendLine($"DOCUMENT VERIFICATION STATUS: {ocr.MatchStatus}");
                        sb.AppendLine($"EXTRACTED RC: {ocr.ExtractedRegNumber}, FRONT PHOTO PLATE: {ocr.PlatePhotoExtractedRegNumber}");
                    }

                    // Repair assignment
                    var repair = await _context.RepairAssignments
                        .FirstOrDefaultAsync(r => r.ClaimId == claim.ClaimId);
                    if (repair != null)
                    {
                        var repairer = await _context.Users.FirstOrDefaultAsync(u => u.UserId == repair.RepairerId);
                        if (repairer != null)
                        {
                            sb.AppendLine($"ASSIGNED GARAGE/REPAIRER: {repairer.FirstName} {repairer.LastName ?? ""}".Trim());
                        }
                        if (repair.ExpectedCompletionDate.HasValue)
                        {
                            sb.AppendLine($"EXPECTED REPAIR COMPLETION: {repair.ExpectedCompletionDate.Value:dd-MMM-yyyy}");
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not fetch full DB claim context for Gemini AI prompt.");
            }

            return (sb.ToString(), activeClaimId);
        }

        private string BuildSystemPrompt(string contextSummary)
        {
            return $@"You are Movo, the intelligent, empathetic, and expert AI assistant for ClaimShield+, India's leading AI-powered motor insurance platform.

CORE CAPABILITIES & DOMAIN KNOWLEDGE:
1. IDENTITY & TONE:
   - You are Movo. You represent ClaimShield+. Always introduce yourself warmly if asked who you are.
   - Tone: Friendly, professional, concise, reassuring, and conversational.

2. STRICT LANGUAGE RULES (CRITICAL - DEFAULT TO ENGLISH):
   - **DEFAULT TO ENGLISH**: Always respond in clean, professional, and friendly English by default.
   - Example English response:
     ""Hello Anjali! 👋 Here is the status update for your active claim CLM202600107-DRAFT:
     • Claim Number: CLM202600107-DRAFT
     • Status: Survey Completed 📋
     • Vehicle: TN41AX5452
     • Assigned Surveyor: Priya Nair (Physical Inspection)
     • What is happening now?: Your physical inspection has been completed. The survey report is being reviewed for repair work order approval.""
   - **ONLY IF THE USER EXPLICITLY SPEAKS / ASKS IN TANGLISH** (e.g. 'ennachu intha claim ku', 'enoda vehicle details sollu', 'vanakkam', 'en claim status enna', 'sollu') -> Then reply in natural Tanglish (Tamil in Latin/English alphabet).
   - **DO NOT output pure Tamil script (தமிழ் எழுத்துக்களை பயன்படுத்த வேண்டாம்)** under any circumstances.

3. TARGET CLAIM PRECISION:
   - If the user asks about a specific Claim Number (e.g., **CLM25DE9488** or asks 'intha claim ku ennachu' while looking at a specific claim), ALWAYS provide details for that exact claim!
   - If the user asks 'What is my last claim?' or 'latest claim', refer to the active/most recent claim from the context.
   - If a claim status is **Submitted**, explain: The claim has been submitted successfully and is currently queued for initial review / surveyor assignment.
   - If a claim status is **Under Review** or **Surveyor Assigned**, explain: Surveyor is assigned and physical/virtual inspection is in progress.
   - If a claim status is **Approved**, explain: Claim is approved with approved amount and work order is issued to garage.
   - If a claim status is **Settled**, explain: The claim payout has been disbursed via UPI/bank transfer.

4. GENERAL MOTOR INSURANCE & CLAIMSHIELD+ KNOWLEDGE:
   - If asked general insurance questions or why to choose ClaimShield+, explain clearly:
     * **IDV (Insured Declared Value)**: The maximum sum insured fixed at policy inception (current market value of the vehicle after standard depreciation). This is the payout cap in case of total loss or theft.
     * **Claim Settlement Payout**: The actual net amount paid out after assessing damage parts/labor, deducting compulsory policy excess (deductible, usually ₹500 - ₹1,500), salvage value, and parts depreciation (waived if Zero Depreciation add-on is active).
     * **Why Choose ClaimShield+**:
       1. **Instant AI Fast-Track (30-Min Payout)**: Minor outer panel damages get automated AI damage estimation, instant OCR verification, and 30-minute UPI settlement.
       2. **Smart OCR Verification**: Automatic cross-matching of RC certificate, engine/chassis number, and vehicle bumper license plate from photos.
       3. **Transparent Virtual/Physical Survey Tracking**: Real-time status updates and direct surveyor coordination.
       4. **Zero Hassle Cashless Garages**: Direct network repair tie-ups with instant work order approvals.
       5. **Transparent Breakdown**: Clear visibility into parts, labor, deductibles, and salvage.

5. FORMATTING & READABILITY:
   - Use bold headers, bullet points, clean numbers (e.g. ₹4,500), and short paragraphs. Keep it easy to read on mobile screens.

---
LIVE CLAIM CONTEXT FROM DATABASE:
{(!string.IsNullOrWhiteSpace(contextSummary) ? contextSummary : "No specific claim currently loaded in session. If user asks about their personal claim details, ask for their Claim Number.")}
---";
        }

        private async Task<string> CallGeminiApiAsync(string systemInstruction, string userMessage)
        {
            var preferredModel = string.IsNullOrWhiteSpace(_settings.Model) ? "gemini-3.6-flash" : _settings.Model;
            var candidateModels = new[] { preferredModel, "gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-flash-lite-latest", "gemini-flash-latest" }
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            string lastError = string.Empty;

            foreach (var model in candidateModels)
            {
                var endpoint = $"{_settings.Endpoint.TrimEnd('/')}/{model}:generateContent?key={_settings.ApiKey}";

                var requestPayload = new
                {
                    systemInstruction = new
                    {
                        parts = new[]
                        {
                            new { text = systemInstruction }
                        }
                    },
                    contents = new[]
                    {
                        new
                        {
                            role = "user",
                            parts = new[]
                            {
                                new { text = userMessage }
                            }
                        }
                    },
                    generationConfig = new
                    {
                        temperature = _settings.Temperature,
                        maxOutputTokens = 800,
                        topP = 0.95
                    }
                };

                var jsonContent = JsonSerializer.Serialize(requestPayload);
                using var httpRequest = new HttpRequestMessage(HttpMethod.Post, endpoint)
                {
                    Content = new StringContent(jsonContent, Encoding.UTF8, "application/json")
                };

                try
                {
                    using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(3));
                    var response = await _httpClient.SendAsync(httpRequest, cts.Token);
                    var responseBody = await response.Content.ReadAsStringAsync();

                    if (!response.IsSuccessStatusCode)
                    {
                        _logger.LogWarning("Gemini API call failed for model {Model} with status {StatusCode}: {ResponseBody}", model, response.StatusCode, responseBody);
                        lastError = $"Gemini API error ({response.StatusCode}): {responseBody}";
                        continue;
                    }

                    using var doc = JsonDocument.Parse(responseBody);
                    var root = doc.RootElement;

                    if (root.TryGetProperty("candidates", out var candidates) && candidates.GetArrayLength() > 0)
                    {
                        var firstCandidate = candidates[0];
                        if (firstCandidate.TryGetProperty("content", out var content) &&
                            content.TryGetProperty("parts", out var parts) &&
                            parts.GetArrayLength() > 0)
                        {
                            var textPart = parts[0];
                            if (textPart.TryGetProperty("text", out var textElem))
                            {
                                return textElem.GetString() ?? string.Empty;
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Exception calling Gemini API for model {Model}", model);
                    lastError = ex.Message;
                }
            }

            if (!string.IsNullOrWhiteSpace(lastError))
            {
                throw new HttpRequestException(lastError);
            }

            return string.Empty;
        }
    }
}
