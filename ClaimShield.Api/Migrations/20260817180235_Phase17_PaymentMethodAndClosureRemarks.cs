using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClaimShield.Api.Migrations
{
    /// <inheritdoc />
    public partial class Phase17_PaymentMethodAndClosureRemarks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BankAccountNumber",
                schema: "dbo",
                table: "Payments",
                type: "character varying(34)",
                maxLength: 34,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BeneficiaryName",
                schema: "dbo",
                table: "Payments",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "IfscCode",
                schema: "dbo",
                table: "Payments",
                type: "character varying(11)",
                maxLength: 11,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PaymentMethodId",
                schema: "dbo",
                table: "Payments",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ClosureRemarks",
                schema: "dbo",
                table: "Claims",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BankAccountNumber",
                schema: "dbo",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "BeneficiaryName",
                schema: "dbo",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "IfscCode",
                schema: "dbo",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "PaymentMethodId",
                schema: "dbo",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "ClosureRemarks",
                schema: "dbo",
                table: "Claims");
        }
    }
}
