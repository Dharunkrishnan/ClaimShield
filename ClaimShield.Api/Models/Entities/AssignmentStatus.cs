using System;
using System.Collections.Generic;

namespace ClaimShield.Api.Models.Entities;

public partial class AssignmentStatus
{
    public int AssignmentStatusId { get; set; }

    public string StatusName { get; set; } = null!;

    public string? Description { get; set; }

    public bool? IsActive { get; set; }

    public DateTime? CreatedDate { get; set; }

    public virtual ICollection<RepairAssignment> RepairAssignments { get; set; } = new List<RepairAssignment>();
}
