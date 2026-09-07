using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClaimShield.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddLiabilitySubmittedToClaim : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "LiabilitySubmitted",
                schema: "dbo",
                table: "Claims",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "LiabilitySubmittedDate",
                schema: "dbo",
                table: "Claims",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LiabilitySubmitted",
                schema: "dbo",
                table: "Claims");

            migrationBuilder.DropColumn(
                name: "LiabilitySubmittedDate",
                schema: "dbo",
                table: "Claims");
        }
    }
}
