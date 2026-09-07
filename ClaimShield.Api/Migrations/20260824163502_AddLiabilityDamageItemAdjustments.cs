using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClaimShield.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddLiabilityDamageItemAdjustments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "LiabilityDamageItemAdjustments",
                schema: "dbo",
                columns: table => new
                {
                    LiabilityDamageItemAdjustmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    ClaimId = table.Column<Guid>(type: "uuid", nullable: false),
                    DamageAssessmentItemId = table.Column<Guid>(type: "uuid", nullable: false),
                    DepreciationAmount = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    RRAmount = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    TDAmount = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    PaintingAmount = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    OthersAmount = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    UpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LiabilityDamageItemAdjustments", x => x.LiabilityDamageItemAdjustmentId);
                    table.ForeignKey(
                        name: "FK_LiabilityDamageItemAdjustments_DamageAssessmentItems_Damage~",
                        column: x => x.DamageAssessmentItemId,
                        principalSchema: "dbo",
                        principalTable: "DamageAssessmentItems",
                        principalColumn: "DamageAssessmentItemId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LiabilityDamageItemAdjustments_DamageAssessmentItemId",
                schema: "dbo",
                table: "LiabilityDamageItemAdjustments",
                column: "DamageAssessmentItemId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LiabilityDamageItemAdjustments",
                schema: "dbo");
        }
    }
}
