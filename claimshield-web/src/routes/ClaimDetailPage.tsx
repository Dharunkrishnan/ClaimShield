import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CreatePaymentForm } from '../components/CreatePaymentForm'
import {
  ApiError,
  approveRepairEstimate,
  clearInfoRequest,
  closeClaim,
  getClaim,
  getClaimDocuments,
  getDecisionHistory,
  getDocumentDownloadUrl,
  getInternalClaimScoring,
  getLatestDecision,
  getPaymentsByClaim,
  getRepairEstimatesByClaim,
  getSurveyAssessment,
  closeOrDenyFromRepairAuthorization,
  holdClaim,
  rejectRepairEstimate,
  requestAdditionalInfo,
  resumeClaim,
  submitApproverDecision,
  submitSurveyorDecision,
  updateRepairAuthorization,
} from '../lib/api'
import type {
  ClaimDecisionResponseDto,
  ClaimDocumentResponseDto,
  ClaimResponseDto,
  InternalClaimScoringDto,
  PaymentResponseDto,
  RepairEstimateResponseDto,
  SurveyAssessmentResponseDto,
} from '../lib/types'
import { Decision, DecisionName } from '../lib/types'
import { useAuth } from '../context/AuthContext'
import { RoleId } from '../lib/roles'
import {
  ClaimStatus,
  ClosureReason,
  ClosureReasonName,
  DocumentType,
  RepairAuthorizationStatus,
  RepairAuthorizationStatusName,
  RepairAuthClosureReason,
  RepairAuthClosureReasonName,
  RepairAuthDenialReason,
  RepairAuthDenialReasonName,
  RepairerTypeName,
  LossTypeName,
} from '../lib/statuses'
import { SurveyAssessment } from '../components/SurveyAssessment'
import { DecisionSupportSummary } from '../components/DecisionSupportSummary'
import { ClaimSettlementCard } from '../components/ClaimSettlementCard'
import { InvoiceParticularsCard } from '../components/InvoiceParticularsCard'
import { ApprovalSummaryCard } from '../components/ApprovalSummaryCard'
import { ClaimStatusBadge } from '../components/StatusBadge'
import { ClaimLifecycleStepper, STAGE_PATHS, getReachableStageIndex } from '../components/ClaimLifecycleStepper'
import { TextareaWithMic } from '../components/TextareaWithMic'


function formatCurrency(amount: number | null) {
  return amount != null ? `₹ ${amount.toLocaleString('en-IN')}` : '—'
}

// Computed live from the claim's own Liability* fields (the same ones
// shown and saved on the Liability page's Assessment Summary) instead
// of relying on Claim.ApprovedAmount - that field depends on several
// different code paths (SubmitLiabilityAsync, manual DB fixes) all
// having correctly run for a given claim, and hasn't reliably done so.
// The Liability* fields themselves are confirmed saving correctly, so
// computing directly from them here is the more trustworthy source.
function computeLiveApprovedAmount(claim: ClaimResponseDto): number {
  const gross =
    (claim.liabilityTotalLabour ?? 0) + (claim.liabilityTotalParts ?? 0) +
    (claim.liabilityTaxAmount ?? 0)
  const totalDeduction =
    (claim.liabilityDepreciationAmount ?? 0) + (claim.liabilityCompulsoryExcess ?? 0) +
    (claim.liabilityImposedExcess ?? 0) + (claim.liabilitySalvageDeductions ?? 0) +
    (claim.liabilityOtherDeduction ?? 0)
  const net = gross - totalDeduction
  return net < 0 ? 0 : net
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : '—'
}

function daysSince(value: string | null): number | null {
  if (!value) return null
  const ms = Date.now() - new Date(value).getTime()
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)))
}

function bandClass(bandName: string) {
  return `band-badge band-${bandName.toLowerCase()}`
}

function BandBadge({ bandName }: { bandName: string }) {
  return <span className={bandClass(bandName)}>{bandName}</span>
}

