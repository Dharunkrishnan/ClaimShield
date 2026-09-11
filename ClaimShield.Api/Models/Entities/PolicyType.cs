using System;
using System.Collections.Generic;

namespace ClaimShield.Api.Models.Entities;

public partial class PolicyType
{
    public int PolicyTypeId { get; set; }

    public string PolicyTypeName { get; set; } = null!;

    public string? Description { get; set; }

    public bool? IsActive { get; set; }

    public DateTime? CreatedDate { get; set; }

    public virtual ICollection<Policy> Policies { get; set; } = new List<Policy>();
}
