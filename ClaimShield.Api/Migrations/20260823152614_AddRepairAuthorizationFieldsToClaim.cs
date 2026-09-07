using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClaimShield.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddRepairAuthorizationFieldsToClaim : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "RepairAuthorizationDate",
                schema: "dbo",
                table: "Claims",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RepairAuthorizationStatusId",
                schema: "dbo",
                table: "Claims",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RepairAuthorizationDate",
                schema: "dbo",
                table: "Claims");

            migrationBuilder.DropColumn(
                name: "RepairAuthorizationStatusId",
                schema: "dbo",
                table: "Claims");
        }
    }
}
