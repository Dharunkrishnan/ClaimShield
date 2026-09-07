using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ClaimShield.Api.Models.Entities
{
    [Table("Claims")]
    public class Claim
    {
        [Key]
        public Guid ClaimId { get; set; }

        public Guid PolicyId { get; set; }

        public Guid CustomerId { get; set; }

        public Guid VehicleId { get; set; }

        [MaxLength(30)]
        public string ClaimNumber { get; set; } = string.Empty;

        public DateTime IncidentDate { get; set; }

        public DateTime? ReportedDate { get; set; }

        [MaxLength(500)]
        public string? IncidentLocation { get; set; }

        public string? IncidentDescription { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? EstimatedLossAmount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? ApprovedAmount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? ReserveAmount { get; set; }

        public bool? IsFraudSuspected { get; set; }

        [MaxLength(1000)]
        public string? DecisionRemarks { get; set; }

        // Checkpoint 3 - distinct from DecisionRemarks (Approve/Review/
        // Deny reasoning), set only when the claim is actually closed.
        [MaxLength(1000)]
        public string? ClosureRemarks { get; set; }

        // Which category of outcome this closure represents - see
        // ClosureReasonConstants. Separate from ClosureRemarks, which
        // is the free-text explanation for that reason.
        public int? ClosureReasonId { get; set; }

        // Checkpoint 5 (Module 5) - On Hold / Resume. PriorStatusId is
        // populated when a claim goes on hold and consumed (then
        // cleared) when it's resumed, so Resume always restores the
        // exact status the claim was actually at - never a guess.
        public int? PriorStatusId { get; set; }

        [MaxLength(500)]
        public string? HoldReason { get; set; }

        public DateTime? OnHoldDate { get; set; }

        // Checkpoint 5 (Module 5) - Request Additional Information.
        // Non-blocking: Claim.StatusId is untouched while this is set.
        // InfoRequestReason == null means no open request. Cleared (all
        // three set back to null) via ClearInfoRequestAsync once the
        // Customer/Repairer has responded.
        [MaxLength(500)]
        public string? InfoRequestReason { get; set; }

        public DateTime? InfoRequestedDate { get; set; }

        public int? InfoRequestedFromRoleId { get; set; }

        // Checkpoint 5 (Module 3) - optional Repairer pre-assigned by the
        // Claims Handler at registration/intake time, before any real
        // RepairAssignment exists. Purely a hint for later - creating the
        // actual RepairAssignment (post-decision) is unchanged.
        public Guid? PreferredRepairerId { get; set; }

        // Checkpoint 5 (Module 3) - the staff user (Surveyor/Admin) who
        // registered this claim via staff-assisted intake, null for
        // claims raised through the customer's own wizard. Without this,
        // a Claims Handler who registers a claim they aren't (yet)
        // assigned to survey couldn't view it afterward at all -
        // ClaimsController.CanAccessClaimAsync grants them read access
        // via this field.
        public Guid? RegisteredByUserId { get; set; }

        // Checkpoint 8 - set only when the vehicle was not parked
        // safely at the time of loss (staff Register Claim form) -
        // i.e. someone was actually driving it. Null in the normal
        // (parked-safely) case.
        public string? DriverName { get; set; }

        // Driver's date of birth, collected alongside DriverName under
        // the same "vehicle not parked safely" condition.
        public DateTime? DriverDob { get; set; }

        // Staff Register Claim form - a recommended workshop for the
        // repair, entered freehand (distinct from PreferredRepairerId
        // above, which is a specific Repairer user selected from the
        // system's own repairer list).
        [MaxLength(200)]
        public string? WorkshopRecommendation { get; set; }

        // Preferred repairer type, captured at registration time
        // alongside WorkshopRecommendation above - see
        // RepairerTypeConstants (same values used later by
        // SurveyReport.RepairerTypeId during the actual inspection).
        public int? PreferredRepairerTypeId { get; set; }

        // Repair Authorization stage - manually set by the Surveyor,
        // separate from the RepairAssignment's own AssignmentStatusId
        // (see RepairAuthorizationStatusConstants for why).
        public int? RepairAuthorizationStatusId { get; set; }

        public DateTime? RepairAuthorizationDate { get; set; }

        // Repair Authorization stage - Closure/Denial early-exit
        // (bypasses Liability entirely). Only one of these two ever
        // gets set on a given claim - which one is recorded is what
        // distinguishes a Closure from a Denial. See
        // RepairAuthClosureReasonConstants / RepairAuthDenialReasonConstants.
        public int? RepairAuthClosureReasonId { get; set; }

        public int? RepairAuthDenialReasonId { get; set; }

        [MaxLength(1000)]
        public string? RepairAuthClosureRemarks { get; set; }

        // TAT Performance dashboard - the actual completion timestamp
        // of the survey, set when a Surveyor submits their report (see
        // SurveyReportService.SubmitAsync, the same place that already
        // transitions StatusId to SurveyCompleted). Distinct from
        // AssignedDate on SurveyAssignment, which is when the survey
        // was handed out, not when it was finished.
        public DateTime? SurveyDate { get; set; }

        // Liability stage - editable copies of the same figures the
        // Survey Assessment computes, kept as separate fields here
        // (not overwriting SurveyReport's own values) so the Approver
        // can finalize/adjust the liability figures at this stage
        // without altering the surveyor's own historical assessment
        // record. Pre-filled from SurveyReport's values on first load,
        // then editable and saved independently from here on.
        [Column(TypeName = "decimal(18,2)")]
        public decimal? LiabilityTaxAmount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? LiabilityTotalLabour { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? LiabilityTotalParts { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? LiabilityDepWaiver { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? LiabilityDepreciationAmount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? LiabilityCompulsoryExcess { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? LiabilityImposedExcess { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? LiabilitySalvageDeductions { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? LiabilityOtherDeduction { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? LiabilityTowingAmount { get; set; }

        // Liability stage - the deliberate "I'm done, unlock Approval"
        // action, same pattern as RepairAuthorizationStatusId unlocking
        // Liability itself. Distinct from Claim.StatusId, which can
        // independently reach Approved through the repair estimate
        // approval flow - this tracks whether Liability specifically
        // has been submitted, not the claim's own lifecycle status.
        public bool LiabilitySubmitted { get; set; }

        public DateTime? LiabilitySubmittedDate { get; set; }

        // Checkpoint 5 (Module 3) - deterministic reserve computed once
        // at registration (see InitialReservePercentConstants). Distinct
        // from ReserveAmount above, which is set later at decision time.
        [Column(TypeName = "decimal(18,2)")]
        public decimal? InitialReserveAmount { get; set; }

        public DateTime? CreatedDate { get; set; }

        public DateTime? UpdatedDate { get; set; }

        public int? StatusId { get; set; }

        // Navigation Properties
        public Policy? Policy { get; set; }

        public Customer? Customer { get; set; }

        public Vehicle? Vehicle { get; set; }
    }
}