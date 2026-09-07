import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ClipboardList,
  MapPin,
  Gauge,
  Calculator,
  Camera,
  Activity,
  Plus,
  Trash2,
  Save,
  Eye,
  Send,
  ChevronDown,
} from 'lucide-react'
import {
  ApiError,
  getSurveyAssessment,
  getSurveyAssignmentsByClaim,
  getClaimDocuments,
  saveSurveyAssessmentDraft,
  completeSurveyAssessment,
  getMyPolicies,
  getMyVehicles,
} from '../lib/api'
import type {
  ClaimResponseDto,
  SurveyAssessmentResponseDto,
  SurveyAssignmentResponseDto,
  ClaimDocumentResponseDto,
  DamageAssessmentItemRequest,
  SaveSurveyAssessmentRequest,
  PolicyResponseDto,
  VehicleResponseDto,
} from '../lib/types'
import { RoleId, type RoleIdValue } from '../lib/roles'
import { useAuth } from '../context/AuthContext'
import {
  AssessmentStatus,
  DamageCategoryName,
  DamageSeverityName,
  LossTypeName,
  InspectionModeName,
  ClaimStatusName,
  DocumentType,
  PolicyTypeName,
  RepairerType,
  RepairerTypeName,
} from '../lib/statuses'
import { REPAIRER_MASTER } from '../lib/repairerMaster'
import { Modal } from './Modal'
import { SkeletonBlock } from './Skeleton'
import { UploadCard } from './UploadCard'
import { TextareaWithMic } from './TextareaWithMic'
import { useToast } from '../context/ToastContext'

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString('en-IN') : '—'
}

// Policy.EndDate is stored as the exclusive cutoff (coverage renews
// starting that day), so the last real day of cover - and what a
// person expects to read as "expires on" - is the day before it.
function formatPolicyEndDate(value: string | null | undefined) {
  if (!value) return '—'
  const d = new Date(value)
  d.setDate(d.getDate() - 1)
  return d.toLocaleDateString('en-IN')
}

function formatCurrency(amount: number | null | undefined) {
  return amount != null ? `₹ ${amount.toLocaleString('en-IN')}` : '—'
}

function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return new Date().toISOString().slice(0, 10)
  return iso.slice(0, 10)
}

function numToStr(n: number | null | undefined): string {
  return n == null ? '' : String(n)
}

function num(s: string): number {
  const trimmed = s.trim()
  return trimmed === '' ? 0 : Number(trimmed)
}

interface FormState {
  inspectionDate: string
  surveyLocation: string
  surveyRemarks: string
  assessmentStatusId: number

  vehicleConditionId: string
  odometerReading: string
  preExistingDamageNotes: string
  surveyorFlaggedSuspicious: boolean
  preExistingDamageSuspected: boolean
  damageTypeId: string
  damageDescription: string
  repairabilityStatusId: string
  totalLoss: boolean

  estimatedRepairerName: string
  repairerTypeId: string
  labourCost: string
  partsCost: string
  towingCharges: string
  paintCost: string
  estimatedDurationDays: string

  taxAmount: string
  depreciationAmount: string
  compulsoryExcess: string
  salvageAmount: string

  repairRecommended: boolean
  replaceRecommended: boolean
  cashSettlementRecommended: boolean
  totalLossRecommended: boolean
  overallRecommendationId: string
  assessmentRemarks: string
}

