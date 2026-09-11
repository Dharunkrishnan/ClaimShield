using System;
using System.Collections.Generic;

namespace ClaimShield.Api.Models.Entities;

public partial class Role
{
    public int RoleId { get; set; }

    public string RoleName { get; set; } = null!;

    public string? Description { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedDate { get; set; }

    public virtual ICollection<User> Users { get; set; } = new List<User>();
}
