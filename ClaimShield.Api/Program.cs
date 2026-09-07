using ClaimShield.Api.AI.Interfaces;
using ClaimShield.Api.AI.Services;
using ClaimShield.Api.Authentication;
using ClaimShield.Api.Data.Context;
using ClaimShield.Api.Interfaces.Repositories;
using ClaimShield.Api.Interfaces.Services;
using ClaimShield.Api.Repositories;
using ClaimShield.Api.Services;

using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// ============================================================
// CONTROLLERS
// ============================================================

builder.Services.AddControllers();

// ============================================================
// DATABASE
// ============================================================

builder.Services.AddDbContext<ClaimShieldDbContext>(
    options =>
        options.UseNpgsql(
            builder.Configuration.GetConnectionString(
                "SupabaseConnection"),
            npgsqlOptions => npgsqlOptions.EnableRetryOnFailure()
        )
);

// ============================================================
// SUPABASE JWT CONFIGURATION
// ============================================================
//
// Supabase's Auth server signs tokens asymmetrically (ES256) and
// only exposes a raw JWKS document - no OIDC discovery document -
// so token validation is wired to that JWKS URL directly via
// SupabaseJwksConfigurationRetriever instead of the usual
// `Authority` auto-discovery.
//

var supabaseUrl =
    builder.Configuration["Supabase:Url"];

if (string.IsNullOrWhiteSpace(supabaseUrl))
{
    throw new InvalidOperationException(
        "Supabase:Url is not configured.");
}

var supabaseAuthIssuer =
    $"{supabaseUrl}/auth/v1";

var supabaseJwksUri =
    $"{supabaseAuthIssuer}/.well-known/jwks.json";

// ============================================================
// JWT AUTHENTICATION
// ============================================================

builder.Services
    .AddAuthentication(
        JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.ConfigurationManager =
            new ConfigurationManager<OpenIdConnectConfiguration>(
                supabaseJwksUri,
                new SupabaseJwksConfigurationRetriever(),
                new HttpDocumentRetriever
                {
                    RequireHttps = true
                });

        options.TokenValidationParameters =
            new TokenValidationParameters
            {
                ValidateIssuer = true,

                ValidIssuer =
                    supabaseAuthIssuer,

                ValidateAudience = true,

                ValidAudience =
                    "authenticated",

                ValidateLifetime = true,

                ValidateIssuerSigningKey = true
            };
    });

// ============================================================
// AUTHORIZATION
// ============================================================

builder.Services.AddAuthorization();

// ------------------------------------------------------------
// Role claims transformation (resolves the app's Customer/
// Surveyor/Approver/Admin role from public.profiles on every
// request - Supabase's own JWT role claim is just "authenticated"
// and isn't this app's role).
// ------------------------------------------------------------

builder.Services.AddTransient<
    IClaimsTransformation,
    SupabaseRoleClaimsTransformation>();

// ============================================================
// HTTP CONTEXT ACCESSOR
// ============================================================
//
// Required by MockAiService to read the authenticated
// user's JWT identity and verify claim ownership.
//

builder.Services.AddHttpContextAccessor();

// ------------------------------------------------------------
// Current User (identity from the authenticated JWT claims)
// ------------------------------------------------------------

builder.Services.AddScoped<
    ICurrentUserService,
    CurrentUserService>();

// ============================================================
// SWAGGER
// ============================================================

builder.Services.AddEndpointsApiExplorer();

builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc(
        "v1",
        new OpenApiInfo
        {
            Title =
                "ClaimShield API",

            Version =
                "v1",

            Description =
                "ClaimShield Insurance Claim Management API"
        });

    // --------------------------------------------------------
    // JWT SECURITY DEFINITION
    // --------------------------------------------------------

    options.AddSecurityDefinition(
        "Bearer",
        new OpenApiSecurityScheme
        {
            Name =
                "Authorization",

            Type =
                SecuritySchemeType.Http,

            Scheme =
                "bearer",

            BearerFormat =
                "JWT",

            In =
                ParameterLocation.Header,

            Description =
                "Enter your JWT token. Example: Bearer {token}"
        });

    // --------------------------------------------------------
    // JWT SECURITY REQUIREMENT
    // --------------------------------------------------------

    options.AddSecurityRequirement(
        new OpenApiSecurityRequirement
        {
            {
                new OpenApiSecurityScheme
                {
                    Reference =
                        new OpenApiReference
                        {
                            Type =
                                ReferenceType.SecurityScheme,

                            Id =
                                "Bearer"
                        }
                },

                Array.Empty<string>()
            }
        });
});

// ============================================================
// REPOSITORIES
// ============================================================

// ------------------------------------------------------------
// Users
// ------------------------------------------------------------
//
// Required by MockAiService to resolve:
//
// SurveyorId -> User -> Surveyor Name
//
// RepairerId -> User -> Repairer Name
//

builder.Services.AddScoped<
    IUserRepository,
    UserRepository>();

