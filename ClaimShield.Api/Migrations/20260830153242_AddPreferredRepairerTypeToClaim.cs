using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClaimShield.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPreferredRepairerTypeToClaim : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "PreferredRepairerTypeId",
                schema: "dbo",
                table: "Claims",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PreferredRepairerTypeId",
                schema: "dbo",
                table: "Claims");
        }
    }
}
