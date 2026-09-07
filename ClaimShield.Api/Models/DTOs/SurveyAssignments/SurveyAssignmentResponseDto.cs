namespace ClaimShield.Api.Models.DTOs.SurveyAssignments
{
    public class SurveyAssignmentResponseDto
    {
        public Guid SurveyAssignmentId { get; set; }

        public Guid ClaimId { get; set; }

        public Guid SurveyorId { get; set; }

        public Guid AssignedBy { get; set; }

        public DateTime? AssignedDate { get; set; }

        public DateTime? DueDate { get; set; }

        public int AssignmentStatusId { get; set; }

        public int InspectionMode { get; set; }

        public string? Remarks { get; set; }

        public DateTime? CreatedDate { get; set; }

        public DateTime? UpdatedDate { get; set; }
    }
}
