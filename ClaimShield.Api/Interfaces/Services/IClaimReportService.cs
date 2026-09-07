namespace ClaimShield.Api.Interfaces.Services
{
    public interface IClaimReportService
    {
        // statusFilter: "all" | "registered" | "paid" | "outstanding"
        // (case-insensitive). Returns UTF-8 CSV bytes (with a BOM so
        // Excel opens it correctly), scoped the same way the Claims
        // Handler dashboard is - a Surveyor sees only claims they have a
        // SurveyAssignment for, an Admin sees everything.
        Task<byte[]> GenerateClaimsCsvAsync(
            Guid userId,
            int roleId,
            string statusFilter);
    }
}
