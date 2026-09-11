using System;
using System.Collections.Generic;

namespace ClaimShield.Api.Models.Entities;

public partial class NotificationType
{
    public int NotificationTypeId { get; set; }

    public string NotificationTypeName { get; set; } = null!;

    public bool? IsActive { get; set; }

    public DateTime? CreatedDate { get; set; }

    public virtual ICollection<Notification> Notifications { get; set; } = new List<Notification>();
}
