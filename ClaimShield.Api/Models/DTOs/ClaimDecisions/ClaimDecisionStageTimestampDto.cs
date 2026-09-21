namespace ClaimShield.Api.Models.DTOs.ClaimDecisions
{
    // Deliberately narrower than ClaimDecisionResponseDto - role,
    // decision, and date only. No Reasoning or AiScoresSnapshot, so
    // this is safe to expose to roles (Surveyor, Repairer) who aren't
    // allowed to see the full decision history via
    // ClaimDecisionsController.GetHistory. Purpose-built for the claim-
    // workflow sidebar's per-stage "completed on" timestamps
    // (ProtectedLayout.tsx), which only need to know who decided what,
    // and when.
    public class ClaimDecisionStageTimestampDto
    {
        public int RoleId { get; set; }

        public int Decision { get; set; }

        public DateTime DecisionDate { get; set; }
    }
}
