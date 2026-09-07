namespace ClaimShield.Api.Models.DTOs.ClaimsHandlerDashboard
{
    // Checkpoint 7 - one row in the "All my claims, any status" list.
    // Category is computed server-side, deterministically, from the
    // real Claim.StatusId - never invented or guessed on the frontend.
    public class ClaimsHandlerClaimListItemDto
    {
        public Guid ClaimId { get; set; }

        public string ClaimNumber { get; set; } = string.Empty;

        public string? CustomerName { get; set; }

        public int StatusId { get; set; }

        public decimal? EstimatedLossAmount { get; set; }

        public DateTime? RelevantDate { get; set; }

        public string? PolicyNumber { get; set; }

        public string? VehicleNumber { get; set; }

        // One of: "Active", "PendingAction", "InProgress", "UnderReview",
        // "OnHold", "Completed", "Closed". "All" is not a category value
        // here - the frontend's "All Claims" tab simply shows every row
        // unfiltered.
        public string Category { get; set; } = string.Empty;
    }
}