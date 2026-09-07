using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClaimShield.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddLiabilityFiguresToClaim : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "LiabilityCompulsoryExcess",
                schema: "dbo",
                table: "Claims",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "LiabilityDepWaiver",
                schema: "dbo",
                table: "Claims",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "LiabilityDepreciationAmount",
                schema: "dbo",
                table: "Claims",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "LiabilityImposedExcess",
                schema: "dbo",
                table: "Claims",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "LiabilityOtherDeduction",
                schema: "dbo",
                table: "Claims",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "LiabilitySalvageDeductions",
                schema: "dbo",
                table: "Claims",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "LiabilityTaxAmount",
                schema: "dbo",
                table: "Claims",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "LiabilityTotalLabour",
                schema: "dbo",
                table: "Claims",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "LiabilityTotalParts",
                schema: "dbo",
                table: "Claims",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "LiabilityTowingAmount",
                schema: "dbo",
                table: "Claims",
                type: "numeric(18,2)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LiabilityCompulsoryExcess",
                schema: "dbo",
                table: "Claims");

            migrationBuilder.DropColumn(
                name: "LiabilityDepWaiver",
                schema: "dbo",
                table: "Claims");

            migrationBuilder.DropColumn(
                name: "LiabilityDepreciationAmount",
                schema: "dbo",
                table: "Claims");

            migrationBuilder.DropColumn(
                name: "LiabilityImposedExcess",
                schema: "dbo",
                table: "Claims");

            migrationBuilder.DropColumn(
                name: "LiabilityOtherDeduction",
                schema: "dbo",
                table: "Claims");

            migrationBuilder.DropColumn(
                name: "LiabilitySalvageDeductions",
                schema: "dbo",
                table: "Claims");

            migrationBuilder.DropColumn(
                name: "LiabilityTaxAmount",
                schema: "dbo",
                table: "Claims");

            migrationBuilder.DropColumn(
                name: "LiabilityTotalLabour",
                schema: "dbo",
                table: "Claims");

            migrationBuilder.DropColumn(
                name: "LiabilityTotalParts",
                schema: "dbo",
                table: "Claims");

            migrationBuilder.DropColumn(
                name: "LiabilityTowingAmount",
                schema: "dbo",
                table: "Claims");
        }
    }
}
