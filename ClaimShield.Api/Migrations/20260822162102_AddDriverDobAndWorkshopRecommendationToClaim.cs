using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClaimShield.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddDriverDobAndWorkshopRecommendationToClaim : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "DriverDob",
                schema: "dbo",
                table: "Claims",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "WorkshopRecommendation",
                schema: "dbo",
                table: "Claims",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DriverDob",
                schema: "dbo",
                table: "Claims");

            migrationBuilder.DropColumn(
                name: "WorkshopRecommendation",
                schema: "dbo",
                table: "Claims");
        }
    }
}
