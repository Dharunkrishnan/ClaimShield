using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClaimShield.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddThirdPartyDamageAndPoliceReported : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "PoliceReported",
                schema: "dbo",
                table: "ClaimIntakes",
                type: "boolean",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "ThirdPartyDamage",
                schema: "dbo",
                table: "ClaimIntakes",
                type: "boolean",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PoliceReported",
                schema: "dbo",
                table: "ClaimIntakes");

            migrationBuilder.DropColumn(
                name: "ThirdPartyDamage",
                schema: "dbo",
                table: "ClaimIntakes");
        }
    }
}
