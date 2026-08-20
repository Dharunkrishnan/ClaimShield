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

        public const int Review = 2;

        public const int Deny = 3;
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

        public const int DrivingLicense = 12;
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
}