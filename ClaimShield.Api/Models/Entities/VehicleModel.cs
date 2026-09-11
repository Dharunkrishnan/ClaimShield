using System;
using System.Collections.Generic;

namespace ClaimShield.Api.Models.Entities;

public partial class VehicleModel
{
    public int ModelId { get; set; }

    public int MakeId { get; set; }

    public string ModelName { get; set; } = null!;

    public bool? IsActive { get; set; }

    public DateTime? CreatedDate { get; set; }

    public virtual VehicleMake Make { get; set; } = null!;

    public virtual ICollection<Vehicle> Vehicles { get; set; } = new List<Vehicle>();
}
