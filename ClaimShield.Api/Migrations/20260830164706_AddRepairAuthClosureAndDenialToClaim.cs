using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClaimShield.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddRepairAuthClosureAndDenialToClaim : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "RepairAuthClosureReasonId",
                schema: "dbo",
                table: "Claims",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RepairAuthClosureRemarks",
                schema: "dbo",
                table: "Claims",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RepairAuthDenialReasonId",
                schema: "dbo",
                table: "Claims",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RepairAuthClosureReasonId",
                schema: "dbo",
                table: "Claims");

            migrationBuilder.DropColumn(
                name: "RepairAuthClosureRemarks",
                schema: "dbo",
                table: "Claims");

            migrationBuilder.DropColumn(
                name: "RepairAuthDenialReasonId",
                schema: "dbo",
                table: "Claims");
        }
    }
}
