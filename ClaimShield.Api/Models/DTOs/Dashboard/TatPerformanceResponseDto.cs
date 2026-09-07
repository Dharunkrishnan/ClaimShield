namespace ClaimShield.Api.Models.DTOs.Dashboard
{
    public class TatCategoryResultDto
    {
        public string Category { get; set; } = string.Empty;

        public int SlaDays { get; set; }

        // Null when there are zero claims with valid dates for this
        // category in the selected period - distinct from a real 0.0
        // average TAT, which is a very fast turnaround, not "no data".
        public double? AverageTatDays { get; set; }

        public int WithinTatCount { get; set; }

        public int OutsideTatCount { get; set; }

        public int TotalCount => WithinTatCount + OutsideTatCount;
    }

    public class TatPerformanceResponseDto
    {
        public DateTime PeriodStart { get; set; }

        public DateTime PeriodEnd { get; set; }

        public List<TatCategoryResultDto> Categories { get; set; } = new();
    }
}