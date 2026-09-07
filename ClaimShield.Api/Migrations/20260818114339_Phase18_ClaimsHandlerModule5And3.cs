using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClaimShield.Api.Migrations
{
    /// <inheritdoc />
    public partial class Phase18_ClaimsHandlerModule5And3 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "HoldReason",
                schema: "dbo",
                table: "Claims",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "InfoRequestReason",
                schema: "dbo",
                table: "Claims",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "InfoRequestedDate",
                schema: "dbo",
                table: "Claims",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "InfoRequestedFromRoleId",
                schema: "dbo",
                table: "Claims",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "InitialReserveAmount",
                schema: "dbo",
                table: "Claims",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "OnHoldDate",
                schema: "dbo",
                table: "Claims",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "PreferredRepairerId",
                schema: "dbo",
                table: "Claims",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PriorStatusId",
                schema: "dbo",
                table: "Claims",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "HoldReason",
                schema: "dbo",
                table: "Claims");

            migrationBuilder.DropColumn(
                name: "InfoRequestReason",
                schema: "dbo",
                table: "Claims");

            migrationBuilder.DropColumn(
                name: "InfoRequestedDate",
                schema: "dbo",
                table: "Claims");

            migrationBuilder.DropColumn(
                name: "InfoRequestedFromRoleId",
                schema: "dbo",
                table: "Claims");

            migrationBuilder.DropColumn(
                name: "InitialReserveAmount",
                schema: "dbo",
                table: "Claims");

            migrationBuilder.DropColumn(
                name: "OnHoldDate",
                schema: "dbo",
                table: "Claims");

            migrationBuilder.DropColumn(
                name: "PreferredRepairerId",
                schema: "dbo",
                table: "Claims");

            migrationBuilder.DropColumn(
                name: "PriorStatusId",
                schema: "dbo",
                table: "Claims");
        }
    }
}
