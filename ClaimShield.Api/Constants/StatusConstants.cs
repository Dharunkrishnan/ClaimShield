namespace ClaimShield.Api.Constants
{
    public static class ClaimStatusConstants
    {
        public const int Submitted = 1;

        public const int UnderReview = 2;

        public const int SurveyAssigned = 3;

        public const int SurveyCompleted = 4;

        public const int RepairAssigned = 5;

        public const int RepairInProgress = 6;

        public const int Approved = 7;

        public const int Rejected = 8;

        public const int Settled = 9;

        public const int Closed = 10;

        // Checkpoint 5 (Module 5) - a claim can be put on hold at any
        // non-terminal stage and later resumed back to whatever status
        // it was at (Claim.PriorStatusId), via ClaimDecisionService's
        // PutOnHoldAsync/ResumeAsync - not a dead-end, always reachable
        // and reversible.
        public const int OnHold = 11;
    }

    public static class AssignmentStatusConstants
    {
        public const int Assigned = 1;

        public const int Accepted = 2;

        public const int InProgress = 3;

        public const int Completed = 4;

        public const int Cancelled = 5;
    }

    public static class InspectionModeConstants
    {
        public const int Virtual = 1;

        public const int Physical = 2;
    }

    public static class ClaimDecisionConstants
    {
        public const int Approve = 1;

        // Also doubles as the explicit "Send for Review" action
        // (Checkpoint 5) - always escalates to the Approver queue
        // regardless of AuthorityLimits, same as it already did when
        // chosen from the Surveyor's Approve/Review/Deny decision form.
        public const int Review = 2;

        public const int Deny = 3;

        // Checkpoint 5 (Module 5) additions - all recorded through the
        // same ClaimDecisions table/ClaimDecisionService as Approve/
        // Review/Deny above, so they show up in the same decision-
        // history timeline rather than a separate parallel log.
        public const int Hold = 4;

        public const int Resume = 5;

        public const int ReturnForRework = 6;

        public const int RequestInfo = 7;
    }

    // Manually set by the Surveyor on the Repair Authorization stage -
    // deliberately separate from AssignmentStatusConstants above, which
    // tracks the physical repair WORK's own progress on a
    // RepairAssignment record (one that may not even exist for claims
    // using the newer text-based Workshop/Repair Recommendation flow,
    // rather than a real assigned Repairer account). This tracks
    // whether authorization for that work has itself been given.
    public static class RepairAuthorizationStatusConstants
    {
        public const int Due = 1;

        public const int Approved = 2;

        public const int InProgress = 3;

        public const int Completed = 4;

        public const int Denied = 5;
    }

    // Closure stage - captures WHY a claim is being closed, alongside
    // the existing free-text Remarks. ApprovedAndSettled covers the
    // normal happy-path claim; the others give a real, honest record
    // for claims that never got paid out.
    public static class ClosureReasonConstants
    {
        public const int ApprovedAndSettled = 1;

        public const int Denied = 2;

        public const int WithdrawnByCustomer = 3;

        public const int Duplicate = 4;

        public const int Other = 5;
    }

    // Repair Authorization stage - Closure. Distinct from
    // ClosureReasonConstants above (that's the generic post-Settlement
    // closure flow); this lets a claim be closed directly from Repair
    // Authorization, bypassing Liability entirely.
    public static class RepairAuthClosureReasonConstants
    {
        public const int NonReceiptOfDocuments = 1;

        public const int Withdrawn = 2;

        public const int WithinPolicyExcess = 3;

        public const int WrongRegistrationOrDuplicate = 4;

        public const int Other = 5;
    }

    // Repair Authorization stage - Denial. Same early-exit mechanism
    // as RepairAuthClosureReasonConstants above, for claims that
    // should be denied rather than closed outright.
    public static class RepairAuthDenialReasonConstants
    {
        public const int DamagesNotRelevant = 1;

        public const int NotWithinScopeOfPolicy = 2;

        public const int MisrepresentationFakeDocuments = 3;

        public const int NoValidDrivingLicense = 4;

        public const int NoValidityOnDlExpiry = 5;

        public const int WrongDeclaration = 6;

        public const int Other = 7;
    }

    public static class PaymentStatusConstants
    {
        public const int Pending = 1;

        public const int Processing = 2;

        public const int Paid = 3;

        public const int Failed = 4;

        public const int Cancelled = 5;
    }

    public static class RepairEstimateApprovalStatusConstants
    {
        public const int Approved = 1;

        public const int Rejected = 2;
    }

    public static class PaymentMethodConstants
    {
        public const int Neft = 1;

        public const int Imps = 2;

        public const int Upi = 3;

        public const int Cheque = 4;

        public const int Rtgs = 5;
    }

    // "Payments To" - who the payment is being made out to. Recorded
    // separately from BeneficiaryName/PayeeCode (which capture WHO by
    // name/code) so reporting can group payments by category without
    // parsing free text.
    public static class PayeeTypeConstants
    {
        public const int Customer = 1;

        public const int Repairer = 2;
    }

    // Liability stage - "Invoice favour", who an invoice was raised
    // to/in favour of. A claim can have multiple invoices (see
    // ClaimInvoice), each independently favoured.
    public static class InvoiceFavourConstants
    {
        public const int ClaimShieldPlus = 1;

        public const int Insured = 2;

        public const int Financier = 3;

        public const int CorporateCustomer = 4;
    }

    // TAT Performance dashboard - SLA thresholds (in days) per TAT
    // category. Business-defined values, not derived from anything
    // else in the app.
    public static class TatSlaConstants
    {
        public const int SurveyTatDays = 1;

        public const int RepairApprovalTatDays = 1;

        public const int SettlementVsLastDocTatDays = 7;

        public const int SettlementVsIntimationTatDays = 7;
    }

    // Survey Information's "Type of Repairer" dropdown.
    public static class RepairerTypeConstants
    {
        public const int Preferred = 1;

        public const int Authorized = 2;

        public const int Dealer = 3;

        public const int Local = 4;

        public const int Other = 5;
    }

    public static class PolicyTypeConstants
    {
        public const int Comprehensive = 1;

        public const int ThirdParty = 2;

        public const int StandaloneFire = 3;
    }

    public static class DocumentTypeConstants
    {
        public const int VehicleFront = 1;

        public const int VehicleLeft = 2;

        public const int VehicleBack = 3;

        public const int VehicleRight = 4;

        public const int NumberPlate = 5;

        public const int RegistrationCertificate = 6;

        public const int Other = 7;

        public const int DamagePhoto = 8;

        public const int RepairEstimateDocument = 9;

        public const int WorkshopQuotation = 10;

        public const int SurveyReportDocument = 11;

        // Checkpoint 8 - staff Register Claim form, driver-different-
        // from-policyholder scenario.
        public const int DriverLicense = 12;

        // Inspection page's Photos & Documents section - two distinct
        // damage-photo slots (DamagePhoto above is kept as "Damage 1").
        public const int DamagePhoto2 = 13;
    }

    public static class VehicleLocationConstants
    {
        public const int Home = 1;

        public const int AccidentSpot = 2;

        public const int Workshop = 3;

        public const int Others = 4;
    }

    public static class LossTypeConstants
    {
        public const int MinorAccident = 1;

        public const int PartsTheft = 2;

        public const int NaturalCalamities = 3;

        public const int FullLossTheft = 4;

        public const int MajorAccident = 5;

        public const int Fire = 6;
    }

    public static class RcMatchStatusConstants
    {
        public const int Matched = 1;

        public const int Mismatched = 2;

        public const int Pending = 3;
    }

    public static class InstantClaimDecisionConstants
    {
        public const int Accepted = 1;

        public const int Declined = 2;
    }

    public static class OtpPurposeConstants
    {
        public const string Login = "Login";

        public const string InstantClaimAccept = "InstantClaimAccept";
    }

    public static class OtpVerifyResultConstants
    {
        public const int Success = 1;

        public const int Expired = 2;

        public const int Incorrect = 3;

        public const int LockedOut = 4;

        public const int NotFound = 5;
    }

    // =============================================================
    // Phase 13 - Surveyor Survey & Assessment screen.
    // AssessmentStatusConstants is the fine-grained per-assessment
    // stepper (lives on SurveyReport.AssessmentStatusId) - distinct
    // from the coarser ClaimStatusConstants tracked on Claim.StatusId.
    // =============================================================

    public static class AssessmentStatusConstants
    {
        public const int Assigned = 1;

        public const int SurveyScheduled = 2;

        public const int SurveyInProgress = 3;

        public const int SurveyCompleted = 4;

        public const int AssessmentInProgress = 5;

        public const int AssessmentCompleted = 6;

        public const int SubmittedForReview = 7;
    }

    public static class VehicleConditionConstants
    {
        public const int Excellent = 1;

        public const int Good = 2;

        public const int Fair = 3;

        public const int Poor = 4;

        public const int TotalWreck = 5;
    }

    public static class RepairabilityStatusConstants
    {
        public const int Repairable = 1;

        public const int RepairableMajorWork = 2;

        public const int EconomicallyNotViable = 3;

        public const int NotRepairable = 4;
    }

    public static class SurveyorRecommendationConstants
    {
        public const int Repair = 1;

        public const int Replace = 2;

        public const int CashSettlement = 3;

        public const int TotalLoss = 4;

        public const int ReferToApprover = 5;
    }

    public static class DamageCategoryConstants
    {
        public const int Dent = 1;

        public const int Scratch = 2;

        public const int Crack = 3;

        public const int Broken = 4;

        public const int Missing = 5;

        public const int Other = 6;
    }

    public static class DamageSeverityConstants
    {
        public const int Minor = 1;

        public const int Moderate = 2;

        public const int Major = 3;

        public const int Severe = 4;
    }

    // =============================================================
    // Phase 15 - Claims Handler dashboard. Fixed thresholds (days) for
    // SLA/ageing highlighting on the work queue - not yet Admin-
    // configurable (no existing SLA config concept anywhere in this
    // codebase to build on), but named/centralized here rather than
    // scattered magic numbers so they're easy to find and promote to a
    // real config table later if needed.
    // =============================================================

    public static class SlaConstants
    {
        // "Awaiting Survey" ages from SurveyAssignment.AssignedDate.
        public const int SurveyNearBreachDays = 2;
        public const int SurveyBreachDays = 3;

        // "Awaiting Decision" ages from the survey's completion date.
        public const int DecisionNearBreachDays = 1;
        public const int DecisionBreachDays = 2;

        // "In Repair" ages from the repair assignment's AssignedDate.
        public const int RepairNearBreachDays = 10;
        public const int RepairBreachDays = 15;
    }

    // =============================================================
    // Checkpoint 5 (Module 3) - Initial Reserve at registration.
    // Deterministic percentage of Policy.IDV per Loss Type (rough
    // severity proxy - a total/full loss reserves the whole IDV, a
    // minor accident reserves a small slice of it). Computed once at
    // claim registration and stored on Claim.InitialReserveAmount -
    // never recomputed afterwards, and distinct from the existing
    // Claim.ReserveAmount (set later, at decision-approval time, to
    // the actual decided claim amount).
    // =============================================================

    public static class InitialReservePercentConstants
    {
        public const decimal MinorAccident = 0.10m;

        public const decimal PartsTheft = 0.15m;

        public const decimal NaturalCalamities = 0.40m;

        public const decimal FullLossTheft = 1.00m;

        public const decimal MajorAccident = 0.50m;

        public const decimal Fire = 0.60m;

        // Fallback for any loss type without a specific configured
        // percentage above.
        public const decimal Default = 0.20m;
    }
}