using System;
using System.Collections.Generic;

namespace ClaimShield.Api.Models.Entities;

public partial class InsuranceType
{
    public int InsuranceTypeId { get; set; }

    public string InsuranceTypeName { get; set; } = null!;

    public string? Description { get; set; }

    public bool? IsActive { get; set; }

    public DateTime? CreatedDate { get; set; }
}