// ------------------------------------------------------------
// Customer
// ------------------------------------------------------------
//
// Required by MockAiService to verify:
//
// JWT UserId
//      ↓
// Customer.UserId
//      ↓
// Claim.CustomerId
//

builder.Services.AddScoped<
    ICustomerRepository,
    CustomerRepository>();

// ------------------------------------------------------------
// Claims
// ------------------------------------------------------------

builder.Services.AddScoped<
    IClaimRepository,
    ClaimRepository>();

// ------------------------------------------------------------
// Claim Documents
// ------------------------------------------------------------

builder.Services.AddScoped<
    IClaimDocumentRepository,
    ClaimDocumentRepository>();

// ------------------------------------------------------------
// Payments
// ------------------------------------------------------------

builder.Services.AddScoped<
    IPaymentRepository,
    PaymentRepository>();

// ------------------------------------------------------------
// Survey Assignments
// ------------------------------------------------------------

builder.Services.AddScoped<
    ISurveyAssignmentRepository,
    SurveyAssignmentRepository>();

// ------------------------------------------------------------
// Repair Assignments
// ------------------------------------------------------------

builder.Services.AddScoped<
    IRepairAssignmentRepository,
    RepairAssignmentRepository>();

// ------------------------------------------------------------
// Repair Estimates
// ------------------------------------------------------------

builder.Services.AddScoped<
    IRepairEstimateRepository,
    RepairEstimateRepository>();

// ------------------------------------------------------------
// Survey Reports
// ------------------------------------------------------------

builder.Services.AddScoped<
    ISurveyReportRepository,
    SurveyReportRepository>();

// ------------------------------------------------------------
// Policies
// ------------------------------------------------------------

builder.Services.AddScoped<
    IPolicyRepository,
    PolicyRepository>();

// ------------------------------------------------------------
// Vehicles
// ------------------------------------------------------------

builder.Services.AddScoped<
    IVehicleRepository,
    VehicleRepository>();

// ------------------------------------------------------------
// Roles
// ------------------------------------------------------------

builder.Services.AddScoped<
    IRoleRepository,
    RoleRepository>();

// ============================================================
// SERVICES
// ============================================================

// ------------------------------------------------------------
// Customer
// ------------------------------------------------------------

builder.Services.AddScoped<
    ICustomerService,
    CustomerService>();

// ------------------------------------------------------------
// Claims
// ------------------------------------------------------------

builder.Services.AddScoped<
    IClaimService,
    ClaimService>();

// ------------------------------------------------------------
// Claim Documents
// ------------------------------------------------------------

builder.Services.AddScoped<
    IClaimDocumentService,
    ClaimDocumentService>();

// ------------------------------------------------------------
// Payments
// ------------------------------------------------------------

builder.Services.AddScoped<
    IPaymentService,
    PaymentService>();

// ------------------------------------------------------------
// Survey Assignments
// ------------------------------------------------------------

builder.Services.AddScoped<
    ISurveyAssignmentService,
    SurveyAssignmentService>();

// ------------------------------------------------------------
// Repair Assignments
// ------------------------------------------------------------

builder.Services.AddScoped<
    IRepairAssignmentService,
    RepairAssignmentService>();

// ------------------------------------------------------------
// Repair Estimates
// ------------------------------------------------------------

builder.Services.AddScoped<
    IRepairEstimateService,
    RepairEstimateService>();

// ------------------------------------------------------------
// Survey Reports
// ------------------------------------------------------------

builder.Services.AddScoped<
    ISurveyReportService,
    SurveyReportService>();

// ------------------------------------------------------------
// Claim Approval
// ------------------------------------------------------------

builder.Services.AddScoped<
    IClaimApprovalService,
    ClaimApprovalService>();

// ------------------------------------------------------------
// Claim AI Scoring
// ------------------------------------------------------------

builder.Services.AddScoped<
    IClaimScoringService,
    ClaimScoringService>();

builder.Services.AddScoped<
    IScoringRuleService,
    ScoringRuleService>();

builder.Services.AddScoped<
    IScoringThresholdService,
    ScoringThresholdService>();

// ------------------------------------------------------------
// Dashboard
// ------------------------------------------------------------

builder.Services.AddScoped<
    IDashboardService,
    DashboardService>();

// ------------------------------------------------------------
// OTP (Phase 12 - shared by Login and Instant Claim Accept)
// ------------------------------------------------------------

builder.Services.AddScoped<
    IOtpService,
    OtpService>();

// ------------------------------------------------------------
// OCR (Phase 12 - RC/plate photo extraction)
// ------------------------------------------------------------

builder.Services.AddScoped<
    IOcrService,
    TesseractOcrService>();

// ------------------------------------------------------------
// Instant Claim (Phase 12 - Estimate Engine + config)
// ------------------------------------------------------------

builder.Services.AddScoped<
    IEstimateEngineService,
    EstimateEngineService>();

