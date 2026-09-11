using System;
using System.Collections.Generic;

namespace ClaimShield.Api.Models.Entities;

public partial class ClaimStatus
{
    public int StatusId { get; set; }

    public string StatusName { get; set; } = null!;

    public string? Description { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedDate { get; set; }

    public virtual ICollection<Claim> Claims { get; set; } = new List<Claim>();
}