function buildInitialForm(
  assessment: SurveyAssessmentResponseDto | null,
  claim: ClaimResponseDto,
): FormState {
  return {
    inspectionDate: toDateInputValue(assessment?.inspectionDate),
    surveyLocation: assessment?.surveyLocation ?? '',
    surveyRemarks: assessment?.surveyRemarks ?? '',
    assessmentStatusId: assessment?.assessmentStatusId ?? AssessmentStatus.Assigned,

    vehicleConditionId: numToStr(assessment?.vehicleConditionId),
    odometerReading: numToStr(assessment?.odometerReading),
    preExistingDamageNotes: assessment?.preExistingDamageNotes ?? '',
    surveyorFlaggedSuspicious: assessment?.surveyorFlaggedSuspicious ?? false,
    preExistingDamageSuspected: assessment?.preExistingDamageSuspected ?? false,
    damageTypeId: assessment ? String(assessment.damageTypeId) : numToStr(claim.lossTypeId),
    damageDescription: assessment?.damageDescription ?? '',
    repairabilityStatusId: numToStr(assessment?.repairabilityStatusId),
    totalLoss: assessment?.totalLoss ?? false,

    estimatedRepairerName: assessment?.estimatedRepairerName ?? '',
    repairerTypeId: assessment?.repairerTypeId?.toString() ?? '',
    labourCost: numToStr(assessment?.labourCost),
    partsCost: numToStr(assessment?.partsCost),
    towingCharges: numToStr(assessment?.towingCharges),
    paintCost: numToStr(assessment?.paintCost),
    estimatedDurationDays: numToStr(assessment?.estimatedDurationDays),

    taxAmount: numToStr(assessment?.taxAmount),
    depreciationAmount: numToStr(assessment?.depreciationAmount),
    compulsoryExcess: numToStr(assessment?.compulsoryExcess),
    salvageAmount: numToStr(assessment?.salvageAmount),

    repairRecommended: assessment?.repairRecommended ?? false,
    replaceRecommended: assessment?.replaceRecommended ?? false,
    cashSettlementRecommended: assessment?.cashSettlementRecommended ?? false,
    totalLossRecommended: assessment?.totalLossRecommended ?? false,
    overallRecommendationId: numToStr(assessment?.overallRecommendationId),
    assessmentRemarks: assessment?.assessmentRemarks ?? '',
  }
}

