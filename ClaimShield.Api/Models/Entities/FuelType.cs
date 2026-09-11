using System;
using System.Collections.Generic;

namespace ClaimShield.Api.Models.Entities;

public partial class FuelType
{
    public int FuelTypeId { get; set; }

    public string FuelTypeName { get; set; } = null!;

    public bool? IsActive { get; set; }

    public DateTime? CreatedDate { get; set; }

    public virtual ICollection<Vehicle> Vehicles { get; set; } = new List<Vehicle>();
}
