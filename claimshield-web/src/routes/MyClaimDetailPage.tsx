import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ApiError,
  closeClaim,
  getClaim,
  getClaimDocuments,
  getDecisionHistory,
  getDocumentDownloadUrl,
  getMyClaimScore,
  getMyCustomerProfile,
  getMyPolicies,
  getMyVehicles,
  getPaymentsByClaim,
  getRepairAssignmentsByClaim,
  getRepairers,
  getSurveyAssessment,
  uploadClaimDocument,
} from '../lib/api'
import type {
  ClaimDecisionResponseDto,
  ClaimDocumentResponseDto,
  ClaimResponseDto,
  CustomerClaimScoreDto,
  CustomerResponseDto,
  PaymentResponseDto,
  PolicyResponseDto,
  RepairAssignmentResponseDto,
  SurveyAssessmentResponseDto,
  UserResponseDto,
  VehicleResponseDto,
} from '../lib/types'
import { ClaimStatus, ClaimStatusName, ClosureReason, LossTypeName, PolicyTypeName } from '../lib/statuses'
import { RoleId } from '../lib/roles'
import { Modal } from '../components/Modal'
import { ClaimLifecycleStepper } from '../components/ClaimLifecycleStepper'
import {
  FileText,
  Shield,
  Car,
  User,
  Wrench,
  AlertTriangle,
  History,
  Upload,
  Route,
} from 'lucide-react'

function formatCurrency(amount: number | null | undefined) {
  return amount != null ? `₹ ${amount.toLocaleString('en-IN')}` : '—'
}

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString('en-IN') : '—'
}

function BandBadge({ bandName }: { bandName: string }) {
  return <span className={`band-badge band-${bandName.toLowerCase()}`}>{bandName}</span>
}

// Compact info row, reused across all 6 Claim 360 boxes.
function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="detail-item">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value}</span>
    </div>
  )
}

