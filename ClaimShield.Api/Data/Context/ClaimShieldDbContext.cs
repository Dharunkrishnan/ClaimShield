using ClaimShield.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace ClaimShield.Api.Data.Context
{
    public class ClaimShieldDbContext : DbContext
    {
        public ClaimShieldDbContext(
            DbContextOptions<ClaimShieldDbContext> options)
            : base(options)
        {
        }

        // =========================================================
        // DB SETS
        // =========================================================

        public DbSet<User> Users { get; set; }

        public DbSet<Role> Roles { get; set; }

        public DbSet<Customer> Customers { get; set; }

        public DbSet<Vehicle> Vehicles { get; set; }

        public DbSet<Policy> Policies { get; set; }

        public DbSet<Claim> Claims { get; set; }

        public DbSet<SurveyAssignment> SurveyAssignments { get; set; }

        public DbSet<SurveyReport> SurveyReports { get; set; }

        public DbSet<RepairAssignment> RepairAssignments { get; set; }

        public DbSet<RepairEstimate> RepairEstimates { get; set; }

        public DbSet<ClaimDocument> ClaimDocuments { get; set; }

        public DbSet<Payment> Payments { get; set; }

        public DbSet<ClaimDecision> ClaimDecisions { get; set; }

        public DbSet<ReassessmentComment> ReassessmentComments { get; set; }

        public DbSet<AuthorityLimit> AuthorityLimits { get; set; }

        public DbSet<AuditLog> AuditLogs { get; set; }

        public DbSet<ScoringRule> ScoringRules { get; set; }

        public DbSet<ScoringThreshold> ScoringThresholds { get; set; }

        public DbSet<ClaimScoringResult> ClaimScoringResults { get; set; }

        public DbSet<ClaimIntake> ClaimIntakes { get; set; }

        public DbSet<ClaimRcOcrResult> ClaimRcOcrResults { get; set; }

        public DbSet<InstantClaimRateCard> InstantClaimRateCards { get; set; }

        public DbSet<InstantClaimPartsPricing> InstantClaimPartsPricing { get; set; }

        public DbSet<InstantClaimEligibility> InstantClaimEligibilities { get; set; }

        public DbSet<ClaimEstimateResult> ClaimEstimateResults { get; set; }

        public DbSet<OtpVerification> OtpVerifications { get; set; }

        public DbSet<DamageAssessmentItem> DamageAssessmentItems { get; set; }

        public DbSet<LiabilityDamageItemAdjustment> LiabilityDamageItemAdjustments { get; set; }

        public DbSet<ClaimInvoice> ClaimInvoices { get; set; }

        public DbSet<ClaimSettlement> ClaimSettlements { get; set; }


        // =========================================================
        // MODEL CREATING
        // =========================================================

        protected override void OnModelCreating(
            ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);


            // =====================================================
            // ROLE
            // =====================================================

            modelBuilder.Entity<Role>(entity =>
            {
                entity.ToTable("Roles", "Masters");

                entity.HasKey(e => e.RoleId);

                entity.Property(e => e.RoleName)
                    .HasMaxLength(50)
                    .IsRequired();

                entity.Property(e => e.Description)
                    .HasMaxLength(250);

                entity.Property(e => e.CreatedDate)
                    .HasDefaultValueSql("now()");
            });


            // =====================================================
            // USER (maps to Supabase's public.profiles table, keyed
            // by auth.users.id - see the SupabaseAuthIntegration
            // migration for the FK + auto-creation trigger)
            // =====================================================

            modelBuilder.Entity<User>(entity =>
            {
                entity.ToTable("profiles", "public");

                entity.HasKey(e => e.UserId);

                entity.Property(e => e.UserId)
                    .HasColumnName("id");

                entity.Property(e => e.RoleId)
                    .HasColumnName("role_id");

                entity.Property(e => e.FirstName)
                    .HasColumnName("first_name")
                    .HasMaxLength(200)
                    .IsRequired();

                entity.Property(e => e.LastName)
                    .HasColumnName("last_name")
                    .HasMaxLength(200);

                entity.Property(e => e.Email)
                    .HasColumnName("email")
                    .HasMaxLength(300)
                    .IsRequired();

                entity.Property(e => e.PhoneNumber)
                    .HasColumnName("phone_number")
                    .HasMaxLength(15);

                entity.Property(e => e.ProfileImage)
                    .HasColumnName("profile_image")
                    .HasMaxLength(1000);

                entity.Property(e => e.IsActive)
                    .HasColumnName("is_active")
                    .HasDefaultValue(true);
            });


            // =====================================================
            // CUSTOMER
            // =====================================================

            modelBuilder.Entity<Customer>(entity =>
            {
                entity.ToTable("Customers", "dbo");

                entity.HasKey(e => e.CustomerId);

                entity.Property(e => e.CustomerCode)
                    .HasMaxLength(20)
                    .IsRequired();

                entity.Property(e => e.Gender)
                    .HasMaxLength(10);

                entity.Property(e => e.AadhaarNumber)
                    .HasMaxLength(12);

                entity.Property(e => e.DrivingLicenseNumber)
                    .HasMaxLength(25);

                entity.Property(e => e.AddressLine1)
                    .HasMaxLength(400);

                entity.Property(e => e.AddressLine2)
                    .HasMaxLength(400);

                entity.Property(e => e.City)
                    .HasMaxLength(200);

                entity.Property(e => e.State)
                    .HasMaxLength(200);

                entity.Property(e => e.Pincode)
                    .HasMaxLength(10);

                entity.HasOne(e => e.User)
                    .WithMany()
                    .HasForeignKey(e => e.UserId)
                    .OnDelete(DeleteBehavior.Restrict);
            });


            // =====================================================
            // VEHICLE
            // =====================================================

            modelBuilder.Entity<Vehicle>(entity =>
            {
                entity.ToTable("Vehicles", "dbo");

                entity.HasKey(e => e.VehicleId);

                entity.Property(e => e.RegistrationNumber)
                    .HasMaxLength(20)
                    .IsRequired();

                entity.Property(e => e.ChassisNumber)
                    .HasMaxLength(50)
                    .IsRequired();

                entity.Property(e => e.EngineNumber)
                    .HasMaxLength(50)
                    .IsRequired();

                entity.Property(e => e.Variant)
                    .HasMaxLength(200);

                entity.Property(e => e.VehicleColor)
                    .HasMaxLength(100);

                entity.Property(e => e.RCNumber)
                    .HasMaxLength(30);

                entity.HasOne(e => e.Customer)
                    .WithMany()
                    .HasForeignKey(e => e.CustomerId)
                    .OnDelete(DeleteBehavior.Restrict);
            });


            // =====================================================
            // POLICY
            // =====================================================

            modelBuilder.Entity<Policy>(entity =>
            {
                entity.ToTable("Policies", "dbo");

                entity.HasKey(e => e.PolicyId);

                entity.Property(e => e.PolicyNumber)
                    .HasMaxLength(30)
                    .IsRequired();

                entity.Property(e => e.CoverageAmount)
                    .HasColumnType("decimal(18,2)");

                entity.Property(e => e.PremiumAmount)
                    .HasColumnType("decimal(18,2)");

                entity.HasOne(e => e.Customer)
                    .WithMany()
                    .HasForeignKey(e => e.CustomerId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(e => e.Vehicle)
                    .WithMany()
                    .HasForeignKey(e => e.VehicleId)
                    .OnDelete(DeleteBehavior.Restrict);
            });


            // =====================================================
            // CLAIM
            // =====================================================

            modelBuilder.Entity<Claim>(entity =>
            {
                entity.ToTable("Claims", "dbo");

                entity.HasKey(e => e.ClaimId);

                entity.Property(e => e.ClaimNumber)
                    .HasMaxLength(30)
                    .IsRequired();

                entity.Property(e => e.IncidentLocation)
                    .HasMaxLength(500);

                entity.Property(e => e.EstimatedLossAmount)
                    .HasColumnType("decimal(18,2)");

                entity.Property(e => e.ApprovedAmount)
                    .HasColumnType("decimal(18,2)");

                entity.Property(e => e.ReserveAmount)
                    .HasColumnType("decimal(18,2)");

                entity.Property(e => e.DecisionRemarks)
                    .HasMaxLength(1000);

                entity.HasOne(e => e.Policy)
                    .WithMany()
                    .HasForeignKey(e => e.PolicyId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(e => e.Customer)
                    .WithMany()
                    .HasForeignKey(e => e.CustomerId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(e => e.Vehicle)
                    .WithMany()
                    .HasForeignKey(e => e.VehicleId)
                    .OnDelete(DeleteBehavior.Restrict);
            });


            // =====================================================
            // SURVEY ASSIGNMENT
            // =====================================================

            modelBuilder.Entity<SurveyAssignment>(entity =>
            {
                entity.ToTable(
                    "SurveyAssignments",
                    "dbo");

                entity.HasKey(
                    e => e.SurveyAssignmentId);

                entity.Property(e => e.Remarks)
                    .HasMaxLength(1000);

                entity.Property(e => e.AssignmentStatusId)
                    .IsRequired();

                entity.Property(e => e.InspectionMode)
                    .IsRequired();

                entity.HasOne<Claim>()
                    .WithMany()
                    .HasForeignKey(e => e.ClaimId)
                    .OnDelete(DeleteBehavior.Restrict);
            });


            // =====================================================
            // SURVEY REPORT
            // =====================================================

            modelBuilder.Entity<SurveyReport>(entity =>
            {
                entity.ToTable(
                    "SurveyReports",
                    "dbo");

                entity.HasKey(
                    e => e.SurveyReportId);

                entity.Property(e => e.InspectionDate)
                    .IsRequired();

                entity.Property(e => e.EstimatedRepairCost)
                    .HasColumnType("decimal(18,2)");

                entity.HasOne<SurveyAssignment>()
                    .WithMany()
                    .HasForeignKey(e => e.SurveyAssignmentId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne<Claim>()
                    .WithMany()
                    .HasForeignKey(e => e.ClaimId)
                    .OnDelete(DeleteBehavior.Restrict);

                // ---- Phase 13 - Surveyor Assessment additions ----

                entity.Property(e => e.SurveyLocation)
                    .HasMaxLength(500);

                entity.Property(e => e.PreExistingDamageNotes)
                    .HasMaxLength(2000);

                entity.Property(e => e.EstimatedRepairerName)
                    .HasMaxLength(300);

                entity.Property(e => e.LabourCost)
                    .HasColumnType("decimal(18,2)");

                entity.Property(e => e.PartsCost)
                    .HasColumnType("decimal(18,2)");

                entity.Property(e => e.TowingCharges)
                    .HasColumnType("decimal(18,2)");

                entity.Property(e => e.PaintCost)
                    .HasColumnType("decimal(18,2)");

                entity.Property(e => e.TaxAmount)
                    .HasColumnType("decimal(18,2)");

                entity.Property(e => e.DepreciationAmount)
                    .HasColumnType("decimal(18,2)");

                entity.Property(e => e.CompulsoryExcess)
                    .HasColumnType("decimal(18,2)");

                entity.Property(e => e.SalvageAmount)
                    .HasColumnType("decimal(18,2)");

                entity.Property(e => e.GrossAssessmentAmount)
                    .HasColumnType("decimal(18,2)");

                entity.Property(e => e.NetAssessmentAmount)
                    .HasColumnType("decimal(18,2)");

                entity.Property(e => e.AssessmentStatusId)
                    .IsRequired()
                    .HasDefaultValue(1);
            });


            // =====================================================
            // DAMAGE ASSESSMENT ITEM
            // =====================================================

            modelBuilder.Entity<DamageAssessmentItem>(entity =>
            {
                entity.ToTable(
                    "DamageAssessmentItems",
                    "dbo");

                entity.HasKey(
                    e => e.DamageAssessmentItemId);

                entity.Property(e => e.ComponentName)
                    .HasMaxLength(200)
                    .IsRequired();

                entity.Property(e => e.Remarks)
                    .HasMaxLength(500);

                entity.Property(e => e.RepairRequired)
                    .HasDefaultValue(false);

                entity.Property(e => e.ReplacementRequired)
                    .HasDefaultValue(false);

                entity.HasOne<SurveyReport>()
                    .WithMany()
                    .HasForeignKey(e => e.SurveyReportId)
                    .OnDelete(DeleteBehavior.Restrict);
            });


            // =====================================================
            // LIABILITY DAMAGE ITEM ADJUSTMENT
            // =====================================================

            modelBuilder.Entity<LiabilityDamageItemAdjustment>(entity =>
            {
                entity.ToTable(
                    "LiabilityDamageItemAdjustments",
                    "dbo");

                entity.HasKey(
                    e => e.LiabilityDamageItemAdjustmentId);

                entity.HasOne<DamageAssessmentItem>()
                    .WithMany()
                    .HasForeignKey(e => e.DamageAssessmentItemId)
                    .OnDelete(DeleteBehavior.Restrict);
            });


            // =====================================================
            // CLAIM INVOICE
            // =====================================================

            modelBuilder.Entity<ClaimInvoice>(entity =>
            {
                entity.ToTable(
                    "ClaimInvoices",
                    "dbo");

                entity.HasKey(
                    e => e.ClaimInvoiceId);

                entity.Property(e => e.InvoiceNumber)
                    .HasMaxLength(100)
                    .IsRequired();

                entity.HasOne<Claim>()
                    .WithMany()
                    .HasForeignKey(e => e.ClaimId)
                    .OnDelete(DeleteBehavior.Restrict);
            });


            // =====================================================
            // REPAIR ASSIGNMENT
            // =====================================================

            modelBuilder.Entity<RepairAssignment>(entity =>
            {
                entity.ToTable(
                    "RepairAssignments",
                    "dbo");

                entity.HasKey(
                    e => e.RepairAssignmentId);

                entity.Property(e => e.AssignmentStatusId)
                    .IsRequired();

                entity.Property(e => e.Remarks)
                    .HasMaxLength(500);

                entity.HasOne<Claim>()
                    .WithMany()
                    .HasForeignKey(e => e.ClaimId)
                    .OnDelete(DeleteBehavior.Restrict);
            });


            // =====================================================
            // REPAIR ESTIMATE
            // =====================================================

            modelBuilder.Entity<RepairEstimate>(entity =>
            {
                entity.ToTable(
                    "RepairEstimates",
                    "dbo");

                entity.HasKey(
                    e => e.RepairEstimateId);

                entity.Property(e => e.EstimatedAmount)
                    .HasColumnType("decimal(18,2)")
                    .IsRequired();

                entity.Property(e => e.ApprovedAmount)
                    .HasColumnType("decimal(18,2)");

                entity.HasOne<RepairAssignment>()
                    .WithMany()
                    .HasForeignKey(e => e.RepairAssignmentId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne<Claim>()
                    .WithMany()
                    .HasForeignKey(e => e.ClaimId)
                    .OnDelete(DeleteBehavior.Restrict);
            });


            // =====================================================
            // CLAIM DOCUMENT
            // =====================================================

            modelBuilder.Entity<ClaimDocument>(entity =>
            {
                entity.ToTable(
                    "ClaimDocuments",
                    "dbo");

                entity.HasKey(
                    e => e.ClaimDocumentId);

                entity.Property(e => e.ClaimId)
                    .IsRequired();

                entity.Property(e => e.DocumentTypeId)
                    .IsRequired();

                entity.Property(e => e.FileName)
                    .HasMaxLength(510)
                    .IsRequired();

                entity.Property(e => e.OriginalFileName)
                    .HasMaxLength(510)
                    .IsRequired();

                entity.Property(e => e.FileExtension)
                    .HasMaxLength(20)
                    .IsRequired();

                entity.Property(e => e.FileSize)
                    .IsRequired();

                entity.Property(e => e.FilePath)
                    .HasMaxLength(1000)
                    .IsRequired();

                entity.Property(e => e.ContentType)
                    .HasMaxLength(100)
                    .IsRequired();

                entity.Property(e => e.UploadedBy)
                    .IsRequired();

                entity.Property(e => e.UploadedDate)
                    .IsRequired(false);

                entity.Property(e => e.IsVerified)
                    .IsRequired(false);

                entity.Property(e => e.VerifiedBy)
                    .IsRequired(false);

                entity.Property(e => e.VerifiedDate)
                    .IsRequired(false);

                entity.Property(e => e.Remarks)
                    .HasMaxLength(1000)
                    .IsRequired(false);

                entity.HasOne<Claim>()
                    .WithMany()
                    .HasForeignKey(e => e.ClaimId)
                    .OnDelete(DeleteBehavior.Restrict);
            });


            // =====================================================
            // PAYMENT
            // =====================================================

            modelBuilder.Entity<Payment>(entity =>
            {
                entity.ToTable(
                    "Payments",
                    "dbo");

                entity.HasKey(
                    e => e.PaymentId);

                // -------------------------------------------------
                // CLAIM ID
                // -------------------------------------------------

                entity.Property(e => e.ClaimId)
                    .IsRequired();

                // -------------------------------------------------
                // AMOUNT
                // -------------------------------------------------

                entity.Property(e => e.Amount)
                    .HasColumnType("decimal(18,2)")
                    .IsRequired();

                // -------------------------------------------------
                // PAYMENT STATUS
                // -------------------------------------------------

                entity.Property(e => e.PaymentStatusId)
                    .IsRequired();

                // -------------------------------------------------
                // TRANSACTION REFERENCE
                // -------------------------------------------------

                entity.Property(e => e.TransactionReference)
                    .HasMaxLength(100)
                    .IsRequired(false);

                // -------------------------------------------------
                // PAYMENT DATE
                // -------------------------------------------------

                entity.Property(e => e.PaymentDate)
                    .IsRequired(false);

                // -------------------------------------------------
                // REMARKS
                // -------------------------------------------------

                entity.Property(e => e.Remarks)
                    .HasMaxLength(500)
                    .IsRequired(false);

                // -------------------------------------------------
                // CREATED DATE
                // -------------------------------------------------

                entity.Property(e => e.CreatedDate)
                    .IsRequired(false);

                // -------------------------------------------------
                // CLAIM RELATIONSHIP
                // -------------------------------------------------

                entity.HasOne<Claim>()
                    .WithMany()
                    .HasForeignKey(e => e.ClaimId)
                    .OnDelete(DeleteBehavior.Restrict);
            });


            // =====================================================
            // SCORING RULE
            // =====================================================

            modelBuilder.Entity<ScoringRule>(entity =>
            {
                entity.ToTable(
                    "ScoringRules",
                    "Masters");

                entity.HasKey(
                    e => e.RuleId);

                entity.Property(e => e.RuleId)
                    .ValueGeneratedNever();

                entity.Property(e => e.Category)
                    .IsRequired();

                entity.Property(e => e.ConditionField)
                    .IsRequired();

                entity.Property(e => e.ConditionOperator)
                    .IsRequired();

                entity.Property(e => e.ConditionThreshold)
                    .IsRequired();

                entity.Property(e => e.EffectiveFrom)
                    .IsRequired();
            });


            // =====================================================
            // SCORING THRESHOLD
            // =====================================================

            modelBuilder.Entity<ScoringThreshold>(entity =>
            {
                entity.ToTable(
                    "ScoringThresholds",
                    "Masters");

                entity.HasKey(
                    e => e.ThresholdSet);

                entity.Property(e => e.ThresholdSet)
                    .ValueGeneratedNever();
            });


            // =====================================================
            // CLAIM SCORING RESULT
            // =====================================================

            modelBuilder.Entity<ClaimScoringResult>(entity =>
            {
                entity.ToTable(
                    "ClaimScoringResults",
                    "dbo");

                entity.HasKey(
                    e => e.ClaimScoringResultId);

                entity.Property(e => e.ReasonText)
                    .IsRequired();

                entity.Property(e => e.RuleSetVersion)
                    .IsRequired();

                entity.Property(e => e.ScoredAt)
                    .IsRequired();

                entity.HasOne<Claim>()
                    .WithMany()
                    .HasForeignKey(e => e.ClaimId)
                    .OnDelete(DeleteBehavior.Restrict);
            });


            // =====================================================
            // CLAIM DECISION
            // =====================================================

            modelBuilder.Entity<ClaimDecision>(entity =>
            {
                entity.ToTable(
                    "ClaimDecisions",
                    "dbo");

                entity.HasKey(
                    e => e.ClaimDecisionId);

                entity.Property(e => e.RoleId)
                    .IsRequired();

                entity.Property(e => e.Decision)
                    .IsRequired();

                entity.Property(e => e.Reasoning)
                    .IsRequired();

                entity.Property(e => e.DecisionDate)
                    .IsRequired();

                entity.HasOne<Claim>()
                    .WithMany()
                    .HasForeignKey(e => e.ClaimId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne<User>()
                    .WithMany()
                    .HasForeignKey(e => e.DecidedBy)
                    .OnDelete(DeleteBehavior.Restrict);
            });


            // =====================================================
            // REASSESSMENT COMMENT
            // =====================================================

            modelBuilder.Entity<ReassessmentComment>(entity =>
            {
                entity.ToTable(
                    "ReassessmentComments",
                    "dbo");

                entity.HasKey(
                    e => e.ReassessmentCommentId);

                entity.Property(e => e.Comment)
                    .IsRequired();

                entity.Property(e => e.CreatedDate)
                    .IsRequired();

                entity.HasOne<Claim>()
                    .WithMany()
                    .HasForeignKey(e => e.ClaimId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne<User>()
                    .WithMany()
                    .HasForeignKey(e => e.AuthorId)
                    .OnDelete(DeleteBehavior.Restrict);
            });


            // =====================================================
            // AUTHORITY LIMIT
            // =====================================================

            modelBuilder.Entity<AuthorityLimit>(entity =>
            {
                entity.ToTable(
                    "AuthorityLimits",
                    "Masters");

                entity.HasKey(
                    e => e.RoleId);

                entity.Property(e => e.RoleId)
                    .ValueGeneratedNever();

                entity.Property(e => e.UpdatedDate)
                    .IsRequired();

                entity.HasOne<User>()
                    .WithMany()
                    .HasForeignKey(e => e.UpdatedBy)
                    .OnDelete(DeleteBehavior.Restrict);
            });


            // =====================================================
            // AUDIT LOG
            // =====================================================

            modelBuilder.Entity<AuditLog>(entity =>
            {
                entity.ToTable(
                    "AuditLogs",
                    "dbo");

                entity.HasKey(
                    e => e.AuditLogId);

                entity.Property(e => e.Action)
                    .HasMaxLength(200)
                    .IsRequired();

                entity.Property(e => e.EntityType)
                    .HasMaxLength(100)
                    .IsRequired();

                entity.Property(e => e.EntityId)
                    .IsRequired();

                entity.Property(e => e.Timestamp)
                    .IsRequired();

                entity.HasOne<User>()
                    .WithMany()
                    .HasForeignKey(e => e.UserId)
                    .OnDelete(DeleteBehavior.Restrict);
            });


            // =====================================================
            // CLAIM INTAKE (Phase 12 - Raise Claim wizard)
            // =====================================================

            modelBuilder.Entity<ClaimIntake>(entity =>
            {
                entity.ToTable(
                    "ClaimIntakes",
                    "dbo");

                entity.HasKey(
                    e => e.ClaimId);

                entity.Property(e => e.ClaimId)
                    .ValueGeneratedNever();

                entity.Property(e => e.CreatedDate)
                    .IsRequired();

                entity.HasOne<Claim>()
                    .WithMany()
                    .HasForeignKey(e => e.ClaimId)
                    .OnDelete(DeleteBehavior.Restrict);
            });


            // =====================================================
            // CLAIM RC OCR RESULT
            // =====================================================

            modelBuilder.Entity<ClaimRcOcrResult>(entity =>
            {
                entity.ToTable(
                    "ClaimRcOcrResults",
                    "dbo");

                entity.HasKey(
                    e => e.ClaimId);

                entity.Property(e => e.ClaimId)
                    .ValueGeneratedNever();

                entity.Property(e => e.MatchStatus)
                    .IsRequired();

                entity.Property(e => e.ProcessedAt)
                    .IsRequired();

                entity.HasOne<Claim>()
                    .WithMany()
                    .HasForeignKey(e => e.ClaimId)
                    .OnDelete(DeleteBehavior.Restrict);
            });


            // =====================================================
            // INSTANT CLAIM RATE CARD
            // =====================================================

            modelBuilder.Entity<InstantClaimRateCard>(entity =>
            {
                entity.ToTable(
                    "InstantClaimRateCards",
                    "Masters");

                entity.HasKey(
                    e => e.RateCardId);

                entity.Property(e => e.RateCardId)
                    .ValueGeneratedNever();

                entity.Property(e => e.PartType)
                    .IsRequired();

                entity.Property(e => e.EffectiveFrom)
                    .IsRequired();
            });


            // =====================================================
            // INSTANT CLAIM PARTS PRICING
            // =====================================================

            modelBuilder.Entity<InstantClaimPartsPricing>(entity =>
            {
                entity.ToTable(
                    "InstantClaimPartsPricing",
                    "Masters");

                entity.HasKey(
                    e => e.PartsPricingId);

                entity.Property(e => e.PartsPricingId)
                    .ValueGeneratedNever();

                entity.Property(e => e.PartType)
                    .IsRequired();

                entity.Property(e => e.EffectiveFrom)
                    .IsRequired();
            });


            // =====================================================
            // INSTANT CLAIM ELIGIBILITY
            // =====================================================

            modelBuilder.Entity<InstantClaimEligibility>(entity =>
            {
                entity.ToTable(
                    "InstantClaimEligibility",
                    "Masters");

                entity.HasKey(
                    e => e.EligibilitySet);

                entity.Property(e => e.EligibilitySet)
                    .ValueGeneratedNever();
            });


            // =====================================================
            // CLAIM ESTIMATE RESULT
            // =====================================================

            modelBuilder.Entity<ClaimEstimateResult>(entity =>
            {
                entity.ToTable(
                    "ClaimEstimateResults",
                    "dbo");

                entity.HasKey(
                    e => e.ClaimId);

                entity.Property(e => e.ClaimId)
                    .ValueGeneratedNever();

                entity.Property(e => e.RuleSetVersion)
                    .IsRequired();

                entity.Property(e => e.GeneratedAt)
                    .IsRequired();

                entity.HasOne<Claim>()
                    .WithMany()
                    .HasForeignKey(e => e.ClaimId)
                    .OnDelete(DeleteBehavior.Restrict);
            });


            // =====================================================
            // CLAIM SETTLEMENT (Phase 16)
            // =====================================================

            modelBuilder.Entity<ClaimSettlement>(entity =>
            {
                entity.ToTable(
                    "ClaimSettlements",
                    "dbo");

                entity.HasKey(
                    e => e.ClaimId);

                entity.Property(e => e.ClaimId)
                    .ValueGeneratedNever();

                entity.Property(e => e.ComputedAt)
                    .IsRequired();

                entity.HasOne<Claim>()
                    .WithMany()
                    .HasForeignKey(e => e.ClaimId)
                    .OnDelete(DeleteBehavior.Restrict);
            });


            // =====================================================
            // OTP VERIFICATION
            // =====================================================

            modelBuilder.Entity<OtpVerification>(entity =>
            {
                entity.ToTable(
                    "OtpVerifications",
                    "dbo");

                entity.HasKey(
                    e => e.OtpVerificationId);

                entity.Property(e => e.Purpose)
                    .IsRequired();

                entity.Property(e => e.CodeHash)
                    .IsRequired();

                entity.Property(e => e.ExpiresAt)
                    .IsRequired();

                entity.Property(e => e.CreatedDate)
                    .IsRequired();
            });
        }
    }
}