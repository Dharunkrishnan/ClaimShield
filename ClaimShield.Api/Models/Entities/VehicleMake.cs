using System;
using System.Collections.Generic;

namespace ClaimShield.Api.Models.Entities;

public partial class VehicleMake
{
    public int MakeId { get; set; }

    public string MakeName { get; set; } = null!;

    public string? Country { get; set; }

    public bool? IsActive { get; set; }

    public DateTime? CreatedDate { get; set; }

    public virtual ICollection<VehicleModel> VehicleModels { get; set; } = new List<VehicleModel>();

    public virtual ICollection<Vehicle> Vehicles { get; set; } = new List<Vehicle>();
}
