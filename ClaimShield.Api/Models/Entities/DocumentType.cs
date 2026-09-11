using System;
using System.Collections.Generic;

namespace ClaimShield.Api.Models.Entities;

public partial class DocumentType
{
    public int DocumentTypeId { get; set; }

    public string DocumentTypeName { get; set; } = null!;

    public bool? IsMandatory { get; set; }

    public bool? IsActive { get; set; }

    public DateTime? CreatedDate { get; set; }

    public virtual ICollection<ClaimDocument> ClaimDocuments { get; set; } = new List<ClaimDocument>();
}
