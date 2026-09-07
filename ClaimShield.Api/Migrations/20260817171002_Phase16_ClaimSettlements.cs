using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClaimShield.Api.Migrations
{
    /// <inheritdoc />
    public partial class Phase16_ClaimSettlements : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ClaimSettlements",
                schema: "dbo",
                columns: table => new
                {
                    ClaimId = table.Column<Guid>(type: "uuid", nullable: false),
                    AssessedAmount = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    RepairApprovedAmount = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    BaseAmount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    ZeroDepreciationWaiverAmount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    GrossSettlementAmount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    PolicyExcessDeducted = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    PolicyIdvCap = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    IdvCapApplied = table.Column<bool>(type: "boolean", nullable: false),
                    NetSettlementAmount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    ComputedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClaimSettlements", x => x.ClaimId);
                    table.ForeignKey(
                        name: "FK_ClaimSettlements_Claims_ClaimId",
                        column: x => x.ClaimId,
                        principalSchema: "dbo",
                        principalTable: "Claims",
                        principalColumn: "ClaimId",
                        onDelete: ReferentialAction.Restrict);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ClaimSettlements",
                schema: "dbo");
        }
    }
}
