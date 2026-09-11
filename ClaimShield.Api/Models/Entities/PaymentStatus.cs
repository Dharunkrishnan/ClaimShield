using System;
using System.Collections.Generic;

namespace ClaimShield.Api.Models.Entities;

public partial class PaymentStatus
{
    public int PaymentStatusId { get; set; }

    public string PaymentStatusName { get; set; } = null!;

    public bool? IsActive { get; set; }

    public DateTime? CreatedDate { get; set; }

    public virtual ICollection<Payment> Payments { get; set; } = new List<Payment>();
}
