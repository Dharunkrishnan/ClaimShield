using System;
using System.Collections.Generic;

namespace ClaimShield.Api.Models.Entities;

public partial class DamageType
{
    public int DamageTypeId { get; set; }

    public string DamageTypeName { get; set; } = null!;

    public string? Description { get; set; }

    public bool? IsActive { get; set; }

    public DateTime? CreatedDate { get; set; }

    public virtual ICollection<SurveyReport> SurveyReports { get; set; } = new List<SurveyReport>();
}