export function ClaimDetailPage() {
  const { claimId, stage: stageParam } = useParams<{ claimId: string; stage?: string }>()
  const navigate = useNavigate()
  const stage = (stageParam ?? 'inspection') as (typeof STAGE_PATHS)[number]
  const { roleId, session } = useAuth()
  const currentUserId = session?.user.id ?? null

  const [claim, setClaim] = useState<ClaimResponseDto | null>(null)
  const [scoring, setScoring] = useState<InternalClaimScoringDto | null>(null)
  const [decisions, setDecisions] = useState<ClaimDecisionResponseDto[]>([])
  const [documents, setDocuments] = useState<ClaimDocumentResponseDto[]>([])
  const [estimates, setEstimates] = useState<RepairEstimateResponseDto[]>([])
  const [payments, setPayments] = useState<PaymentResponseDto[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    if (!claimId) return

    setLoading(true)
    setLoadError(null)

    try {
      const claimData = await getClaim(claimId)

      const decisionsPromise =
        roleId === RoleId.Surveyor
          ? getLatestDecision(claimId).then((d) => (d ? [d] : []))
          : getDecisionHistory(claimId).catch(() => [])

      const [
        scoringData,
        decisionData,
        documentData,
        estimateData,
        paymentData,
      ] = await Promise.all([
        getInternalClaimScoring(claimId).catch(() => null),
        decisionsPromise,
        getClaimDocuments(claimId).catch(() => []),
        getRepairEstimatesByClaim(claimId).catch(() => []),
        getPaymentsByClaim(claimId).catch(() => []),
      ])

      setClaim(claimData)
      setScoring(scoringData)
      setDecisions(decisionData)
      setDocuments(documentData)
      setEstimates(estimateData)
      setPayments(paymentData)
    } catch (err) {
      setLoadError(
        err instanceof ApiError ? err.message : 'Failed to load this claim.',
      )
    } finally {
      setLoading(false)
    }
  }, [claimId, roleId])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const handleStageClick = (index: number) => {
    if (!claimId) return
    navigate(`/claims/${claimId}/${STAGE_PATHS[index]}`)
  }

  // Guard against reaching a stage's page a claim hasn't actually
  // gotten to yet - via a typed URL, browser back/forward, or a stale
  // link - not just via the stepper's own (already-disabled) clicks.
  useEffect(() => {
    if (loading || !claim || !claimId) return
    const requestedIndex = STAGE_PATHS.indexOf(stage)
    const reachableIndex = getReachableStageIndex(
      claim.statusId,
      payments,
      claim.repairAuthorizationStatusId,
      claim.liabilitySubmitted,
    )
    if (requestedIndex > reachableIndex) {
      navigate(`/claims/${claimId}/${STAGE_PATHS[reachableIndex]}`, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, claim, claimId, stage, payments])

  if (loading) {
    return <p>Loading…</p>
  }

  if (loadError || !claim) {
    return <p className="error-text">{loadError ?? 'Claim not found.'}</p>
  }

  // Checkpoint 5 (Module 5) added Hold/Resume/Return-for-Rework/Request
  // Info rows to the same ClaimDecisions table as real Approve/Review/
  // Deny maker-checker decisions. The backend's own "already decided"
  // check (ClaimDecisionService.MakerCheckerDecisionIds) correctly
  // ignores those administrative rows - this must match it exactly, or
  // e.g. a Surveyor who merely requested more info would incorrectly
  // and permanently lose the ability to submit a real decision on this
  // claim (canSurveyorDecide going false forever), even though the
  // backend would still accept one.
  const isMakerCheckerDecision = (d: ClaimDecisionResponseDto) =>
    d.decision === Decision.Approve ||
    d.decision === Decision.Review ||
    d.decision === Decision.Deny

  const latestMakerCheckerDecision = decisions.find(isMakerCheckerDecision) ?? null

  const isOpenEscalation =
    latestMakerCheckerDecision != null &&
    latestMakerCheckerDecision.roleId === RoleId.Surveyor &&
    claim.statusId === ClaimStatus.SurveyCompleted

  const canSurveyorDecide =
    roleId === RoleId.Surveyor &&
    claim.statusId === ClaimStatus.SurveyCompleted &&
    !decisions.some(isMakerCheckerDecision)

  const canApproverDecide =
    (roleId === RoleId.Approver || roleId === RoleId.Admin) &&
    isOpenEscalation

  const canManagePaymentsAndEstimates =
    roleId === RoleId.Surveyor || roleId === RoleId.Approver || roleId === RoleId.Admin

  // Once decided, canSurveyorDecide/canApproverDecide correctly go
  // false forever (claim.statusId has moved on) - but the form itself
  // should stay visible, just read-only, rather than vanish. Find
  // whichever decision was actually recorded for each role so it can
  // be shown pre-filled.
  const surveyorDecision =
    decisions.find((d) => isMakerCheckerDecision(d) && d.roleId === RoleId.Surveyor) ?? null
  const approverDecision =
    decisions.find((d) => isMakerCheckerDecision(d) && d.roleId === RoleId.Approver) ?? null

  const showSurveyorDecisionForm =
    canSurveyorDecide || (roleId === RoleId.Surveyor && surveyorDecision != null)
  const showApproverDecisionForm =
    canApproverDecide ||
    ((roleId === RoleId.Approver || roleId === RoleId.Admin) && approverDecision != null)

  const canComputeSettlement =
    roleId === RoleId.Surveyor || roleId === RoleId.Approver || roleId === RoleId.Admin

  // Checkpoint 3 - Claim Closure (Module 10). Customer self-service
  // closure already exists on MyClaimDetailPage; this extends it to the
  // Claims Handler (Surveyor) as part of their own claim lifecycle.
  const canCloseClaim =
    roleId === RoleId.Surveyor &&
    (claim.statusId === ClaimStatus.Settled || claim.statusId === ClaimStatus.Rejected)

  // Checkpoint 5 (Module 5) - On Hold / Resume, Return for Rework,
  // Request Additional Information, Send for Review.
  const finalizedStatuses: number[] = [
    ClaimStatus.Approved,
    ClaimStatus.Rejected,
    ClaimStatus.Settled,
    ClaimStatus.Closed,
  ]

  const canHold =
    roleId === RoleId.Surveyor &&
    claim.statusId !== ClaimStatus.OnHold &&
    !finalizedStatuses.includes(claim.statusId ?? 0)

  const canResume =
    roleId === RoleId.Surveyor && claim.statusId === ClaimStatus.OnHold

  const canManageInfoRequest =
    roleId === RoleId.Surveyor && claim.statusId !== ClaimStatus.Closed

  return (
    <div className="claim-detail">
      <div className="claim-detail-sticky-header">
        <p className="claim-detail-back-link">
          <Link to="/queue">← Back to my queue</Link>
        </p>

        <div className="claim-detail-info-row">
          <div className="claim-detail-info-item">
            <span className="claim-detail-info-label">Claim Number:</span>
            <span className="claim-detail-info-value">{claim.claimNumber}</span>
          </div>

          <div className="claim-detail-info-item">
            <span className="claim-detail-info-label">Policy Number:</span>
            <span className="claim-detail-info-value">{claim.policyNumber ?? '—'}</span>
          </div>

          <div className="claim-detail-info-item">
            <span className="claim-detail-info-label">Insured Name:</span>
            <span className="claim-detail-info-value">{claim.customerName ?? '—'}</span>
          </div>

          <div className="claim-detail-info-item">
            <span className="claim-detail-info-label">Status:</span>
            <ClaimStatusBadge statusId={claim.statusId} />
          </div>
        </div>

        <div className="claim-detail-info-row">
          <div className="claim-detail-info-item">
            <span className="claim-detail-info-label">Vehicle No:</span>
            <span className="claim-detail-info-value">
              {claim.vehicleRegistrationNumber ?? '—'}
            </span>
          </div>

          <div className="claim-detail-info-item">
            <span className="claim-detail-info-label">Loss Type:</span>
            <span className="claim-detail-info-value">
              {claim.lossTypeId != null ? (LossTypeName[claim.lossTypeId] ?? '—') : '—'}
            </span>
          </div>

          <div className="claim-detail-info-item">
            <span className="claim-detail-info-label">Location:</span>
            <span className="claim-detail-info-value">
              {claim.incidentLocation ?? '—'}
            </span>
          </div>

          <div className="claim-detail-info-item">
            <span className="claim-detail-info-label">Age:</span>
            {(() => {
              const ageDays = daysSince(claim.reportedDate ?? claim.createdDate ?? claim.incidentDate)
              if (ageDays == null) return <span className="claim-detail-info-value">—</span>

              const ageClass =
                ageDays <= 7
                  ? 'claim-age-green'
                  : ageDays < 15
                    ? 'claim-age-amber'
                    : 'claim-age-red'

              return <span className={ageClass}>{ageDays}d</span>
            })()}
          </div>
        </div>

        <ClaimLifecycleStepper
          statusId={claim.statusId}
          payments={payments}
          repairAuthorizationStatusId={claim.repairAuthorizationStatusId}
          liabilitySubmitted={claim.liabilitySubmitted}
          onStepClick={handleStageClick}
        />
      </div>

      {stage === 'inspection' && (
        (roleId === RoleId.Surveyor ||
          roleId === RoleId.Approver ||
          roleId === RoleId.Admin) && (
          <SurveyAssessment
            claim={claim}
            roleId={roleId}
            currentUserId={currentUserId}
            onCompleted={() => void loadAll()}
          />
        )
      )}

      {actionMessage && <p className="success-text banner">{actionMessage}</p>}

      {stage === 'decision-support-risk' && (
        <div className="decision-support-risk-stage">
          {scoring && (
            <section className="card">
              <h2>
                Risk scoring <BandBadge bandName={scoring.compositeBandName} />
              </h2>
              <dl className="fact-grid">
                <dt>Composite score</dt>
                <dd>{scoring.compositeScore}</dd>

                <dt>Last scored</dt>
                <dd>{formatDate(scoring.lastScoredAt)}</dd>
              </dl>

              <div className="stage-blocks-row">
                {scoring.stages.map((scoringStage) => (
                  <div key={scoringStage.stage} className="stage-block">
                    <h3>
                      {scoringStage.stageName} <BandBadge bandName={scoringStage.bandName} />
                      {scoringStage.hardFlagTriggered && (
                        <span className="badge">hard rule triggered</span>
                      )}
                    </h3>
                    <dl className="fact-grid">
                      <dt>Score</dt>
                      <dd>{scoringStage.scoreValue}</dd>

                      <dt>Scored at</dt>
                      <dd>{formatDate(scoringStage.scoredAt)}</dd>

                      <dt>Rule set version</dt>
                      <dd>{scoringStage.ruleSetVersion}</dd>
                    </dl>
                    {scoringStage.triggeredRuleIds.length > 0 && (
                      <ul className="rule-id-list">
                        {scoringStage.triggeredRuleIds.map((ruleId) => (
                          <li key={ruleId}>{ruleId}</li>
                        ))}
                      </ul>
                    )}
                    <p className="reasoning-text">{scoringStage.reasonText}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {claim.statusId === ClaimStatus.OnHold && (
            <section className="card">
              <h2>On hold</h2>
              <p>
                This claim was placed on hold on {formatDate(claim.onHoldDate)}.
              </p>
              <p>
                <strong>Reason:</strong> {claim.holdReason}
              </p>
            </section>
          )}

          {claim.infoRequestReason && (
            <section className="card">
              <h2>Additional information requested</h2>
              <p>
                Requested from{' '}
                {claim.infoRequestedFromRoleId === RoleId.Customer ? 'the Customer' : 'the Repairer'}{' '}
                on {formatDate(claim.infoRequestedDate)}.
              </p>
              <p>{claim.infoRequestReason}</p>
            </section>
          )}

          {canResume && (
            <HoldResumeForm
              claimId={claim.claimId}
              canResume={canResume}
              onDone={(message) => {
                setActionMessage(message)
                void loadAll()
              }}
            />
          )}

          <div className="decision-two-col-row">
            {canManageInfoRequest && (
              <InfoRequestForm
                claimId={claim.claimId}
                hasOpenRequest={!!claim.infoRequestReason}
                onDone={(message) => {
                  setActionMessage(message)
                  void loadAll()
                }}
              />
            )}

            {(roleId === RoleId.Surveyor ||
              roleId === RoleId.Approver ||
              roleId === RoleId.Admin) && <DecisionSupportSummary claimId={claim.claimId} />}
          </div>

          <div className="decision-two-col-row">
            {showSurveyorDecisionForm && (
              <>
                <DecisionForm
                  title="Record your decision"
                  options={[Decision.Approve, Decision.Review, Decision.Deny]}
                  onSubmit={(decision, reasoning) =>
                    submitSurveyorDecision(claim.claimId, decision, reasoning)
                  }
                  onHold={canHold ? (reason) => holdClaim(claim.claimId, reason) : undefined}
                  onDone={(message) => {
                    setActionMessage(message)
                    void loadAll()
                  }}
                  readOnly={!canSurveyorDecide}
                  existingDecision={surveyorDecision}
                />
              </>
            )}

            {showApproverDecisionForm && (
              <DecisionForm
                title="Record your approval decision"
                options={[Decision.Approve, Decision.Deny]}
                onSubmit={(decision, reasoning) =>
                  submitApproverDecision(claim.claimId, decision, reasoning)
                }
                onDone={(message) => {
                  setActionMessage(message)
                  void loadAll()
                }}
                readOnly={!canApproverDecide}
                existingDecision={approverDecision}
              />
            )}

            <section className="card">
              <h2>Decision history</h2>
              {decisions.length === 0 && <p>No decision has been recorded yet.</p>}
              {decisions.length > 0 && (
                <ul className="timeline">
                  {decisions.map((d) => (
                    <li key={d.claimDecisionId}>
                      <strong>
                        {d.roleName}: {d.decisionName}
                      </strong>{' '}
                      by {d.decidedByName} on {formatDate(d.decisionDate)}
                      {d.escalated && (
                        <span className="badge">awaiting Approver</span>
                      )}
                      <p>{d.reasoning}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}

      {stage === 'repair-authorization' && (
        <>
          <div className="repair-auth-two-col-row">
            <RepairAuthorizationCard
              claim={claim}
              documents={documents}
              canEdit={
                roleId === RoleId.Surveyor || roleId === RoleId.Approver || roleId === RoleId.Admin
              }
              onDone={(message) => {
                setActionMessage(message)
                void loadAll()
              }}
            />

            {(estimates.length > 0 || canManagePaymentsAndEstimates) && (
              <section className="card repair-authorization-card">
                <h2>Repair estimates</h2>
                {estimates.length === 0 && <p>No repair estimates submitted yet.</p>}
                {estimates.length > 0 && (
                  <ul className="timeline">
                    {estimates.map((estimate) => {
                      const quotationDoc = documents.find(
                        (d) => d.documentTypeId === DocumentType.RepairEstimateDocument,
                      )
                      return (
                        <li key={estimate.repairEstimateId}>
                          <strong>{formatCurrency(estimate.estimatedAmount)}</strong>{' '}
                          submitted {formatDate(estimate.submittedDate)}
                          {estimate.estimatedCompletionDays != null && (
                            <> · {estimate.estimatedCompletionDays} day(s) estimated</>
                          )}{' '}
                          <span className="badge">
                            {estimate.approvalStatus ?? 'Pending'}
                          </span>
                          {quotationDoc && (
                            <>
                              {' '}
                              <button
                                type="button"
                                className="link-inline-button"
                                onClick={() => void downloadDocument(quotationDoc.claimDocumentId)}
                              >
                                View quotation
                              </button>
                            </>
                          )}
                          {estimate.estimateRemarks && <p>{estimate.estimateRemarks}</p>}
                          {estimate.approvalRemarks && (
                            <p>
                              <em>Reviewer note: {estimate.approvalRemarks}</em>
                            </p>
                          )}
                          {canManagePaymentsAndEstimates &&
                            estimate.approvalStatusId == null && (
                              <EstimateReviewForm
                                estimate={estimate}
                                onDone={(message) => {
                                  setActionMessage(message)
                                  void loadAll()
                                }}
                              />
                            )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            )}
          </div>
        </>
      )}

      {stage === 'liability' && (
        <>
          {canComputeSettlement && (
            <InvoiceParticularsCard
              claimId={claim.claimId}
              canEdit={
                roleId === RoleId.Surveyor || roleId === RoleId.Approver || roleId === RoleId.Admin
              }
            />
          )}

          {canComputeSettlement && (
            <ClaimSettlementCard
              claimId={claim.claimId}
              canCompute={canComputeSettlement}
              canEditAmount={
                roleId === RoleId.Surveyor || roleId === RoleId.Approver || roleId === RoleId.Admin
              }
              liabilitySubmitted={claim.liabilitySubmitted}
              liabilityFigures={{
                taxAmount: claim.liabilityTaxAmount,
                totalLabour: claim.liabilityTotalLabour,
                totalParts: claim.liabilityTotalParts,
                depWaiver: claim.liabilityDepWaiver,
                depreciationAmount: claim.liabilityDepreciationAmount,
                compulsoryExcess: claim.liabilityCompulsoryExcess,
                imposedExcess: claim.liabilityImposedExcess,
                salvageDeductions: claim.liabilitySalvageDeductions,
                otherDeduction: claim.liabilityOtherDeduction,
                towingAmount: claim.liabilityTowingAmount,
              }}
              onAmountSaved={(message) => {
                setActionMessage(message)
                void loadAll()
              }}
            />
          )}

          {canManagePaymentsAndEstimates &&
            (claim.statusId === ClaimStatus.Approved || claim.liabilitySubmitted) && (
              <CreatePaymentForm
                claimId={claim.claimId}
                claimNumber={claim.claimNumber}
                policyNumber={claim.policyNumber}
                customerName={claim.customerName}
                workshopRecommendation={claim.workshopRecommendation}
                approvedAmount={computeLiveApprovedAmount(claim)}
                submitLabel="Save"
                onDone={() => {
                  // Deliberately silent here - no toast on Liability itself,
                  // so saving bank details doesn't interrupt this stage's
                  // workflow. The Approval stage's own payment action (in
                  // ApprovalSummaryCard) still shows its own notification
                  // normally when used there.
                  void loadAll()
                }}
              />
            )}
        </>
      )}

      {stage === 'approval' && (
        <>
          <ApprovalSummaryCard
            claim={claim}
            canApprove={canApproverDecide}
            approverDecision={approverDecision}
            canManagePayments={canManagePaymentsAndEstimates}
            onApproved={(message) => {
              setActionMessage(message)
              void loadAll()
            }}
            onPaymentDone={(message) => {
              setActionMessage(message)
              void loadAll()
            }}
          />
        </>
      )}

      {stage === 'closure' && (
        <>
          {canCloseClaim && (
            <CloseClaimForm
              claimId={claim.claimId}
              claimStatusId={claim.statusId}
              onDone={(message) => {
                setActionMessage(message)
                void loadAll()
              }}
            />
          )}

          {claim.statusId === ClaimStatus.Closed && (
            <section className="card">
              <h2>Closure record</h2>
              <dl className="fact-grid">
                <dt>Reason</dt>
                <dd>
                  {claim.closureReasonId ? ClosureReasonName[claim.closureReasonId] : '—'}
                </dd>
                <dt>Remarks</dt>
                <dd>{claim.closureRemarks || '—'}</dd>
              </dl>
            </section>
          )}
        </>
      )}
    </div>
  )
}

async function downloadDocument(claimDocumentId: string) {
  try {
    const { url } = await getDocumentDownloadUrl(claimDocumentId)
    window.open(url, '_blank', 'noopener,noreferrer')
  } catch (err) {
    alert(err instanceof ApiError ? err.message : 'Failed to get download link.')
  }
}

// On Hold isn't a real Decision enum value (it's a completely separate
// claim-status action, not a maker-checker decision), so it's kept as
// a distinct sentinel here rather than folded into the Decision enum
// itself - selecting it in the radio group routes to onHold instead
// of the normal onSubmit path.
const ON_HOLD_CHOICE = -1

// Repair Authorization stage. Workshop/Repairer name and the Repair
// Quotation document are view-only here - they're real data already
// entered elsewhere (Workshop/Repair Recommendation at Register Claim,
// the quotation upload during Inspection's Photos & Documents), just
// reflected here rather than re-entered. Only Status and Date/Time are
// actually editable, saved via PATCH /api/Claims/{id}/repair-
// authorization - a narrow endpoint that never touches the claim's
// own Status or Approved Amount (see UpdateRepairAuthorizationRequest).
// YYYY-MM-DD from local date components (not .toISOString(), which is
// UTC and can roll over to the wrong day depending on the person's
// timezone and time of day) - same convention used for date inputs
// elsewhere in the app.
// Same convention, formatted for <input type="datetime-local">.
function nowDateTimeInputValue(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function RepairAuthorizationCard({
  claim,
  documents,
  canEdit,
  onDone,
}: {
  claim: ClaimResponseDto
  documents: ClaimDocumentResponseDto[]
  canEdit: boolean
  onDone: (message: string) => void
}) {
  const quotationDoc = documents.find((d) => d.documentTypeId === DocumentType.RepairEstimateDocument)

  // Due (unset) isn't a selectable dropdown option, so default the
  // form to the first real choice (Approved) when nothing has been
  // set yet - otherwise the <select> would visually show "Approved"
  // (its first available option) while the actual state silently held
  // "Due", and hitting Save without touching anything would submit
  // the wrong value.
  // Stored as a string, not a number, and only converted at the point
  // of use - removes any dependency on React's number/string coercion
  // when matching a controlled <select>'s value against its <option>
  // values (which are always strings in the DOM regardless of what
  // gets passed in), which is the most likely source of a dropdown
  // selection silently not "sticking" to component state.
  const [statusIdStr, setStatusIdStr] = useState<string>(
    claim.repairAuthorizationStatusId &&
      claim.repairAuthorizationStatusId !== RepairAuthorizationStatus.Due
      ? String(claim.repairAuthorizationStatusId)
      : String(RepairAuthorizationStatus.NotAuthorized),
  )
  const [date, setDate] = useState(() => {
    if (!claim.repairAuthorizationDate) return ''
    const d = new Date(claim.repairAuthorizationDate)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Closure / Denial - ends the claim right here at Repair
  // Authorization instead of it proceeding to Liability.
  const [closeOrDenyAction, setCloseOrDenyAction] = useState<'Closure' | 'Denial' | ''>('')
  const [closeOrDenyReasonId, setCloseOrDenyReasonId] = useState('')
  const [closeOrDenyRemarks, setCloseOrDenyRemarks] = useState('')
  const [closeOrDenySaving, setCloseOrDenySaving] = useState(false)
  const [closeOrDenyError, setCloseOrDenyError] = useState<string | null>(null)

  // Workshop Name / Type of Repairer as actually entered by the
  // Surveyor during Inspection (SurveyReport.EstimatedRepairerName /
  // RepairerTypeId) - this card now sources these facts from
  // Inspection directly rather than the Register Claim stage's
  // initial recommendation, since what the Surveyor found on-site is
  // the more current/accurate source once inspection has happened.
  const [inspectionAssessment, setInspectionAssessment] = useState<SurveyAssessmentResponseDto | null>(
    null,
  )

  useEffect(() => {
    let cancelled = false
    getSurveyAssessment(claim.claimId)
      .then((result) => {
        if (!cancelled) setInspectionAssessment(result)
      })
      .catch(() => {
        if (!cancelled) setInspectionAssessment(null)
      })
    return () => {
      cancelled = true
    }
  }, [claim.claimId])

  const handleSave = async (event: FormEvent) => {
    event.preventDefault()

    if (date && date > nowDateTimeInputValue()) {
      setError("Date & time can't be in the future.")
      return
    }

    setSaving(true)
    setError(null)

    try {
      const result = await updateRepairAuthorization({
        claimId: claim.claimId,
        repairAuthorizationStatusId: Number(statusIdStr),
        repairAuthorizationDate: date ? new Date(date).toISOString() : null,
      })
      onDone(result.message)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update repair authorization.')
    } finally {
      setSaving(false)
    }
  }

  // Distinct from Save - this is the deliberate "I'm done, unlock
  // Liability" action, only available once Completed is selected.
  // Saves the same Status/Date, but the Liability stage only actually
  // unlocks once repairAuthorizationStatusId === Completed is
  // genuinely persisted (see getStageIndex in ClaimLifecycleStepper),
  // so this button makes that moment explicit instead of it silently
  // happening the instant Authorized is picked in the dropdown.
  const handleSubmit = async () => {
    setSaving(true)
    setError(null)

    try {
      const result = await updateRepairAuthorization({
        claimId: claim.claimId,
        repairAuthorizationStatusId: RepairAuthorizationStatus.Authorized,
        repairAuthorizationDate: date ? new Date(date).toISOString() : null,
      })
      onDone(`${result.message} Liability is now unlocked.`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to submit repair authorization.')
    } finally {
      setSaving(false)
    }
  }

  const handleCloseOrDeny = async () => {
    if (!closeOrDenyAction) return

    if (!closeOrDenyReasonId) {
      setCloseOrDenyError(
        closeOrDenyAction === 'Closure' ? 'Select a closure reason.' : 'Select a denial reason.',
      )
      return
    }

    if (!closeOrDenyRemarks.trim()) {
      setCloseOrDenyError('A description is required.')
      return
    }

    setCloseOrDenySaving(true)
    setCloseOrDenyError(null)

    try {
      const result = await closeOrDenyFromRepairAuthorization(
        claim.claimId,
        closeOrDenyAction,
        Number(closeOrDenyReasonId),
        closeOrDenyRemarks,
      )
      onDone(result.message)
    } catch (err) {
      setCloseOrDenyError(
        err instanceof ApiError ? err.message : `Failed to ${closeOrDenyAction.toLowerCase()} this claim.`,
      )
    } finally {
      setCloseOrDenySaving(false)
    }
  }

  return (
    <section className="card repair-authorization-card">
      <h2>Repair Authorization</h2>

      <dl className="fact-grid">
        <dt>Workshop name</dt>
        <dd>{inspectionAssessment?.estimatedRepairerName || '—'}</dd>

        <dt>Preferred Type</dt>
        <dd>
          {inspectionAssessment?.repairerTypeId
            ? (RepairerTypeName[inspectionAssessment.repairerTypeId] ?? '—')
            : '—'}
        </dd>

        <dt>Quotation</dt>
        <dd>
          {quotationDoc ? (
            <button
              type="button"
              onClick={() => void downloadDocument(quotationDoc.claimDocumentId)}
            >
              {quotationDoc.originalFileName}
            </button>
          ) : (
            'Not uploaded yet'
          )}
        </dd>
      </dl>

      {canEdit ? (
        <form onSubmit={(e) => void handleSave(e)}>
          <div className="repair-auth-status-date-row">
            <div className="form-field">
              <label htmlFor="repair-auth-status">Status</label>
              <select
                id="repair-auth-status"
                value={statusIdStr}
                onChange={(e) => setStatusIdStr(e.target.value)}
              >
                {/* Due is the initial/unset state only (shown read-only
                    before anyone has set a status) - not something the
                    surveyor should be able to pick, so it's excluded from
                    the actual dropdown choices here. */}
                {Object.entries(RepairAuthorizationStatusName)
                  .filter(([id]) => Number(id) !== RepairAuthorizationStatus.Due)
                  .map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="repair-auth-date">Date &amp; time</label>
              <input
                id="repair-auth-date"
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                max={nowDateTimeInputValue()}
              />
            </div>
          </div>
          {date && date > nowDateTimeInputValue() && (
            <p className="error-text">Date &amp; time can't be in the future.</p>
          )}
          {error && <p className="error-text">{error}</p>}
          <button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>{' '}
          <button
            type="button"
            disabled={saving || Number(statusIdStr) !== RepairAuthorizationStatus.Authorized}
            onClick={() => void handleSubmit()}
            title={
              Number(statusIdStr) !== RepairAuthorizationStatus.Authorized
                ? 'Select Authorized to submit'
                : undefined
            }
          >
            Submit
          </button>

          <div className="repair-auth-close-deny">
            <p className="repair-auth-close-deny-label">
              Closing or denying ends this claim right here — it will not proceed to Liability.
            </p>
            <div className="repair-auth-close-deny-toggle">
              <button
                type="button"
                className={
                  closeOrDenyAction === 'Closure'
                    ? 'repair-auth-close-deny-btn active'
                    : 'repair-auth-close-deny-btn'
                }
                onClick={() => {
                  setCloseOrDenyAction('Closure')
                  setCloseOrDenyReasonId('')
                  setCloseOrDenyError(null)
                }}
              >
                1. Closure
              </button>
              <button
                type="button"
                className={
                  closeOrDenyAction === 'Denial'
                    ? 'repair-auth-close-deny-btn active repair-auth-close-deny-btn-danger'
                    : 'repair-auth-close-deny-btn repair-auth-close-deny-btn-danger'
                }
                onClick={() => {
                  setCloseOrDenyAction('Denial')
                  setCloseOrDenyReasonId('')
                  setCloseOrDenyError(null)
                }}
              >
                2. Denial
              </button>
            </div>

            {closeOrDenyAction && (
              <div className="repair-auth-close-deny-form">
                <div className="form-field">
                  <label htmlFor="close-deny-reason">
                    {closeOrDenyAction === 'Closure' ? 'Closure reason' : 'Denial reason'}
                  </label>
                  <select
                    id="close-deny-reason"
                    value={closeOrDenyReasonId}
                    onChange={(e) => setCloseOrDenyReasonId(e.target.value)}
                  >
                    <option value="">Select…</option>
                    {Object.values(
                      closeOrDenyAction === 'Closure' ? RepairAuthClosureReason : RepairAuthDenialReason,
                    ).map((id) => (
                      <option key={id} value={id}>
                        {closeOrDenyAction === 'Closure'
                          ? RepairAuthClosureReasonName[id]
                          : RepairAuthDenialReasonName[id]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label htmlFor="close-deny-remarks">Description</label>
                  <textarea
                    id="close-deny-remarks"
                    rows={3}
                    value={closeOrDenyRemarks}
                    onChange={(e) => setCloseOrDenyRemarks(e.target.value)}
                    placeholder={`Describe why this claim is being ${closeOrDenyAction === 'Closure' ? 'closed' : 'denied'}…`}
                  />
                </div>
                {closeOrDenyError && <p className="error-text">{closeOrDenyError}</p>}
                <button
                  type="button"
                  className={
                    closeOrDenyAction === 'Denial' ? 'repair-auth-close-deny-btn-danger' : undefined
                  }
                  disabled={closeOrDenySaving}
                  onClick={() => void handleCloseOrDeny()}
                >
                  {closeOrDenySaving
                    ? 'Submitting…'
                    : closeOrDenyAction === 'Closure'
                      ? 'Confirm Closure'
                      : 'Confirm Denial'}
                </button>
              </div>
            )}
          </div>
        </form>
      ) : (
        <dl className="fact-grid">
          <dt>Status</dt>
          <dd>
            {claim.repairAuthorizationStatusId
              ? RepairAuthorizationStatusName[claim.repairAuthorizationStatusId]
              : 'Due'}
          </dd>
          <dt>Date &amp; time</dt>
          <dd>
            {claim.repairAuthorizationDate
              ? new Date(claim.repairAuthorizationDate).toLocaleString()
              : '—'}
          </dd>
        </dl>
      )}
    </section>
  )
}

function DecisionForm({
  title,
  options,
  onSubmit,
  onHold,
  onDone,
  readOnly,
  existingDecision,
}: {
  title: string
  options: readonly number[]
  onSubmit: (decision: number, reasoning: string) => Promise<{ message: string }>
  onHold?: (reason: string) => Promise<{ message: string }>
  onDone: (message: string) => void
  readOnly?: boolean
  existingDecision?: ClaimDecisionResponseDto | null
}) {
  const [decision, setDecision] = useState<number>(existingDecision?.decision ?? options[0])
  const [reasoning, setReasoning] = useState(existingDecision?.reasoning ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const response =
        decision === ON_HOLD_CHOICE && onHold
          ? await onHold(reasoning)
          : await onSubmit(decision, reasoning)
      onDone(response.message)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to submit decision.')
      setSubmitting(false)
    }
  }

  return (
    <section className="card">
      <h2>{title}</h2>
      {readOnly && (
        <p className="subtitle">
          A decision has already been recorded for this stage - shown here for reference,
          no longer editable.
        </p>
      )}
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label>Decision</label>
          <div className="decision-radio-group">
            {options.map((option) => (
              <label key={option} className="decision-radio-option">
                <input
                  type="radio"
                  name="decision-choice"
                  checked={decision === option}
                  disabled={readOnly}
                  onChange={() => setDecision(option)}
                />
                {DecisionName[option]}
              </label>
            ))}
            {onHold && (
              <label className="decision-radio-option">
                <input
                  type="radio"
                  name="decision-choice"
                  checked={decision === ON_HOLD_CHOICE}
                  disabled={readOnly}
                  onChange={() => setDecision(ON_HOLD_CHOICE)}
                />
                On Hold
              </label>
            )}
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="reasoning">Survey description</label>
          <TextareaWithMic
            id="reasoning"
            value={reasoning}
            onChange={setReasoning}
            required
            disabled={readOnly}
            rows={4}
          />
        </div>

        {error && <p className="error-text">{error}</p>}

        {!readOnly && (
          <button type="submit" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit decision'}
          </button>
        )}
      </form>
    </section>
  )
}

function EstimateReviewForm({
  estimate,
  onDone,
}: {
  estimate: RepairEstimateResponseDto
  onDone: (message: string) => void
}) {
  const [amount, setAmount] = useState(String(estimate.estimatedAmount))
  const [remarks, setRemarks] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleApprove = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const response = await approveRepairEstimate(
        estimate.repairEstimateId,
        Number(amount),
        remarks,
      )
      onDone(response.message)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to approve estimate.')
      setSubmitting(false)
    }
  }

  const handleReject = async () => {
    setSubmitting(true)
    setError(null)

    try {
      const response = await rejectRepairEstimate(
        estimate.repairEstimateId,
        remarks || 'Rejected by reviewer.',
      )
      onDone(response.message)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to reject estimate.')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleApprove}>
      <div className="form-field">
        <label htmlFor={`approved-amount-${estimate.repairEstimateId}`}>
          Approved amount (₹)
        </label>
        <input
          id={`approved-amount-${estimate.repairEstimateId}`}
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          required
        />
      </div>

      <div className="form-field">
        <label htmlFor={`review-remarks-${estimate.repairEstimateId}`}>
          Remarks
        </label>
        <TextareaWithMic
          id={`review-remarks-${estimate.repairEstimateId}`}
          value={remarks}
          onChange={setRemarks}
          rows={2}
        />
      </div>

      {error && <p className="error-text">{error}</p>}

      <button type="submit" disabled={submitting}>
        {submitting ? 'Approving…' : 'Approve'}
      </button>{' '}
      <button type="button" onClick={() => void handleReject()} disabled={submitting}>
        Reject
      </button>
    </form>
  )
}

function CloseClaimForm({
  claimId,
  claimStatusId,
  onDone,
}: {
  claimId: string
  claimStatusId: number | null
  onDone: (message: string) => void
}) {
  // Default the reason to match how the claim actually got here - a
  // Rejected claim is being closed as Denied, a Settled claim as the
  // normal Approved & Settled outcome - but still let the person
  // change it, since the reason categorizes the closure itself, not
  // just restate the claim's prior status.
  const [closureReasonId, setClosureReasonId] = useState<number>(
    claimStatusId === ClaimStatus.Rejected ? ClosureReason.Denied : ClosureReason.ApprovedAndSettled,
  )
  const [remarks, setRemarks] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const result = await closeClaim(
        claimId,
        closureReasonId,
        remarks || 'Closed by Claims Handler.',
      )
      onDone(result.message)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to close claim.')
      setSubmitting(false)
    }
  }

  return (
    <section className="card">
      <h2>Close claim</h2>
      <p>Record why this claim is being closed, then close it.</p>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="closure-reason">Closure reason</label>
          <select
            id="closure-reason"
            value={closureReasonId}
            onChange={(e) => setClosureReasonId(Number(e.target.value))}
          >
            {Object.entries(ClosureReasonName).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="closure-remarks">
            {closureReasonId === ClosureReason.Denied
              ? 'Reason this claim was not approved'
              : 'Closure remarks'}
          </label>
          <TextareaWithMic
            id="closure-remarks"
            value={remarks}
            onChange={setRemarks}
            rows={3}
            placeholder={
              closureReasonId === ClosureReason.Denied
                ? 'e.g. Damage found unrelated to the reported incident.'
                : 'e.g. Payment confirmed received, customer satisfied.'
            }
          />
        </div>

        {error && <p className="error-text">{error}</p>}

        <button type="submit" disabled={submitting}>
          {submitting ? 'Closing…' : 'Close claim'}
        </button>
      </form>
    </section>
  )
}

// Put Claim On Hold used to be its own separate form here - it's now
// folded into the Decision radio group above as a 4th choice
// (On Hold), alongside Approve/Review/Deny, instead of being a
// separate action. Resuming a held claim is conceptually different
// (there's no "decision" being made, just lifting the hold) so it
// stays as its own simple action.
function HoldResumeForm({
  claimId,
  canResume,
  onDone,
}: {
  claimId: string
  canResume: boolean
  onDone: (message: string) => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleResume = async () => {
    setSubmitting(true)
    setError(null)

    try {
      const result = await resumeClaim(claimId)
      onDone(result.message)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to resume claim.')
      setSubmitting(false)
    }
  }

  if (!canResume) return null

  return (
    <section className="card">
      <h2>Resume claim</h2>
      <p>This claim is on hold. Resume it to return it to its prior status.</p>
      {error && <p className="error-text">{error}</p>}
      <button type="button" onClick={() => void handleResume()} disabled={submitting}>
        {submitting ? 'Resuming…' : 'Resume claim'}
      </button>
    </section>
  )
}

function InfoRequestForm({
  claimId,
  hasOpenRequest,
  onDone,
}: {
  claimId: string
  hasOpenRequest: boolean
  onDone: (message: string) => void
}) {
  const [reason, setReason] = useState('')
  const [fromRoleId, setFromRoleId] = useState<number>(RoleId.Customer)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRequest = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const result = await requestAdditionalInfo(claimId, reason, fromRoleId)
      onDone(result.message)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to request additional information.')
      setSubmitting(false)
    }
  }

  const handleClear = async () => {
    setSubmitting(true)
    setError(null)

    try {
      const result = await clearInfoRequest(claimId)
      onDone(result.message)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to clear information request.')
      setSubmitting(false)
    }
  }

  if (hasOpenRequest) {
    return (
      <section className="card">
        <h2>Information request</h2>
        <p>Mark this once the requested information has been received.</p>
        {error && <p className="error-text">{error}</p>}
        <button type="button" onClick={() => void handleClear()} disabled={submitting}>
          {submitting ? 'Clearing…' : 'Mark information received'}
        </button>
      </section>
    )
  }

  return (
    <section className="card">
      <h2>Request additional information</h2>
      <form onSubmit={handleRequest}>
        <div className="form-field">
          <label>Request from</label>
          <div className="decision-radio-group">
            <label className="decision-radio-option">
              <input
                type="checkbox"
                checked={fromRoleId === RoleId.Customer}
                onChange={() => setFromRoleId(RoleId.Customer)}
              />
              Customer
            </label>
            <label className="decision-radio-option">
              <input
                type="checkbox"
                checked={fromRoleId === RoleId.Repairer}
                onChange={() => setFromRoleId(RoleId.Repairer)}
              />
              Repairer
            </label>
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="info-request-reason">Reason</label>
          <TextareaWithMic
            id="info-request-reason"
            value={reason}
            onChange={setReason}
            rows={3}
            required
            placeholder="e.g. Need a clearer photo of the chassis number."
          />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Requesting…' : 'Request information'}
        </button>
      </form>
    </section>
  )
}