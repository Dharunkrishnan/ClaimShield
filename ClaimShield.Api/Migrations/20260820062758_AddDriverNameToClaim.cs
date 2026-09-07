using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClaimShield.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddDriverNameToClaim : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DriverName",
                schema: "dbo",
                table: "Claims",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DriverName",
                schema: "dbo",
                table: "Claims");
        }
    }
}