export function MyClaimDetailPage() {
  const { claimId } = useParams<{ claimId: string }>()

  const [claim, setClaim] = useState<ClaimResponseDto | null>(null)
  const [customer, setCustomer] = useState<CustomerResponseDto | null>(null)
  const [policy, setPolicy] = useState<PolicyResponseDto | null>(null)
  const [vehicle, setVehicle] = useState<VehicleResponseDto | null>(null)
  const [, setRepairAssignment] = useState<RepairAssignmentResponseDto | null>(null)
  const [repairerUser, setRepairerUser] = useState<UserResponseDto | null>(null)
  const [surveyAssessment, setSurveyAssessment] = useState<SurveyAssessmentResponseDto | null>(null)
  const [score, setScore] = useState<CustomerClaimScoreDto | null>(null)
  const [documents, setDocuments] = useState<ClaimDocumentResponseDto[]>([])
  const [payments, setPayments] = useState<PaymentResponseDto[]>([])
  const [decisions, setDecisions] = useState<ClaimDecisionResponseDto[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  const [showTrack, setShowTrack] = useState(false)
  const [showDocuments, setShowDocuments] = useState(false)
  const [showActivity, setShowActivity] = useState(false)

  const loadAll = useCallback(async () => {
    if (!claimId) return

    setLoading(true)
    setLoadError(null)

    try {
      const claimData = await getClaim(claimId)
      setClaim(claimData)

      const [
        customerProfile,
        scoreData,
        documentData,
        paymentData,
        decisionData,
        repairAssignments,
        repairers,
        assessment,
      ] = await Promise.all([
        getMyCustomerProfile().catch(() => null),
        getMyClaimScore(claimId).catch(() => null),
        getClaimDocuments(claimId).catch(() => []),
        getPaymentsByClaim(claimId).catch(() => []),
        getDecisionHistory(claimId).catch(() => []),
        getRepairAssignmentsByClaim(claimId).catch(() => []),
        getRepairers().catch(() => []),
        getSurveyAssessment(claimId).catch(() => null),
      ])

      setCustomer(customerProfile)
      setScore(scoreData)
      setDocuments(documentData)
      setPayments(paymentData)
      setDecisions(decisionData)
      setSurveyAssessment(assessment)

      const foundAssignment = repairAssignments[0] ?? null
      setRepairAssignment(foundAssignment)
      setRepairerUser(
        foundAssignment ? repairers.find((r) => r.userId === foundAssignment.repairerId) ?? null : null,
      )

      if (customerProfile) {
        const [policies, vehicles] = await Promise.all([
          getMyPolicies(customerProfile.customerId).catch(() => []),
          getMyVehicles(customerProfile.customerId).catch(() => []),
        ])
        setPolicy(policies.find((p) => p.policyId === claimData.policyId) ?? null)
        setVehicle(vehicles.find((v) => v.vehicleId === claimData.vehicleId) ?? null)
      }
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to load this claim.')
    } finally {
      setLoading(false)
    }
  }, [claimId])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const [closureRemarks, setClosureRemarks] = useState('')

  const handleClose = async () => {
    if (!claimId) return

    try {
      const result = await closeClaim(
        claimId,
        ClosureReason.ApprovedAndSettled,
        closureRemarks || 'Closed by customer.',
      )
      setActionMessage(result.message)
      void loadAll()
    } catch (err) {
      setActionMessage(err instanceof ApiError ? err.message : 'Failed to close claim.')
    }
  }

  if (loading) {
    return <p>Loading…</p>
  }

  if (loadError || !claim) {
    return <p className="error-text">{loadError ?? 'Claim not found.'}</p>
  }

  // claim.workshopRecommendation is saved as a combined string, e.g.
  // "Aadhi Cars Private Limited (Repairer: V Srinivasan)" - split it
  // back into the two parts, same convention as the staff Claim 360
  // page. Falls back to this when no formal RepairAssignment exists
  // yet (the common case for claims using the newer text-based
  // Workshop Recommendation flow instead of a real assigned Repairer).
  const workshopMatch = claim.workshopRecommendation?.match(/^(.*?)\s*\(Repairer:\s*(.*?)\)\s*$/)
  const workshopName = repairerUser
    ? null
    : workshopMatch
      ? workshopMatch[1]
      : claim.workshopRecommendation
  const repairerName = repairerUser
    ? `${repairerUser.firstName} ${repairerUser.lastName ?? ''}`.trim()
    : workshopMatch
      ? workshopMatch[2]
      : null

  return (
    <div className="my-claim-360">
      <p>
        <Link to="/my-claims">← Back to my claims</Link>
      </p>

      <div className="claim360-title-row">
        <h1>{claim.claimNumber}</h1>
        <span className="badge badge-icon badge-blue">
          {claim.statusId ? (ClaimStatusName[claim.statusId] ?? 'Unknown') : 'Unknown'}
        </span>
      </div>

      {claim.infoRequestReason && claim.infoRequestedFromRoleId === RoleId.Customer && (
        <section className="card">
          <h2>Additional information needed</h2>
          <p>{claim.infoRequestReason}</p>
          <p>Please contact your Claims Handler with this information as soon as possible.</p>
        </section>
      )}

      {actionMessage && <p className="success-text banner">{actionMessage}</p>}

      {/* Action row - Track Claim / Documents / Recent Activity each
          open a modal, keeping the page itself focused on the 6
          summary boxes below rather than growing into one long scroll. */}
      <div className="claim360-action-row">
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
      </div>

      {/* 6 boxes: Claim info, Policy & coverage, Vehicle, Insured,
          Repairer & survey, Loss details - every field below is real,
          sourced from the same records the staff pages use, not
          fabricated for layout's sake. */}
      <div className="claim360-box-grid">
        <section className="card claim360-box">
          <h2><FileText size={16} /> Claim Information</h2>
          <InfoRow label="Claim number" value={claim.claimNumber} />
          <InfoRow label="Status" value={claim.statusId ? ClaimStatusName[claim.statusId] : '—'} />
          <InfoRow label="Reported date" value={formatDate(claim.reportedDate)} />
          <InfoRow label="Approved amount" value={formatCurrency(claim.approvedAmount)} />
        </section>

        <section className="card claim360-box">
          <h2><Shield size={16} /> Policy &amp; Coverage</h2>
          {policy ? (
            <>
              <InfoRow label="Policy number" value={policy.policyNumber} />
              <InfoRow
                label="Policy type"
                value={policy.policyTypeId ? (PolicyTypeName[policy.policyTypeId] ?? '—') : '—'}
              />
              <InfoRow label="Coverage amount" value={formatCurrency(policy.coverageAmount)} />
              <InfoRow
                label="Policy period"
                value={`${formatDate(policy.startDate)} – ${formatDate(policy.endDate)}`}
              />
            </>
          ) : (
            <p>No policy on record.</p>
          )}
        </section>

        <section className="card claim360-box">
          <h2><Car size={16} /> Vehicle Information</h2>
          {vehicle ? (
            <>
              <InfoRow label="Registration" value={vehicle.registrationNumber} />
              <InfoRow label="Variant" value={vehicle.variant || '—'} />
              <InfoRow label="Manufacturing year" value={vehicle.manufacturingYear ?? '—'} />
              <InfoRow label="Chassis number" value={vehicle.chassisNumber} />
            </>
          ) : (
            <p>No vehicle on record.</p>
          )}
        </section>

        <section className="card claim360-box">
          <h2><User size={16} /> Insured Information</h2>
          <InfoRow label="Name" value={claim.customerName ?? '—'} />
          <InfoRow label="Gender" value={customer?.gender || '—'} />
          <InfoRow label="Date of birth" value={formatDate(customer?.dateOfBirth)} />
          <InfoRow
            label="City"
            value={[customer?.city, customer?.state].filter(Boolean).join(', ') || '—'}
          />
        </section>

        <section className="card claim360-box">
          <h2><Wrench size={16} /> Repairer &amp; Survey Info</h2>
          <InfoRow label="Workshop" value={workshopName || '—'} />
          <InfoRow label="Repairer" value={repairerName || '—'} />
          <InfoRow label="Surveyor" value={surveyAssessment?.surveyorName ?? '—'} />
          <InfoRow label="Survey date" value={formatDate(surveyAssessment?.inspectionDate)} />
        </section>

        <section className="card claim360-box">
          <h2><AlertTriangle size={16} /> Loss Details</h2>
          <InfoRow
            label="Loss type"
            value={claim.lossTypeId ? (LossTypeName[claim.lossTypeId] ?? '—') : '—'}
          />
          <InfoRow label="Incident date" value={formatDate(claim.incidentDate)} />
          <InfoRow label="Location" value={claim.incidentLocation ?? '—'} />
          <InfoRow label="Estimated loss" value={formatCurrency(claim.estimatedLossAmount)} />
        </section>
      </div>

      {score && (
        <section className="card">
          <h2>
            Claim risk assessment <BandBadge bandName={score.compositeBandName} />
          </h2>
          <dl className="fact-grid">
            <dt>Score</dt>
            <dd>{score.compositeScore}</dd>
            <dt>Last assessed</dt>
            <dd>{formatDate(score.lastScoredAt)}</dd>
          </dl>
        </section>
      )}

      {payments.length > 0 && (
        <section className="card">
          <h2>Payment status</h2>
          {(() => {
            const latest = payments[0]
            return (
              <dl className="fact-grid">
                <dt>Status</dt>
                <dd>{latest.paymentStatus}</dd>
                <dt>Amount</dt>
                <dd>{formatCurrency(latest.amount)}</dd>
                <dt>Date</dt>
                <dd>{formatDate(latest.paymentDate)}</dd>
              </dl>
            )
          })()}
        </section>
      )}

      {claim.statusId === ClaimStatus.Settled && (
        <section className="card">
          <p>
            Your claim is Settled. You can close it once you're satisfied everything is resolved.
          </p>
          <label htmlFor="closure-remarks">Closure remarks (optional)</label>
          <textarea
            id="closure-remarks"
            value={closureRemarks}
            onChange={(event) => setClosureRemarks(event.target.value)}
            rows={2}
            placeholder="e.g. Payment received, everything is resolved."
          />
          <button type="button" onClick={() => void handleClose()}>
            Close claim
          </button>
        </section>
      )}

      {claim.statusId === ClaimStatus.Closed && claim.closureRemarks && (
        <section className="card">
          <h2>Closure remarks</h2>
          <p>{claim.closureRemarks}</p>
        </section>
      )}

      <Modal open={showTrack} onClose={() => setShowTrack(false)} title="Track Claim">
        <ClaimLifecycleStepper statusId={claim.statusId} payments={payments} />
      </Modal>

      <Modal open={showDocuments} onClose={() => setShowDocuments(false)} title="Documents">
        <DocumentsSection claimId={claim.claimId} documents={documents} onUploaded={loadAll} />
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
    </div>
  )
}

function DocumentsSection({
  claimId,
  documents,
  onUploaded,
}: {
  claimId: string
  documents: ClaimDocumentResponseDto[]
  onUploaded: () => void
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
      await uploadClaimDocument(claimId, 1, file)
      if (fileInputRef.current) fileInputRef.current.value = ''
      onUploaded()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to upload document.')
    } finally {
      setUploading(false)
    }
  }

  const handleDownload = async (claimDocumentId: string) => {
    try {
      const { url } = await getDocumentDownloadUrl(claimDocumentId)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to get download link.')
    }
  }

  return (
    <div>
      {documents.length === 0 && <p>No documents uploaded yet.</p>}

      {documents.length > 0 && (
        <ul className="document-list">
          {documents.map((doc) => (
            <li key={doc.claimDocumentId}>
              {doc.originalFileName}{' '}
              <button type="button" onClick={() => void handleDownload(doc.claimDocumentId)}>
                Download
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleUpload}>
        <label htmlFor="file">Upload a supporting document</label>
        <input id="file" type="file" ref={fileInputRef} />

        {error && <p className="error-text">{error}</p>}

        <button type="submit" disabled={uploading}>
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
      </form>
    </div>
  )
}