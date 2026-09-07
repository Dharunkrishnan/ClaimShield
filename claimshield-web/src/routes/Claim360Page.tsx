import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Search, Pencil, Route, Upload, History } from 'lucide-react'
import {
  ApiError,
  getAllCustomers,
  getClaim,
  getClaimDocuments,
  getClaimsHandlerAllClaims,
  getDecisionHistory,
  getDocumentDownloadUrl,
  getMyPolicies,
  getMyVehicles,
  getPaymentsByClaim,
  getRepairAssignmentsByClaim,
  getRepairers,
  getSurveyAssessment,
  updateClaimDetails,
  updateCustomer,
  updatePolicy,
  updateVehicle,
  uploadClaimDocument,
} from '../lib/api'
import type { ClaimsHandlerClaimListItem } from '../lib/api'
import type {
  ClaimDecisionResponseDto,
  ClaimDocumentResponseDto,
  ClaimResponseDto,
  CustomerResponseDto,
  PaymentResponseDto,
  PolicyResponseDto,
  RepairAssignmentResponseDto,
  SurveyAssessmentResponseDto,
  UserResponseDto,
  VehicleResponseDto,
} from '../lib/types'
import { ClaimStatusName, DocumentType, LossTypeName, PolicyTypeName } from '../lib/statuses'
import { SkeletonBlock } from '../components/Skeleton'
import { Modal } from '../components/Modal'
import { ClaimLifecycleStepper } from '../components/ClaimLifecycleStepper'
import { useToast } from '../context/ToastContext'
import '../styles/claim360-header.css'

function formatCurrency(amount: number | null | undefined) {
  return amount != null ? `₹ ${amount.toLocaleString('en-IN')}` : '—'
}

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString('en-IN') : '—'
}

function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return ''
  return iso.slice(0, 10)
}

// A single view-only row: label on the left, value on the right.
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="detail-item">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value}</span>
    </div>
  )
}

// One "tile": a titled card with an Edit link on the right that opens
// a modal for the fields that are actually backed by a real update
// endpoint. Sections with no edit capability (Repairer/Surveyor
// Details - no update endpoint exists for those) simply omit
// onEdit entirely rather than show a button that can't do anything.
function InfoCard({
  title,
  onEdit,
  tint,
  children,
}: {
  title: string
  onEdit?: () => void
  tint?: boolean
  children: React.ReactNode
}) {
  return (
    <section className={`card claim360-card ${tint ? 'card-tint-blue' : ''}`}>
      <div className="claim360-card-header">
        <h2>{title}</h2>
        {onEdit && (
          <button type="button" className="claim360-edit-link" onClick={onEdit}>
            <Pencil size={13} /> Edit
          </button>
        )}
      </div>
      <div className="detail-panel-box claim360-info-grid">{children}</div>
    </section>
  )
}