export function SurveyAssessment({
  claim,
  roleId,
  currentUserId,
  onCompleted,
}: {
  claim: ClaimResponseDto
  roleId: RoleIdValue | null
  currentUserId: string | null
  // Called after the assessment is successfully completed, so the
  // parent (which owns the claim object driving the lifecycle
  // stepper) can refetch and unlock the next stage - without this,
  // this component's own local assessment state updates fine, but the
  // stepper has no way to know the claim's status actually changed
  // until a full page refresh re-fetches everything from scratch.
  onCompleted?: () => void
}) {
  const { showToast } = useToast()
  const { displayName } = useAuth()

  const [loaded, setLoaded] = useState(false)
  const [assessment, setAssessment] = useState<SurveyAssessmentResponseDto | null>(null)
  const [assignments, setAssignments] = useState<SurveyAssignmentResponseDto[]>([])
  // documents itself isn't read anywhere now that Supporting Documents
  // (the one place that listed uploaded files by name) was removed -
  // setDocuments is still needed, each UploadCard's onUploaded callback
  // appends to it so a fresh upload is reflected without a full reload.
  const [, setDocuments] = useState<ClaimDocumentResponseDto[]>([])
  const [policy, setPolicy] = useState<PolicyResponseDto | null>(null)
  const [vehicle, setVehicle] = useState<VehicleResponseDto | null>(null)

  const [form, setForm] = useState<FormState>(() => buildInitialForm(null, claim))
  const [damageItems, setDamageItems] = useState<DamageAssessmentItemRequest[]>([])

  const [saving, setSaving] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [claimInfoExpanded, setClaimInfoExpanded] = useState(false)
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [assessmentData, assignmentData, docData, policiesData, vehiclesData] =
          await Promise.all([
            getSurveyAssessment(claim.claimId).catch(() => null),
            getSurveyAssignmentsByClaim(claim.claimId).catch(() => []),
            getClaimDocuments(claim.claimId).catch(() => []),
            getMyPolicies(claim.customerId).catch(() => []),
            getMyVehicles(claim.customerId).catch(() => []),
          ])

        if (cancelled) return

        setAssessment(assessmentData)
        setAssignments(assignmentData)
        setDocuments(docData)
        setPolicy(policiesData.find((p) => p.policyId === claim.policyId) ?? null)
        setVehicle(vehiclesData.find((v) => v.vehicleId === claim.vehicleId) ?? null)
        setForm(buildInitialForm(assessmentData, claim))
        setDamageItems(
          assessmentData?.damageAssessmentItems.map((item) => ({
            componentName: item.componentName,
            damageCategoryId: item.damageCategoryId,
            severityId: item.severityId,
            repairRequired: item.repairRequired,
            replacementRequired: item.replacementRequired,
            remarks: null,
            labourAmount: item.labourAmount,
            partsAmount: item.partsAmount,
          })) ?? [],
        )
      } finally {
        if (!cancelled) setLoaded(true)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claim.claimId])

  if (roleId !== RoleId.Surveyor && roleId !== RoleId.Approver && roleId !== RoleId.Admin) {
    return null
  }

  const myAssignment = assignments.find((a) => a.surveyorId === currentUserId) ?? null

  const editable =
    roleId === RoleId.Surveyor &&
    !!myAssignment &&
    (assessment == null || assessment.surveyorId === currentUserId) &&
    (assessment == null || assessment.assessmentStatusId < AssessmentStatus.SubmittedForReview)

  const surveyTypeId = assessment?.surveyTypeId ?? myAssignment?.inspectionMode ?? null

  // Labour/Parts now come from the per-component damage table (added
  // alongside Repair/Replace) rather than the old flat Repair Estimate
  // Details fields (removed) - sum them here instead of reading
  // form.labourCost/partsCost, which no longer have any input feeding
  // them.
  const totalLabourAmount = damageItems.reduce((sum, item) => sum + (item.labourAmount ?? 0), 0)
  const totalPartsAmount = damageItems.reduce((sum, item) => sum + (item.partsAmount ?? 0), 0)

  // Gross = left column (Total Labour + Total Parts + Tax). Total
  // Deductions = right column (Depreciation + Policy Excess +
  // Salvage). Net = Gross - Total Deductions.
  const previewGross = totalLabourAmount + totalPartsAmount + num(form.taxAmount)
  const totalDeductions =
    num(form.depreciationAmount) + num(form.compulsoryExcess) + num(form.salvageAmount)
  const previewNet = Math.max(0, previewGross - totalDeductions)

  if (!loaded) {
    return (
      <section className="card survey-loading-card">
        <SkeletonBlock lines={5} />
      </section>
    )
  }

  if (!myAssignment && roleId === RoleId.Surveyor) {
    return null
  }

  const buildRequest = (): SaveSurveyAssessmentRequest | null => {
    if (!myAssignment || !currentUserId) return null

    if (!form.damageTypeId) {
      showToast('Select a damage type before saving.', 'error')
      return null
    }

    return {
      surveyAssignmentId: assessment?.surveyAssignmentId ?? myAssignment.surveyAssignmentId,
      claimId: claim.claimId,
      surveyorId: currentUserId,

      inspectionDate: new Date(form.inspectionDate).toISOString(),
      surveyLocation: form.surveyLocation || null,
      surveyRemarks: form.surveyRemarks || null,
      assessmentStatusId: form.assessmentStatusId,

      vehicleConditionId: form.vehicleConditionId ? Number(form.vehicleConditionId) : null,
      odometerReading: form.odometerReading ? Number(form.odometerReading) : null,
      preExistingDamageNotes: form.preExistingDamageNotes || null,
      surveyorFlaggedSuspicious: form.surveyorFlaggedSuspicious,
      preExistingDamageSuspected: form.preExistingDamageSuspected,
      damageTypeId: Number(form.damageTypeId),
      damageDescription: form.damageDescription || null,
      repairabilityStatusId: form.repairabilityStatusId ? Number(form.repairabilityStatusId) : null,
      totalLoss: form.totalLoss,

      damageAssessmentItems: damageItems.filter((item) => item.componentName.trim() !== ''),

      estimatedRepairerName: form.estimatedRepairerName || null,
      repairerTypeId: form.repairerTypeId ? Number(form.repairerTypeId) : null,
      labourCost: form.labourCost ? Number(form.labourCost) : null,
      partsCost: form.partsCost ? Number(form.partsCost) : null,
      towingCharges: form.towingCharges ? Number(form.towingCharges) : null,
      paintCost: form.paintCost ? Number(form.paintCost) : null,
      estimatedDurationDays: form.estimatedDurationDays ? Number(form.estimatedDurationDays) : null,

      taxAmount: form.taxAmount ? Number(form.taxAmount) : null,
      depreciationAmount: form.depreciationAmount ? Number(form.depreciationAmount) : null,
      compulsoryExcess: form.compulsoryExcess ? Number(form.compulsoryExcess) : null,
      salvageAmount: form.salvageAmount ? Number(form.salvageAmount) : null,

      repairRecommended: form.repairRecommended,
      replaceRecommended: form.replaceRecommended,
      cashSettlementRecommended: form.cashSettlementRecommended,
      totalLossRecommended: form.totalLossRecommended,
      overallRecommendationId: form.overallRecommendationId ? Number(form.overallRecommendationId) : null,
      assessmentRemarks: form.assessmentRemarks || null,
    }
  }

  const handleSaveDraft = async () => {
    const req = buildRequest()
    if (!req) return

    setSaving(true)
    try {
      const result = await saveSurveyAssessmentDraft(req)
      setAssessment(result)
      showToast('Assessment saved as draft.', 'success')
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to save draft.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleComplete = async () => {
    setCompleting(true)
    try {
      let current = assessment
      const req = buildRequest()

      if (req) {
        current = await saveSurveyAssessmentDraft(req)
        setAssessment(current)
      }

      if (!current) {
        throw new ApiError(400, 'Save the assessment before completing it.')
      }

      const result = await completeSurveyAssessment(current.surveyReportId)
      setAssessment(result)
      setShowCompleteConfirm(false)
      showToast('Assessment completed and submitted for review.', 'success')
      onCompleted?.()
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to complete assessment.', 'error')
    } finally {
      setCompleting(false)
    }
  }

  const addDamageItem = () =>
    setDamageItems((items) => [
      ...items,
      {
        componentName: '',
        damageCategoryId: null,
        severityId: null,
        repairRequired: false,
        replacementRequired: false,
        remarks: null,
        labourAmount: null,
        partsAmount: null,
      },
    ])

  const removeDamageItem = (index: number) =>
    setDamageItems((items) => items.filter((_, i) => i !== index))

  const updateDamageItem = (index: number, patch: Partial<DamageAssessmentItemRequest>) =>
    setDamageItems((items) => items.map((item, i) => (i === index ? { ...item, ...patch } : item)))

  return (
    <div className="survey-assessment">
      <section className="card survey-section survey-claim-header">
        <button
          type="button"
          className="survey-section-title survey-section-title-toggle"
          onClick={() => setClaimInfoExpanded((v) => !v)}
          aria-expanded={claimInfoExpanded}
        >
          <span className="survey-section-icon"><ClipboardList size={17} /></span>
          <h2>Claim Information</h2>
          <ChevronDown
            size={16}
            className="survey-section-chevron"
            style={{
              transform: claimInfoExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              marginLeft: 'auto',
            }}
          />
        </button>

        {!claimInfoExpanded && (
          <p className="survey-claim-summary">
            {claim.claimNumber} · {claim.customerName ?? '—'} ·{' '}
            {claim.statusId ? ClaimStatusName[claim.statusId] : '—'}
          </p>
        )}

        {claimInfoExpanded && (
          <dl className="survey-fact-grid">
            <dt>Claim Number</dt>
            <dd>{claim.claimNumber}</dd>
            <dt>Customer</dt>
            <dd>{claim.customerName ?? '—'}</dd>
            <dt>Policy Number</dt>
            <dd>{claim.policyNumber ?? '—'}</dd>
            <dt>Vehicle Number</dt>
            <dd>{claim.vehicleRegistrationNumber ?? '—'}</dd>
            <dt>Claim Type</dt>
            <dd>{claim.lossTypeId ? LossTypeName[claim.lossTypeId] : '—'}</dd>
            <dt>Date of Loss</dt>
            <dd>{formatDate(claim.incidentDate)}</dd>
            <dt>Date of Intimation</dt>
            <dd>{formatDate(claim.reportedDate)}</dd>
            <dt>Current Status</dt>
            <dd>{claim.statusId ? ClaimStatusName[claim.statusId] : '—'}</dd>
            <dt>Chassis Number</dt>
            <dd>{vehicle?.chassisNumber || '—'}</dd>
            <dt>Engine Number</dt>
            <dd>{vehicle?.engineNumber || '—'}</dd>
            <dt>IDV</dt>
            <dd>{formatCurrency(policy?.idv)}</dd>
            <dt>Policy Type</dt>
            <dd>{policy?.policyTypeId ? (PolicyTypeName[policy.policyTypeId] ?? '—') : '—'}</dd>
            <dt>Policy Period</dt>
            <dd>
              {policy ? `${formatDate(policy.startDate)} – ${formatPolicyEndDate(policy.endDate)}` : '—'}
            </dd>
            <dt>Add-ons</dt>
            <dd>{policy?.addOns || '—'}</dd>
          </dl>
        )}
      </section>

      <div className="inspection-two-col-row">
        <section className="card survey-section">
          <div className="survey-section-title">
            <span className="survey-section-icon"><MapPin size={17} /></span>
            <h2>Survey Information</h2>
          </div>
          <div className="survey-grid">
            <div className="survey-field">
              <label>Surveyor</label>
              <input
                value={assessment?.surveyorName ?? (myAssignment ? displayName : '—')}
                disabled
              />
            </div>
            <div className="survey-field">
              <label htmlFor="survey-date">Survey Date</label>
              <input
                id="survey-date"
                type="date"
                value={form.inspectionDate}
                disabled={!editable}
                onChange={(e) => setForm((f) => ({ ...f, inspectionDate: e.target.value }))}
              />
            </div>
            <div className="survey-field">
              <label htmlFor="survey-location">Location</label>
              <input
                id="survey-location"
                list="survey-location-options"
                value={form.surveyLocation}
                disabled={!editable}
                placeholder="Select or type a location"
                onChange={(e) => setForm((f) => ({ ...f, surveyLocation: e.target.value }))}
              />
              <datalist id="survey-location-options">
                <option value="Coimbatore" />
                <option value="Chennai" />
                <option value="Madurai" />
                <option value="Tiruchirappalli" />
                <option value="Salem" />
                <option value="Tirunelveli" />
                <option value="Erode" />
                <option value="Vellore" />
                <option value="Thoothukudi" />
                <option value="Thanjavur" />
                <option value="Bengaluru" />
                <option value="Hyderabad" />
                <option value="Mumbai" />
              </datalist>
            </div>
            <div className="survey-field">
              <label>Survey Type</label>
              <input value={surveyTypeId ? InspectionModeName[surveyTypeId] : '—'} disabled />
            </div>
            <div className="survey-field">
              <label htmlFor="survey-workshop-name">Workshop Name</label>
              <input
                id="survey-workshop-name"
                list="survey-workshop-name-options"
                value={form.estimatedRepairerName}
                disabled={!editable}
                placeholder="Select or type a workshop name"
                onChange={(e) => setForm((f) => ({ ...f, estimatedRepairerName: e.target.value }))}
              />
              <datalist id="survey-workshop-name-options">
                {REPAIRER_MASTER.map((entry) => (
                  <option key={entry.id} value={entry.workshopName} />
                ))}
              </datalist>
            </div>
            <div className="survey-field">
              <label htmlFor="survey-repairer-type">Type of Repairer</label>
              <select
                id="survey-repairer-type"
                value={form.repairerTypeId}
                disabled={!editable}
                onChange={(e) => setForm((f) => ({ ...f, repairerTypeId: e.target.value }))}
              >
                <option value="">Select…</option>
                {Object.values(RepairerType).map((id) => (
                  <option key={id} value={id}>
                    {RepairerTypeName[id]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="card survey-section">
          <div className="survey-section-title">
            <span className="survey-section-icon"><Camera size={17} /></span>
            <h2>Photos &amp; Documents</h2>
          </div>

          <h3 className="survey-doc-group-title">Vehicle Photos</h3>
          <div className="upload-grid">
            <UploadCard
              label="Front"
              claimId={claim.claimId}
              documentTypeId={DocumentType.VehicleFront}
              onUploaded={(doc) => setDocuments((d) => [...d, doc])}
            />
            <UploadCard
              label="Left"
              claimId={claim.claimId}
              documentTypeId={DocumentType.VehicleLeft}
              onUploaded={(doc) => setDocuments((d) => [...d, doc])}
            />
            <UploadCard
              label="Back"
              claimId={claim.claimId}
              documentTypeId={DocumentType.VehicleBack}
              onUploaded={(doc) => setDocuments((d) => [...d, doc])}
            />
            <UploadCard
              label="Right"
              claimId={claim.claimId}
              documentTypeId={DocumentType.VehicleRight}
              onUploaded={(doc) => setDocuments((d) => [...d, doc])}
            />
            <UploadCard
              label="Damage 1"
              claimId={claim.claimId}
              documentTypeId={DocumentType.DamagePhoto}
              onUploaded={(doc) => setDocuments((d) => [...d, doc])}
            />
            <UploadCard
              label="Damage 2"
              claimId={claim.claimId}
              documentTypeId={DocumentType.DamagePhoto2}
              onUploaded={(doc) => setDocuments((d) => [...d, doc])}
            />
          </div>

          <h3 className="survey-doc-group-title">Repair Quotation / Survey Report</h3>
          <div className="upload-grid">
            <UploadCard
              label="Repair Quotation"
              claimId={claim.claimId}
              documentTypeId={DocumentType.RepairEstimateDocument}
              onUploaded={(doc) => setDocuments((d) => [...d, doc])}
            />
            <UploadCard
              label="Survey Report"
              claimId={claim.claimId}
              documentTypeId={DocumentType.SurveyReportDocument}
              onUploaded={(doc) => setDocuments((d) => [...d, doc])}
            />
          </div>

        </section>
      </div>

      <section className="card survey-section">
        <div className="survey-section-title">
          <span className="survey-section-icon"><Gauge size={17} /></span>
          <h2>Vehicle Damage Inspection</h2>
        </div>
        <div className="survey-damage-top-row">
          <div className="survey-field">
            <label htmlFor="odometer">Odometer Reading (km)</label>
            <input
              id="odometer"
              type="number"
              min="0"
              value={form.odometerReading}
              disabled={!editable}
              onChange={(e) => setForm((f) => ({ ...f, odometerReading: e.target.value }))}
            />
          </div>
          <div className="survey-field">
            <label htmlFor="damage-type">Damage Type</label>
            <select
              id="damage-type"
              value={form.damageTypeId}
              disabled={!editable}
              onChange={(e) => setForm((f) => ({ ...f, damageTypeId: e.target.value }))}
            >
              <option value="">Select…</option>
              {Object.entries(LossTypeName).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="survey-field survey-field-checkbox">
            <label>
              <input
                type="checkbox"
                checked={form.totalLoss}
                disabled={!editable}
                onChange={(e) => setForm((f) => ({ ...f, totalLoss: e.target.checked }))}
              />
              Total Loss Indicator
            </label>
          </div>
          <div className="survey-field survey-field-checkbox">
            <label>
              <input
                type="checkbox"
                checked={form.surveyorFlaggedSuspicious}
                disabled={!editable}
                onChange={(e) =>
                  setForm((f) => ({ ...f, surveyorFlaggedSuspicious: e.target.checked }))
                }
              />
              Flag claim as suspicious / recommend investigation
            </label>
          </div>
          <div className="survey-field survey-field-checkbox">
            <label>
              <input
                type="checkbox"
                checked={form.preExistingDamageSuspected}
                disabled={!editable}
                onChange={(e) =>
                  setForm((f) => ({ ...f, preExistingDamageSuspected: e.target.checked }))
                }
              />
              Pre-existing damage suspected (claimed as new)
            </label>
          </div>
        </div>

        <div className="survey-damage-table-wrap">
          <table className="survey-damage-table">
            <thead>
              <tr>
                <th>Component</th>
                <th>Category</th>
                <th>Severity</th>
                <th>Repair</th>
                <th>Replace</th>
                <th>Labour (₹)</th>
                <th>Parts Amount (₹)</th>
                {editable && <th className="survey-damage-remove-col"></th>}
              </tr>
            </thead>
            <tbody>
              {damageItems.length === 0 && (
                <tr>
                  <td colSpan={editable ? 8 : 7} className="survey-damage-empty">
                    No damaged components added yet.
                  </td>
                </tr>
              )}
              {damageItems.map((item, index) => (
                <tr key={index}>
                  <td>
                    <input
                      value={item.componentName}
                      disabled={!editable}
                      placeholder="e.g. Front Bumper"
                      onChange={(e) => updateDamageItem(index, { componentName: e.target.value })}
                    />
                  </td>
                  <td>
                    <select
                      value={item.damageCategoryId ?? ''}
                      disabled={!editable}
                      onChange={(e) =>
                        updateDamageItem(index, {
                          damageCategoryId: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    >
                      <option value="">—</option>
                      {Object.entries(DamageCategoryName).map(([id, label]) => (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={item.severityId ?? ''}
                      disabled={!editable}
                      onChange={(e) =>
                        updateDamageItem(index, {
                          severityId: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    >
                      <option value="">—</option>
                      {Object.entries(DamageSeverityName).map(([id, label]) => (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="survey-damage-checkbox-cell">
                    <input
                      type="radio"
                      name={`repair-replace-${index}`}
                      checked={item.repairRequired}
                      disabled={!editable}
                      onChange={() =>
                        updateDamageItem(index, {
                          repairRequired: true,
                          replacementRequired: false,
                          partsAmount: null,
                        })
                      }
                    />
                  </td>
                  <td className="survey-damage-checkbox-cell">
                    <input
                      type="radio"
                      name={`repair-replace-${index}`}
                      checked={item.replacementRequired}
                      disabled={!editable}
                      onChange={() =>
                        updateDamageItem(index, {
                          repairRequired: false,
                          replacementRequired: true,
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.labourAmount ?? ''}
                      disabled={!editable}
                      onChange={(e) =>
                        updateDamageItem(index, {
                          labourAmount: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.partsAmount ?? ''}
                      disabled={!editable || item.repairRequired}
                      title={item.repairRequired ? 'Not applicable when Repair is selected' : undefined}
                      onChange={(e) =>
                        updateDamageItem(index, {
                          partsAmount: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    />
                  </td>
                  {editable && (
                    <td className="survey-damage-remove-col">
                      <button
                        type="button"
                        className="survey-icon-button survey-icon-button-danger"
                        onClick={() => removeDamageItem(index)}
                        title="Remove row"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {editable && (
          <button type="button" className="survey-add-row-button" onClick={addDamageItem}>
            <Plus size={14} /> Add component
          </button>
        )}
      </section>

      <section className="card survey-section survey-section-computation">
        <div className="survey-section-title">
          <span className="survey-section-icon"><Calculator size={17} /></span>
          <h2>Assessment Computation</h2>
        </div>
        <div className="survey-computation-columns">
          <div className="survey-computation-col">
            <div className="survey-field">
              <label>Total Labour</label>
              <input value={formatCurrency(totalLabourAmount)} disabled />
            </div>
            <div className="survey-field">
              <label>Total Parts</label>
              <input value={formatCurrency(totalPartsAmount)} disabled />
            </div>
            <div className="survey-field">
              <label htmlFor="tax-amount">Tax (₹)</label>
              <input
                id="tax-amount"
                type="number"
                min="0"
                value={form.taxAmount}
                disabled={!editable}
                onChange={(e) => setForm((f) => ({ ...f, taxAmount: e.target.value }))}
              />
            </div>
            <div className="survey-computation-line survey-computation-subtotal">
              <span>Gross</span>
              <strong>{formatCurrency(assessment?.grossAssessmentAmount ?? previewGross)}</strong>
            </div>
          </div>

          <div className="survey-computation-col">
            <div className="survey-field">
              <label htmlFor="depreciation">Depreciation (₹)</label>
              <input
                id="depreciation"
                type="number"
                min="0"
                value={form.depreciationAmount}
                disabled={!editable}
                onChange={(e) => setForm((f) => ({ ...f, depreciationAmount: e.target.value }))}
              />
            </div>
            <div className="survey-field">
              <label htmlFor="excess">Policy Excess (₹)</label>
              <input
                id="excess"
                type="number"
                min="0"
                value={form.compulsoryExcess}
                disabled={!editable}
                onChange={(e) => setForm((f) => ({ ...f, compulsoryExcess: e.target.value }))}
              />
            </div>
            <div className="survey-field">
              <label htmlFor="salvage">Salvage (₹)</label>
              <input
                id="salvage"
                type="number"
                min="0"
                value={form.salvageAmount}
                disabled={!editable}
                onChange={(e) => setForm((f) => ({ ...f, salvageAmount: e.target.value }))}
              />
            </div>
            <div className="survey-computation-line survey-computation-subtotal">
              <span>Total</span>
              <strong>{formatCurrency(totalDeductions)}</strong>
            </div>
          </div>
        </div>

        <div className="survey-computation-summary">
          <div className="survey-computation-line survey-computation-net">
            <span>Net Assessment Amount</span>
            <strong>{formatCurrency(assessment?.netAssessmentAmount ?? previewNet)}</strong>
          </div>
        </div>
      </section>

      <section className="card survey-section">
        <div className="survey-section-title">
          <span className="survey-section-icon"><Activity size={17} /></span>
          <h2>Remarks</h2>
        </div>
        <div className="survey-grid">
          <div className="survey-field survey-field-wide">
            <label htmlFor="assessment-remarks">Remarks</label>
            <TextareaWithMic
              id="assessment-remarks"
              value={form.assessmentRemarks}
              disabled={!editable}
              rows={3}
              onChange={(value) => setForm((f) => ({ ...f, assessmentRemarks: value }))}
            />
          </div>
        </div>
      </section>

      {editable && (
        <div className="survey-actions">
          <motion.button
            type="button"
            className="survey-action-secondary"
            onClick={() => void handleSaveDraft()}
            disabled={saving || completing}
            whileTap={{ scale: 0.97 }}
          >
            <Save size={15} /> {saving ? 'Saving…' : 'Save as Draft'}
          </motion.button>
          <motion.button
            type="button"
            className="survey-action-secondary"
            onClick={() => setShowPreview(true)}
            disabled={saving || completing}
            whileTap={{ scale: 0.97 }}
          >
            <Eye size={15} /> Preview Assessment
          </motion.button>
          <motion.button
            type="button"
            className="survey-action-primary"
            onClick={() => setShowCompleteConfirm(true)}
            disabled={saving || completing}
            whileTap={{ scale: 0.97 }}
          >
            <Send size={15} /> Complete Assessment
          </motion.button>
        </div>
      )}

      <Modal open={showPreview} onClose={() => setShowPreview(false)} title="Assessment Preview">
        <dl className="survey-fact-grid">
          <dt>Survey Date</dt>
          <dd>{formatDate(form.inspectionDate)}</dd>
          <dt>Location</dt>
          <dd>{form.surveyLocation || '—'}</dd>
          <dt>Total Loss</dt>
          <dd>{form.totalLoss ? 'Yes' : 'No'}</dd>
          <dt>Damaged Components</dt>
          <dd>{damageItems.filter((i) => i.componentName.trim() !== '').length}</dd>
          <dt>Gross Assessment Amount</dt>
          <dd>{formatCurrency(previewGross)}</dd>
          <dt>Net Assessment Amount</dt>
          <dd>{formatCurrency(previewNet)}</dd>
        </dl>
        <button type="button" onClick={() => setShowPreview(false)}>
          Close
        </button>
      </Modal>

      <Modal
        open={showCompleteConfirm}
        onClose={() => setShowCompleteConfirm(false)}
        title="Complete this assessment?"
      >
        <p>
          This will save your latest entries, submit the assessment for review, and mark this
          claim's survey as completed. This can't be undone.
        </p>
        <button type="button" onClick={() => void handleComplete()} disabled={completing}>
          {completing ? 'Submitting…' : 'Yes, complete assessment'}
        </button>{' '}
        <button type="button" onClick={() => setShowCompleteConfirm(false)} disabled={completing}>
          Cancel
        </button>
      </Modal>
    </div>
  )
}