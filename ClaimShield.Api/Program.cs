using ClaimShield.Api.AI.Configuration;
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

// Initialize Tesseract & Leptonica native dependencies early before services start
TesseractOcrService.InitializeNativeEnvironment();

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
            builder.Configuration.GetConnectionString("SupabaseConnection")
                ?? builder.Configuration.GetConnectionString("DefaultConnection"),
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

        options.Events = new JwtBearerEvents
        {
            OnAuthenticationFailed = context =>
            {
                Console.WriteLine($"[JWT AuthFailed] Exception: {context.Exception}");
                return Task.CompletedTask;
            }
        };
    });

Console.WriteLine($"[STARTUP] Configured Supabase Auth Issuer: {supabaseAuthIssuer}");

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
// In-Memory Caching & Performance
// ------------------------------------------------------------

builder.Services.AddMemoryCache();

// ------------------------------------------------------------
// OCR (Phase 12 - RC/plate photo extraction)
// ------------------------------------------------------------

builder.Services.AddSingleton<
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
// AI SERVICE (Google Gemini with Resilient Fallback)
// ============================================================

builder.Services.Configure<GeminiSettings>(
    builder.Configuration.GetSection("Gemini"));

builder.Services.AddScoped<MockAiService>();
builder.Services.AddHttpClient<GeminiAiService>();
builder.Services.AddScoped<IAiService, GeminiAiService>();

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
                    .SetIsOriginAllowed(_ => true)
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
// CORS (Must run first before static files, auth, & routing)
// ============================================================

app.UseCors("ClaimShieldPolicy");

app.Use(async (context, next) =>
{
    try
    {
        await next();
    }
    catch (Exception ex)
    {
        if (!context.Response.HasStarted)
        {
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsJsonAsync(new
            {
                success = false,
                message = "An unexpected server error occurred.",
                error = ex.Message
            });
        }
    }
});

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
}

app.UseSwagger();

app.UseSwaggerUI(options =>
{
    options.DocumentTitle = "ClaimShield API";

    options.SwaggerEndpoint(
        "/swagger/v1/swagger.json",
        "ClaimShield API v1");
});

// ============================================================
// HTTPS
// ============================================================

// Render handles HTTPS.
// app.UseHttpsRedirection();

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
app.MapGet("/", () => Results.Ok(new
{
    message = "ClaimShield API is running",
    status = "healthy"
}));

// ------------------------------------------------------------
// TEMPORARY diagnostic endpoint - lets us check directly in a
// browser which native OCR library files actually exist on the
// deployed server, instead of digging through Render's logs.
// Safe to remove once the Tesseract library issue is confirmed
// fixed.
// ------------------------------------------------------------
app.MapGet("/api/diagnostics/ocr-libs", () =>
{
    var searchDirs = new[] { "/usr/lib/x86_64-linux-gnu", "/usr/lib", "/usr/local/lib", "/app" };
    var found = new List<string>();

    foreach (var dir in searchDirs)
    {
        if (!Directory.Exists(dir)) continue;

        found.AddRange(
            Directory.GetFiles(dir, "liblept*.so*", SearchOption.TopDirectoryOnly));
        found.AddRange(
            Directory.GetFiles(dir, "libtesseract*.so*", SearchOption.TopDirectoryOnly));
    }

    var expectedLeptonica = "/usr/lib/x86_64-linux-gnu/libleptonica-1.82.0.so";
    var expectedTesseract = "/usr/lib/x86_64-linux-gnu/libtesseract50.so";
    var expectedLeptonicaInApp = "/app/libleptonica-1.82.0.so";
    var expectedTesseractInApp = "/app/libtesseract50.so";
    var expectedLeptonicaInX64 = "/app/x64/libleptonica-1.82.0.so";
    var expectedTesseractInX64 = "/app/x64/libtesseract50.so";

    return Results.Ok(new
    {
        allFoundFiles = found,
        expectedLeptonicaExists = System.IO.File.Exists(expectedLeptonica),
        expectedTesseractExists = System.IO.File.Exists(expectedTesseract),
        expectedLeptonicaExistsInApp = System.IO.File.Exists(expectedLeptonicaInApp),
        expectedTesseractExistsInApp = System.IO.File.Exists(expectedTesseractInApp),
        expectedLeptonicaExistsInX64 = System.IO.File.Exists(expectedLeptonicaInX64),
        expectedTesseractExistsInX64 = System.IO.File.Exists(expectedTesseractInX64),
        appBaseDirectory = AppContext.BaseDirectory,
    });
});

app.MapGet("/api/diagnostics/test-ocr", () =>
{
    TesseractOcrService.InitializeNativeEnvironment();
    var (leptHandle, tessHandle) = TesseractOcrService.GetNativeHandles();

    var envTessPrefix = Environment.GetEnvironmentVariable("TESSDATA_PREFIX");
    var searchDirs = new[]
    {
        "/app/tessdata",
        "/usr/share/tesseract-ocr/5/tessdata",
        "/usr/share/tesseract-ocr/4.00/tessdata",
        "/usr/share/tessdata",
        AppContext.BaseDirectory,
        Path.Combine(AppContext.BaseDirectory, "x64")
    };

    var pathsChecked = searchDirs.Select(d => new
    {
        dir = d,
        exists = Directory.Exists(d),
        files = Directory.Exists(d) ? Directory.GetFiles(d).Select(Path.GetFileName).ToArray() : Array.Empty<string>()
    }).ToList();

    string? engineError = null;
    string? engineSuccess = null;

    try
    {
        using var engine = new Tesseract.TesseractEngine("/app/tessdata", "eng", Tesseract.EngineMode.Default);
        engineSuccess = "TesseractEngine created successfully!";
    }
    catch (Exception ex)
    {
        engineError = $"{ex.GetType().FullName}: {ex.Message} --> Inner: {ex.InnerException?.Message}";
    }

    return Results.Ok(new
    {
        envTessPrefix,
        leptHandle = leptHandle.ToString(),
        tessHandle = tessHandle.ToString(),
        pathsChecked,
        engineSuccess,
        engineError
    });
});

app.Run();