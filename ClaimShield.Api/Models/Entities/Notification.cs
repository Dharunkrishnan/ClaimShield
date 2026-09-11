using System;
using System.Collections.Generic;

namespace ClaimShield.Api.Models.Entities;

public partial class Notification
{
    public Guid NotificationId { get; set; }

    public Guid UserId { get; set; }

    public int NotificationTypeId { get; set; }

    public string? Title { get; set; }

    public string? Message { get; set; }

    public bool? IsRead { get; set; }

    public DateTime? CreatedDate { get; set; }

    public virtual NotificationType NotificationType { get; set; } = null!;

    public virtual User User { get; set; } = null!;
}