// Claim 360 - a single, real, comprehensive view of one claim, reached
// by searching for it (same claims list the Dashboard/Track Claim
// already use). Every section shows genuinely real data pulled from
// the same records every other page in the app uses.
//
// Sections with an Edit link open a modal and save through a real
// backend endpoint:
//  - Claim: PATCH /api/Claims/{id}/details (purpose-built - see
//    UpdateClaimDetailsRequest - never touches Status or Approved
//    Amount, which only change through the claim's real decision/
//    approval/payment workflows)
//  - Policy/Vehicle/Customer: their existing PUT endpoints, widened
//    from Admin-only to include Surveyor/Approver for this page
//
// Within Policy Details specifically: Policy Number, Policy Holder
// Name, Policy Type, and Policy Period are always shown view-only
// even inside the edit modal's summary, per instruction - only
// Coverage Amount, Premium Amount, and Add-ons are actually editable
// there.
//
// Repairer Details and Surveyor Details have no Edit link - there is
// no update endpoint for assignment records, so rather than fake one,
// these stay view-only, sourced from the claim's real repair
// assignment and survey assessment.
export function Claim360Page() {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const { claimId: routeClaimId } = useParams<{ claimId: string }>()

  const [claims, setClaims] = useState<ClaimsHandlerClaimListItem[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selected, setSelected] = useState<ClaimsHandlerClaimListItem | null>(null)

  const [claim, setClaim] = useState<ClaimResponseDto | null>(null)
  const [policy, setPolicy] = useState<PolicyResponseDto | null>(null)
  const [vehicle, setVehicle] = useState<VehicleResponseDto | null>(null)
  const [customer, setCustomer] = useState<CustomerResponseDto | null>(null)
  const [repairAssignment, setRepairAssignment] = useState<RepairAssignmentResponseDto | null>(null)
  const [repairerUser, setRepairerUser] = useState<UserResponseDto | null>(null)
  const [surveyAssessment, setSurveyAssessment] = useState<SurveyAssessmentResponseDto | null>(null)
  const [documents, setDocuments] = useState<ClaimDocumentResponseDto[]>([])
  const [payments, setPayments] = useState<PaymentResponseDto[]>([])
  const [decisions, setDecisions] = useState<ClaimDecisionResponseDto[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const [showTrack, setShowTrack] = useState(false)
  const [showDocuments, setShowDocuments] = useState(false)
  const [showActivity, setShowActivity] = useState(false)

  // Which edit modal is open right now, if any.
  const [editing, setEditing] = useState<'claim' | 'policy' | 'vehicle' | 'customer' | null>(null)
  const [saving, setSaving] = useState(false)

  // --- Claim form fields ---
  const [incidentDate, setIncidentDate] = useState('')
  const [incidentLocation, setIncidentLocation] = useState('')
  const [incidentDescription, setIncidentDescription] = useState('')
  const [estimatedLossAmount, setEstimatedLossAmount] = useState('')

  // --- Policy form fields (only the genuinely editable ones) ---
  const [coverageAmount, setCoverageAmount] = useState('')
  const [premiumAmount, setPremiumAmount] = useState('')
  const [addOns, setAddOns] = useState('')

  // --- Vehicle form fields ---
  const [registrationNumber, setRegistrationNumber] = useState('')
  const [chassisNumber, setChassisNumber] = useState('')
  const [engineNumber, setEngineNumber] = useState('')
  const [variant, setVariant] = useState('')
  const [manufacturingYear, setManufacturingYear] = useState('')
  const [vehicleColor, setVehicleColor] = useState('')
  const [rcNumber, setRcNumber] = useState('')

  // --- Customer form fields ---
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [gender, setGender] = useState('')
  const [aadhaarNumber, setAadhaarNumber] = useState('')
  const [drivingLicenseNumber, setDrivingLicenseNumber] = useState('')
  const [addressLine1, setAddressLine1] = useState('')
  const [addressLine2, setAddressLine2] = useState('')
  const [city, setCity] = useState('')
  const [stateField, setStateField] = useState('')
  const [pincode, setPincode] = useState('')

  useEffect(() => {
    getClaimsHandlerAllClaims()
      .then(setClaims)
      .catch((err: unknown) => {
        setLoadError(err instanceof ApiError ? err.message : 'Failed to load claims list.')
      })
  }, [])

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q || selected) return []
    return claims
      .filter(
        (c) =>
          c.claimNumber.toLowerCase().includes(q) ||
          (c.customerName ?? '').toLowerCase().includes(q),
      )
      .slice(0, 8)
  }, [query, claims, selected])

  const loadClaimDetails = (claimId: string) => {
    setDetailLoading(true)
    setDetailError(null)

    getClaim(claimId)
      .then(async (claimData) => {
        setClaim(claimData)
        setIncidentDate(toDateInputValue(claimData.incidentDate))
        setIncidentLocation(claimData.incidentLocation ?? '')
        setIncidentDescription(claimData.incidentDescription ?? '')
        setEstimatedLossAmount(
          claimData.estimatedLossAmount != null ? String(claimData.estimatedLossAmount) : '',
        )

        const [
          policies,
          vehicles,
          customers,
          repairAssignments,
          repairers,
          assessment,
          documentData,
          paymentData,
          decisionData,
        ] = await Promise.all([
          getMyPolicies(claimData.customerId).catch(() => []),
          getMyVehicles(claimData.customerId).catch(() => []),
          getAllCustomers().catch(() => []),
          getRepairAssignmentsByClaim(claimId).catch(() => []),
          getRepairers().catch(() => []),
          getSurveyAssessment(claimId).catch(() => null),
          getClaimDocuments(claimId).catch(() => []),
          getPaymentsByClaim(claimId).catch(() => []),
          getDecisionHistory(claimId).catch(() => []),
        ])

        setDocuments(documentData)
        setPayments(paymentData)
        setDecisions(decisionData)

        const foundPolicy = policies.find((p) => p.policyId === claimData.policyId) ?? null
        const foundVehicle = vehicles.find((v) => v.vehicleId === claimData.vehicleId) ?? null
        const foundCustomer = customers.find((c) => c.customerId === claimData.customerId) ?? null
        const foundAssignment = repairAssignments[0] ?? null
        const foundRepairerUser = foundAssignment
          ? repairers.find((r) => r.userId === foundAssignment.repairerId) ?? null
          : null

        setPolicy(foundPolicy)
        setVehicle(foundVehicle)
        setCustomer(foundCustomer)
        setRepairAssignment(foundAssignment)
        setRepairerUser(foundRepairerUser)
        setSurveyAssessment(assessment)

        if (foundPolicy) {
          setCoverageAmount(String(foundPolicy.coverageAmount ?? ''))
          setPremiumAmount(String(foundPolicy.premiumAmount ?? ''))
          setAddOns(foundPolicy.addOns ?? '')
        }

        if (foundVehicle) {
          setRegistrationNumber(foundVehicle.registrationNumber)
          setChassisNumber(foundVehicle.chassisNumber)
          setEngineNumber(foundVehicle.engineNumber)
          setVariant(foundVehicle.variant ?? '')
          setManufacturingYear(String(foundVehicle.manufacturingYear ?? ''))
          setVehicleColor(foundVehicle.vehicleColor ?? '')
          setRcNumber(foundVehicle.rcNumber ?? '')
        }

        if (foundCustomer) {
          setDateOfBirth(toDateInputValue(foundCustomer.dateOfBirth))
          setGender(foundCustomer.gender ?? '')
          setAadhaarNumber(foundCustomer.aadhaarNumber ?? '')
          setDrivingLicenseNumber(foundCustomer.drivingLicenseNumber ?? '')
          setAddressLine1(foundCustomer.addressLine1 ?? '')
          setAddressLine2(foundCustomer.addressLine2 ?? '')
          setCity(foundCustomer.city ?? '')
          setStateField(foundCustomer.state ?? '')
          setPincode(foundCustomer.pincode ?? '')
        }
      })
      .catch((err: unknown) => {
        setDetailError(err instanceof ApiError ? err.message : 'Failed to load this claim.')
      })
      .finally(() => setDetailLoading(false))
  }

  // If reached directly with a claim ID in the URL (e.g. from clicking
  // a row in the Claims list), auto-load that claim immediately -
  // skip the manual search entirely, same as how the customer side's
  // My Claims list goes straight into a specific claim's Claim 360.
  useEffect(() => {
    if (!routeClaimId) return
    const match = claims.find((c) => c.claimId === routeClaimId)
    if (match) {
      setSelected(match)
      setQuery(`${match.claimNumber} — ${match.customerName ?? 'Unknown customer'}`)
    }
    loadClaimDetails(routeClaimId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeClaimId, claims.length])

  const handleSelect = (item: ClaimsHandlerClaimListItem) => {
    setSelected(item)
    setQuery(`${item.claimNumber} — ${item.customerName ?? 'Unknown customer'}`)
    setShowSuggestions(false)
    loadClaimDetails(item.claimId)
  }

  const handleQueryChange = (value: string) => {
    setQuery(value)
    setShowSuggestions(true)
    if (selected) {
      setSelected(null)
      setClaim(null)
      setPolicy(null)
      setVehicle(null)
      setCustomer(null)
      setRepairAssignment(null)
      setRepairerUser(null)
      setSurveyAssessment(null)
    }
  }

  const handleSaveClaim = async (event: FormEvent) => {
    event.preventDefault()
    if (!claim) return
    setSaving(true)
    try {
      await updateClaimDetails({
        claimId: claim.claimId,
        incidentDate: new Date(incidentDate).toISOString(),
        incidentLocation: incidentLocation || null,
        incidentDescription: incidentDescription || null,
        estimatedLossAmount: estimatedLossAmount ? Number(estimatedLossAmount) : null,
      })
      showToast('Claim details saved.', 'success')
      setEditing(null)
      loadClaimDetails(claim.claimId)
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to save claim details.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleSavePolicy = async (event: FormEvent) => {
    event.preventDefault()
    if (!policy) return
    setSaving(true)
    try {
      await updatePolicy({
        policyId: policy.policyId,
        customerId: policy.customerId,
        vehicleId: policy.vehicleId,
        // Policy Number/Type/Period are locked view-only per spec -
        // sent back unchanged, never taken from an editable field.
        policyNumber: policy.policyNumber,
        coverageAmount: coverageAmount ? Number(coverageAmount) : 0,
        premiumAmount: premiumAmount ? Number(premiumAmount) : 0,
        startDate: policy.startDate,
        endDate: policy.endDate,
        policyTypeId: policy.policyTypeId,
        policyStatusId: policy.policyStatusId,
      })
      showToast('Policy details saved.', 'success')
      setEditing(null)
      if (claim) loadClaimDetails(claim.claimId)
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to save policy details.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveVehicle = async (event: FormEvent) => {
    event.preventDefault()
    if (!vehicle) return
    setSaving(true)
    try {
      await updateVehicle({
        vehicleId: vehicle.vehicleId,
        customerId: vehicle.customerId,
        registrationNumber,
        chassisNumber,
        engineNumber,
        variant: variant || null,
        manufacturingYear: manufacturingYear ? Number(manufacturingYear) : 0,
        vehicleColor: vehicleColor || null,
        rcNumber: rcNumber || null,
        isActive: vehicle.isActive,
        makeId: vehicle.makeId,
        modelId: vehicle.modelId,
        fuelTypeId: vehicle.fuelTypeId,
      })
      showToast('Vehicle details saved.', 'success')
      setEditing(null)
      if (claim) loadClaimDetails(claim.claimId)
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to save vehicle details.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveCustomer = async (event: FormEvent) => {
    event.preventDefault()
    if (!customer) return
    setSaving(true)
    try {
      await updateCustomer({
        customerId: customer.customerId,
        userId: customer.userId,
        customerCode: customer.customerCode,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth).toISOString() : null,
        gender: gender || null,
        aadhaarNumber: aadhaarNumber || null,
        drivingLicenseNumber: drivingLicenseNumber || null,
        addressLine1: addressLine1 || null,
        addressLine2: addressLine2 || null,
        city: city || null,
        state: stateField || null,
        pincode: pincode || null,
      })
      showToast('Insured details saved.', 'success')
      setEditing(null)
      if (claim) loadClaimDetails(claim.claimId)
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to save insured details.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const repairerLabel = repairerUser
    ? `${repairerUser.firstName} ${repairerUser.lastName ?? ''}`.trim()
    : null

  return (
    <div className="claim360-page">
      <div className="claim360-topbar">
        <div className="claim360-title">
          <span className="claim360-accent" />
          <h1>Claim 360°</h1>
        </div>

        <div className="claim360-search-inline">
          <span className="claim360-search-label">
            <Search size={18} />
            Find Claim
          </span>
          <div className="claim360-search-box">
            <input
              id="claim-360-search"
              type="text"
              aria-label="Claim number or customer name"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="e.g. CLM4DF5D948 or Anjali Reddy"
              autoComplete="off"
            />
            {showSuggestions && suggestions.length > 0 && (
              <ul className="register-claim-suggestions">
                {suggestions.map((item) => (
                  <li key={item.claimId} onMouseDown={() => handleSelect(item)}>
                    <strong>{item.claimNumber}</strong>
                    <span>{item.customerName ?? 'Unknown customer'}</span>
                  </li>
                ))}
              </ul>
            )}
            {showSuggestions && query.trim() && !selected && suggestions.length === 0 && (
              <ul className="register-claim-suggestions">
                <li className="register-claim-suggestions-empty">No matching claim found.</li>
              </ul>
            )}
          </div>
        </div>
      </div>

      {loadError && <p className="error-text">{loadError}</p>}

      {detailLoading && (
        <section className="card">
          <SkeletonBlock lines={6} />
        </section>
      )}

      {detailError && <p className="error-text">{detailError}</p>}

      {claim && !detailLoading && (
        <>
          <div className="claim360-title-row">
            <button type="button" onClick={() => setShowTrack(true)}>
              <Route size={15} style={{ verticalAlign: '-2px', marginRight: '0.35rem' }} />
              Track Claim
            </button>
            <button type="button" onClick={() => setShowDocuments(true)}>
              <Upload size={15} style={{ verticalAlign: '-2px', marginRight: '0.35rem' }} />
              Documents ({documents.length})
            </button>
            <button type="button" onClick={() => setShowActivity(true)}>
              <History size={15} style={{ verticalAlign: '-2px', marginRight: '0.35rem' }} />
              Recent Activity
            </button>
            <button type="button" onClick={() => navigate(`/claims/${claim.claimId}`)}>
              Continue to Claim Workflow →
            </button>
            <span className="badge badge-icon badge-blue">
              {claim.statusId ? (ClaimStatusName[claim.statusId] ?? 'Unknown') : 'Unknown'}
            </span>
          </div>

          <div className="claim360-cards-grid">
            <InfoCard title="Claim Details" onEdit={() => setEditing('claim')}>
              <div className="detail-panel-col">
                <InfoRow label="Claim number" value={claim.claimNumber} />
                <InfoRow
                  label="Loss type"
                  value={claim.lossTypeId ? (LossTypeName[claim.lossTypeId] ?? '—') : '—'}
                />
                <InfoRow label="Estimated loss" value={formatCurrency(claim.estimatedLossAmount)} />
              </div>
              <div className="detail-panel-col">
                <InfoRow label="Incident date" value={formatDate(claim.incidentDate)} />
                <InfoRow label="Reported date" value={formatDate(claim.reportedDate)} />
                <InfoRow label="Approved amount" value={formatCurrency(claim.approvedAmount)} />
              </div>
              <div className="detail-panel-col">
                <InfoRow label="Incident location" value={claim.incidentLocation ?? '—'} />
                <InfoRow label="Initial reserve" value={formatCurrency(claim.initialReserveAmount)} />
                <InfoRow
                  label="Preferred repairer"
                  value={
                    claim.preferredRepairerName ??
                    claim.workshopRecommendation ??
                    surveyAssessment?.estimatedRepairerName ??
                    '—'
                  }
                />
              </div>
            </InfoCard>

            {policy && (
              <InfoCard title="Policy Details" onEdit={() => setEditing('policy')} tint>
                <div className="detail-panel-col">
                  <InfoRow label="Policy number" value={policy.policyNumber} />
                  <InfoRow label="Policy holder name" value={claim.customerName ?? '—'} />
                </div>
                <div className="detail-panel-col">
                  <InfoRow
                    label="Policy type"
                    value={policy.policyTypeId ? (PolicyTypeName[policy.policyTypeId] ?? '—') : '—'}
                  />
                  <InfoRow
                    label="Policy period"
                    value={`${formatDate(policy.startDate)} – ${formatDate(policy.endDate)}`}
                  />
                </div>
                <div className="detail-panel-col">
                  <InfoRow label="Coverage amount" value={formatCurrency(policy.coverageAmount)} />
                  <InfoRow label="Premium amount" value={formatCurrency(policy.premiumAmount)} />
                  <InfoRow label="Add-ons" value={policy.addOns || '—'} />
                </div>
              </InfoCard>
            )}

            {vehicle && (
              <InfoCard title="Vehicle Details" onEdit={() => setEditing('vehicle')}>
                <div className="detail-panel-col">
                  <InfoRow label="Registration number" value={vehicle.registrationNumber} />
                  <InfoRow label="Variant" value={vehicle.variant || '—'} />
                </div>
                <div className="detail-panel-col">
                  <InfoRow label="Chassis number" value={vehicle.chassisNumber} />
                  <InfoRow label="Engine number" value={vehicle.engineNumber} />
                </div>
                <div className="detail-panel-col">
                  <InfoRow label="Manufacturing year" value={vehicle.manufacturingYear ?? '—'} />
                  <InfoRow label="Vehicle colour" value={vehicle.vehicleColor || '—'} />
                </div>
              </InfoCard>
            )}

            {customer && (
              <InfoCard title="Insured Details" onEdit={() => setEditing('customer')} tint>
                <div className="detail-panel-col">
                  <InfoRow label="Name" value={claim.customerName ?? '—'} />
                  <InfoRow label="Date of birth" value={formatDate(customer.dateOfBirth)} />
                </div>
                <div className="detail-panel-col">
                  <InfoRow label="Gender" value={customer.gender || '—'} />
                  <InfoRow label="Driving licence" value={customer.drivingLicenseNumber || '—'} />
                </div>
                <div className="detail-panel-col">
                  <InfoRow
                    label="Address"
                    value={
                      [customer.addressLine1, customer.city, customer.state, customer.pincode]
                        .filter(Boolean)
                        .join(', ') || '—'
                    }
                  />
                  <InfoRow label="Aadhaar number" value={customer.aadhaarNumber || '—'} />
                </div>
              </InfoCard>
            )}

            {/* View-only - no update endpoint exists for assignment
              records, so no Edit link is offered here. */}
            <section className="card claim360-card">
              <div className="claim360-card-header">
                <h2>Repairer Details</h2>
              </div>
              {repairAssignment ? (
                <div className="detail-panel-box claim360-info-grid">
                  <div className="detail-panel-col">
                    <InfoRow label="Repairer" value={repairerLabel ?? '—'} />
                    <InfoRow label="Assigned date" value={formatDate(repairAssignment.assignedDate)} />
                  </div>
                  <div className="detail-panel-col">
                    <InfoRow
                      label="Expected completion"
                      value={formatDate(repairAssignment.expectedCompletionDate)}
                    />
                  </div>
                  <div className="detail-panel-col">
                    <InfoRow label="Remarks" value={repairAssignment.remarks || '—'} />
                  </div>
                </div>
              ) : (
                <p className="claim360-empty-state">No repairer assigned yet.</p>
              )}
            </section>

            <section className="card claim360-card card-tint-blue">
              <div className="claim360-card-header">
                <h2>Surveyor Details</h2>
              </div>
              {surveyAssessment ? (
                <div className="detail-panel-box claim360-info-grid">
                  <div className="detail-panel-col">
                    <InfoRow label="Surveyor" value={surveyAssessment.surveyorName ?? '—'} />
                    <InfoRow label="Inspection date" value={formatDate(surveyAssessment.inspectionDate)} />
                  </div>
                  <div className="detail-panel-col">
                    <InfoRow label="Survey location" value={surveyAssessment.surveyLocation ?? '—'} />
                  </div>
                  <div className="detail-panel-col">
                    <InfoRow label="Remarks" value={surveyAssessment.surveyRemarks ?? '—'} />
                  </div>
                </div>
              ) : (
                <p className="claim360-empty-state">No survey assessment yet.</p>
              )}
            </section>

            {/* Only meaningful when the vehicle wasn't parked safely at
              the time of loss (Register Claim's own condition for
              collecting this) - view-only, same reasoning as
              Repairer/Surveyor above. */}
            {(claim.driverName || claim.driverDob) && (
              <InfoCard title="Driver Details">
                <div className="detail-panel-col">
                  <InfoRow label="Driver name" value={claim.driverName || '—'} />
                  <InfoRow label="Date of birth" value={formatDate(claim.driverDob)} />
                </div>
              </InfoCard>
            )}
          </div>
        </>
      )}

      {/* ---------------- Edit modals ---------------- */}

      <Modal open={editing === 'claim'} onClose={() => setEditing(null)} title="Edit Claim Details">
        <form onSubmit={(e) => void handleSaveClaim(e)}>
          <div className="survey-grid">
            <div className="survey-field">
              <label htmlFor="c360-incident-date">Incident date</label>
              <input
                id="c360-incident-date"
                type="date"
                value={incidentDate}
                onChange={(e) => setIncidentDate(e.target.value)}
                max={toDateInputValue(new Date().toISOString())}
                required
              />
            </div>
            <div className="survey-field">
              <label htmlFor="c360-location">Incident location</label>
              <input
                id="c360-location"
                value={incidentLocation}
                onChange={(e) => setIncidentLocation(e.target.value)}
              />
            </div>
            <div className="survey-field">
              <label htmlFor="c360-estimated">Estimated loss amount (₹)</label>
              <input
                id="c360-estimated"
                type="number"
                min="0"
                step="0.01"
                value={estimatedLossAmount}
                onChange={(e) => setEstimatedLossAmount(e.target.value)}
              />
            </div>
            <div className="survey-field survey-field-wide">
              <label htmlFor="c360-description">Incident description</label>
              <textarea
                id="c360-description"
                rows={3}
                value={incidentDescription}
                onChange={(e) => setIncidentDescription(e.target.value)}
              />
            </div>
          </div>
          <button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>{' '}
          <button type="button" onClick={() => setEditing(null)} disabled={saving}>
            Cancel
          </button>
        </form>
      </Modal>

      <Modal open={editing === 'policy'} onClose={() => setEditing(null)} title="Edit Policy Details">
        <p className="subtitle">
          Policy number, policy holder name, policy type, and policy period aren't editable
          here.
        </p>
        <form onSubmit={(e) => void handleSavePolicy(e)}>
          <div className="survey-grid">
            <div className="survey-field">
              <label htmlFor="c360-coverage">Coverage amount (₹)</label>
              <input
                id="c360-coverage"
                type="number"
                min="0"
                step="0.01"
                value={coverageAmount}
                onChange={(e) => setCoverageAmount(e.target.value)}
              />
            </div>
            <div className="survey-field">
              <label htmlFor="c360-premium">Premium amount (₹)</label>
              <input
                id="c360-premium"
                type="number"
                min="0"
                step="0.01"
                value={premiumAmount}
                onChange={(e) => setPremiumAmount(e.target.value)}
              />
            </div>
            <div className="survey-field survey-field-wide">
              <label htmlFor="c360-addons">Add-ons</label>
              <input id="c360-addons" value={addOns} onChange={(e) => setAddOns(e.target.value)} />
            </div>
          </div>
          <button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>{' '}
          <button type="button" onClick={() => setEditing(null)} disabled={saving}>
            Cancel
          </button>
        </form>
      </Modal>

      <Modal open={editing === 'vehicle'} onClose={() => setEditing(null)} title="Edit Vehicle Details">
        <form onSubmit={(e) => void handleSaveVehicle(e)}>
          <div className="survey-grid">
            <div className="survey-field">
              <label htmlFor="c360-reg-number">Registration number</label>
              <input
                id="c360-reg-number"
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
                required
              />
            </div>
            <div className="survey-field">
              <label htmlFor="c360-chassis">Chassis number</label>
              <input
                id="c360-chassis"
                value={chassisNumber}
                onChange={(e) => setChassisNumber(e.target.value)}
                required
              />
            </div>
            <div className="survey-field">
              <label htmlFor="c360-engine">Engine number</label>
              <input
                id="c360-engine"
                value={engineNumber}
                onChange={(e) => setEngineNumber(e.target.value)}
                required
              />
            </div>
            <div className="survey-field">
              <label htmlFor="c360-variant">Variant</label>
              <input id="c360-variant" value={variant} onChange={(e) => setVariant(e.target.value)} />
            </div>
            <div className="survey-field">
              <label htmlFor="c360-year">Manufacturing year</label>
              <input
                id="c360-year"
                type="number"
                min="1900"
                max={new Date().getFullYear() + 1}
                value={manufacturingYear}
                onChange={(e) => setManufacturingYear(e.target.value)}
              />
            </div>
            <div className="survey-field">
              <label htmlFor="c360-color">Vehicle colour</label>
              <input
                id="c360-color"
                value={vehicleColor}
                onChange={(e) => setVehicleColor(e.target.value)}
              />
            </div>
            <div className="survey-field">
              <label htmlFor="c360-rc">RC number</label>
              <input id="c360-rc" value={rcNumber} onChange={(e) => setRcNumber(e.target.value)} />
            </div>
          </div>
          <button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>{' '}
          <button type="button" onClick={() => setEditing(null)} disabled={saving}>
            Cancel
          </button>
        </form>
      </Modal>

      <Modal open={editing === 'customer'} onClose={() => setEditing(null)} title="Edit Insured Details">
        <form onSubmit={(e) => void handleSaveCustomer(e)}>
          <div className="survey-grid">
            <div className="survey-field">
              <label htmlFor="c360-dob">Date of birth</label>
              <input
                id="c360-dob"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                max={toDateInputValue(new Date().toISOString())}
              />
            </div>
            <div className="survey-field">
              <label htmlFor="c360-gender">Gender</label>
              <select id="c360-gender" value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="">Select…</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="survey-field">
              <label htmlFor="c360-aadhaar">Aadhaar number</label>
              <input
                id="c360-aadhaar"
                value={aadhaarNumber}
                onChange={(e) => setAadhaarNumber(e.target.value)}
              />
            </div>
            <div className="survey-field">
              <label htmlFor="c360-dl">Driving licence number</label>
              <input
                id="c360-dl"
                value={drivingLicenseNumber}
                onChange={(e) => setDrivingLicenseNumber(e.target.value)}
              />
            </div>
            <div className="survey-field survey-field-wide">
              <label htmlFor="c360-address1">Address line 1</label>
              <input
                id="c360-address1"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
              />
            </div>
            <div className="survey-field survey-field-wide">
              <label htmlFor="c360-address2">Address line 2</label>
              <input
                id="c360-address2"
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
              />
            </div>
            <div className="survey-field">
              <label htmlFor="c360-city">City</label>
              <input id="c360-city" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="survey-field">
              <label htmlFor="c360-state">State</label>
              <input id="c360-state" value={stateField} onChange={(e) => setStateField(e.target.value)} />
            </div>
            <div className="survey-field">
              <label htmlFor="c360-pincode">Pincode</label>
              <input id="c360-pincode" value={pincode} onChange={(e) => setPincode(e.target.value)} />
            </div>
          </div>
          <button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>{' '}
          <button type="button" onClick={() => setEditing(null)} disabled={saving}>
            Cancel
          </button>
        </form>
      </Modal>

      {claim && (
        <>
          <Modal open={showTrack} onClose={() => setShowTrack(false)} title="Track Claim">
            <ClaimLifecycleStepper
              statusId={claim.statusId}
              payments={payments}
              repairAuthorizationStatusId={claim.repairAuthorizationStatusId}
              liabilitySubmitted={claim.liabilitySubmitted}
            />
          </Modal>

          <Modal open={showDocuments} onClose={() => setShowDocuments(false)} title="Documents">
            {documents.length === 0 && <p>No documents on this claim.</p>}
            {documents.length > 0 && (
              <ul className="document-list claim360-document-list">
                {documents.map((doc) => (
                  <li key={doc.claimDocumentId}>
                    <span className="claim360-document-name">{doc.originalFileName}</span>
                    <button
                      type="button"
                      onClick={() => void downloadClaim360Document(doc.claimDocumentId)}
                    >
                      View
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <Claim360DocumentUpload
              claimId={claim.claimId}
              onUploaded={(doc) => setDocuments((d) => [...d, doc])}
            />
          </Modal>

          <Modal open={showActivity} onClose={() => setShowActivity(false)} title="Recent Activity">
            {decisions.length === 0 && <p>No activity has been recorded on this claim yet.</p>}
            {decisions.length > 0 && (
              <ul className="timeline">
                {decisions.map((d) => (
                  <li key={d.claimDecisionId}>
                    <strong>
                      {d.roleName}: {d.decisionName}
                    </strong>{' '}
                    by {d.decidedByName} on {formatDate(d.decisionDate)}
                  </li>
                ))}
              </ul>
            )}
          </Modal>
        </>
      )}
    </div>
  )
}

async function downloadClaim360Document(claimDocumentId: string) {
  try {
    const { url } = await getDocumentDownloadUrl(claimDocumentId)
    window.open(url, '_blank', 'noopener,noreferrer')
  } catch (err) {
    alert(err instanceof ApiError ? err.message : 'Failed to get download link.')
  }
}

// Lets staff add a document directly from the Claim 360 overview,
// without needing to jump into the full claim workflow first. Filed
// under DocumentType.Other (a general supporting document) since
// there's no specific slot context here the way there is on the
// Inspection stage's own Photos & Documents section.
function Claim360DocumentUpload({
  claimId,
  onUploaded,
}: {
  claimId: string
  onUploaded: (doc: ClaimDocumentResponseDto) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleUpload = async (event: FormEvent) => {
    event.preventDefault()
    const file = fileInputRef.current?.files?.[0]

    if (!file) {
      setError('Choose a file first.')
      return
    }

    setUploading(true)
    setError(null)

    try {
      const doc = await uploadClaimDocument(claimId, DocumentType.Other, file)
      if (fileInputRef.current) fileInputRef.current.value = ''
      onUploaded(doc)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to upload document.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <form onSubmit={(e) => void handleUpload(e)} className="claim360-document-upload">
      <label htmlFor="claim360-doc-upload">Upload a document</label>
      <input id="claim360-doc-upload" type="file" ref={fileInputRef} />
      {error && <p className="error-text">{error}</p>}
      <button type="submit" disabled={uploading}>
        {uploading ? 'Uploading…' : 'Upload'}
      </button>
    </form>
  )
}