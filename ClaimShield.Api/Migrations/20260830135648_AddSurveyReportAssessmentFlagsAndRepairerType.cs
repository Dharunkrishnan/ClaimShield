using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClaimShield.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddSurveyReportAssessmentFlagsAndRepairerType : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "PreExistingDamageSuspected",
                schema: "dbo",
                table: "SurveyReports",
                type: "boolean",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RepairerTypeId",
                schema: "dbo",
                table: "SurveyReports",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "SurveyorFlaggedSuspicious",
                schema: "dbo",
                table: "SurveyReports",
                type: "boolean",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PreExistingDamageSuspected",
                schema: "dbo",
                table: "SurveyReports");

            migrationBuilder.DropColumn(
                name: "RepairerTypeId",
                schema: "dbo",
                table: "SurveyReports");

            migrationBuilder.DropColumn(
                name: "SurveyorFlaggedSuspicious",
                schema: "dbo",
                table: "SurveyReports");
        }
    }
}
