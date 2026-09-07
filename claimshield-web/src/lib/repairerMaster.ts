// Register Claim - Workshop Recommendation master data. Sourced from
// the uploaded Repairer_Master_1.xlsx (Sheet1), filtered to rows with
// a real CONTACTPERSON1 (repairer name) populated, first 10 taken.
// FULLNAME -> workshopName, CONTACTPERSON1 -> repairerName.
//
// This is static reference data, not a live system Repairer user list
// (those don't have a corresponding GUID in ClaimShield's own Users
// table) - selecting a workshop here fills the Repair Recommendation
// field for the staff's own reference and is submitted as free text
// (Claim.WorkshopRecommendation), not tied to a real Repairer account
// the way the old "Pre-assign a repairer" dropdown was.
export interface RepairerMasterEntry {
  id: string
  workshopName: string
  repairerName: string
}

export const REPAIRER_MASTER: RepairerMasterEntry[] = [
  { id: 'RE001004', workshopName: 'Aadhi Cars Private Limited', repairerName: 'V Srinivasan' },
  { id: 'RE001008', workshopName: 'Abikiran Cars Private Limited', repairerName: 'Vidya Sudhan' },
  { id: 'RE001014', workshopName: 'Ashirwad Automotive', repairerName: 'Sampath' },
  { id: 'RE001015', workshopName: 'Cai Auto Industries Pvt Ltd', repairerName: 'Mohandass K P , Senthil Kumar N' },
  { id: 'RE001016', workshopName: 'Chandra Automobile India Private Limited', repairerName: 'Dharmalingam' },
  { id: 'RE001017', workshopName: 'Kun Cars Private Limited', repairerName: 'Udhayasankar' },
  { id: 'RE001018', workshopName: 'Pressana Automobiles Private Limited', repairerName: 'M Prabhu' },
  { id: 'RE001019', workshopName: 'Pressana Automobiles Private Limited', repairerName: 'Silambarasan' },
  { id: 'RE001020', workshopName: 'Ramani Cars Private Limited', repairerName: 'Sherif , Gowtham Raja' },
  { id: 'RE001021', workshopName: 'Sree Saradhambal Automobiles Private Limited', repairerName: 'M.Bose' },
]