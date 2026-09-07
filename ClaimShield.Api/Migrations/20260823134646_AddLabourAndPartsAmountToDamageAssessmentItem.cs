using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClaimShield.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddLabourAndPartsAmountToDamageAssessmentItem : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "LabourAmount",
                schema: "dbo",
                table: "DamageAssessmentItems",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PartsAmount",
                schema: "dbo",
                table: "DamageAssessmentItems",
                type: "numeric(18,2)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LabourAmount",
                schema: "dbo",
                table: "DamageAssessmentItems");

            migrationBuilder.DropColumn(
                name: "PartsAmount",
                schema: "dbo",
                table: "DamageAssessmentItems");
        }
    }
}