builder.Services.AddScoped<
    IInstantClaimConfigService,
    InstantClaimConfigService>();

builder.Services.AddScoped<
    IClaimRaiseService,
    ClaimRaiseService>();

// ------------------------------------------------------------
// Audit Log
// ------------------------------------------------------------

builder.Services.AddScoped<
    IAuditLogService,
    AuditLogService>();

// ------------------------------------------------------------
// Claim Decisions (Surveyor maker-checker workflow)
// ------------------------------------------------------------

builder.Services.AddScoped<
    IClaimDecisionService,
    ClaimDecisionService>();

// ------------------------------------------------------------
// Claims Handler Dashboard (Phase 15)
// ------------------------------------------------------------

builder.Services.AddScoped<
    IClaimsHandlerDashboardService,
    ClaimsHandlerDashboardService>();

// ------------------------------------------------------------
// Claim Settlement (Phase 16)
// ------------------------------------------------------------

builder.Services.AddScoped<
    IClaimSettlementService,
    ClaimSettlementService>();

// ------------------------------------------------------------
// Claim Invoices (Liability stage - Invoice Particulars)
// ------------------------------------------------------------

builder.Services.AddScoped<
    IClaimInvoiceService,
    ClaimInvoiceService>();

// ------------------------------------------------------------
// Claim Reports (Checkpoint 3)
// ------------------------------------------------------------

builder.Services.AddScoped<
    IClaimReportService,
    ClaimReportService>();

// ------------------------------------------------------------
// Reassessment Comments
// ------------------------------------------------------------

builder.Services.AddScoped<
    IReassessmentCommentService,
    ReassessmentCommentService>();

// ------------------------------------------------------------
// Authority Limits
// ------------------------------------------------------------

builder.Services.AddScoped<
    IAuthorityLimitService,
    AuthorityLimitService>();

// ------------------------------------------------------------
// Users
// ------------------------------------------------------------

builder.Services.AddScoped<
    IUserService,
    UserService>();

// ------------------------------------------------------------
// Supabase Admin API (user provisioning)
// ------------------------------------------------------------

builder.Services.AddHttpClient<
    ISupabaseAdminService,
    SupabaseAdminService>();

// ------------------------------------------------------------
// Supabase Storage API (claim document uploads/downloads)
// ------------------------------------------------------------

builder.Services.AddHttpClient<
    ISupabaseStorageService,
    SupabaseStorageService>();

// ------------------------------------------------------------
// Roles
// ------------------------------------------------------------

builder.Services.AddScoped<
    IRoleService,
    RoleService>();

// ------------------------------------------------------------
// Vehicles
// ------------------------------------------------------------

builder.Services.AddScoped<
    IVehicleService,
    VehicleService>();

// ------------------------------------------------------------
// Policies
// ------------------------------------------------------------

builder.Services.AddScoped<
    IPolicyService,
    PolicyService>();

// ------------------------------------------------------------
// Claim Closure
// ------------------------------------------------------------

builder.Services.AddScoped<
    IClaimClosureService,
    ClaimClosureService>();

// ============================================================
// AI SERVICE
// ============================================================
//
// Development AI uses ClaimShield's existing services.
// No OpenAI API key is required.
//

builder.Services.AddScoped<
    IAiService,
    MockAiService>();

// Phase 16 - Decision & Review support (rule-based, same AI/ folder,
// same honesty-first philosophy as MockAiService above).
builder.Services.AddScoped<
    IDecisionSupportService,
    DecisionSupportService>();

// ============================================================
// CORS
// ============================================================

builder.Services.AddCors(
    options =>
    {
        options.AddPolicy(
            "ClaimShieldPolicy",
            policy =>
            {
                policy
                    .AllowAnyOrigin()
                    .AllowAnyHeader()
                    .AllowAnyMethod();
            });
    });

// ============================================================
// BUILD APPLICATION
// ============================================================

var app =
    builder.Build();

// ============================================================
// DEFAULT FILES
// ============================================================

app.UseDefaultFiles();

// ============================================================
// STATIC FILES
// ============================================================

app.UseStaticFiles();

// ============================================================
// SWAGGER
// ============================================================

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();

    app.UseSwagger();

    app.UseSwaggerUI(
        options =>
        {
            options.DocumentTitle =
                "ClaimShield API";

            options.SwaggerEndpoint(
                "/swagger/v1/swagger.json",
                "ClaimShield API v1");
        });
}

// ============================================================
// HTTPS
// ============================================================

app.UseHttpsRedirection();

// ============================================================
// CORS
// ============================================================

app.UseCors(
    "ClaimShieldPolicy");

// ============================================================
// AUTHENTICATION
// ============================================================

app.UseAuthentication();

// ============================================================
// AUTHORIZATION
// ============================================================

app.UseAuthorization();

// ============================================================
// CONTROLLERS
// ============================================================

app.MapControllers();

// ============================================================
// RUN
// ============================================================

app.Run();