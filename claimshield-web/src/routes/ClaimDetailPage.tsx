import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ApiError,
  approveRepairEstimate,
  cancelPayment,
  completePayment,
  createPayment,
  deletePayment,
  failPayment,
  getClaim,
  getClaimDocuments,
  getDecisionHistory,
  getDocumentDownloadUrl,
  getInternalClaimScoring,
  getLatestDecision,
  getPaymentsByClaim,
  getReassessmentComments,
  getRepairEstimatesByClaim,
  postReassessmentComment,
  processPayment,
  rejectRepairEstimate,
  submitApproverDecision,
  submitSurveyorDecision,
} from '../lib/api'
import type {
  ClaimDecisionResponseDto,
  ClaimDocumentResponseDto,
  ClaimResponseDto,
  InternalClaimScoringDto,
  PaymentResponseDto,
  ReassessmentCommentResponseDto,
  RepairEstimateResponseDto,
} from '../lib/types'
import { Decision, DecisionName } from '../lib/types'
import { useAuth } from '../context/AuthContext'
import { RoleId } from '../lib/roles'
import { ClaimStatus, ClaimStatusName, PaymentStatus } from '../lib/statuses'
import { SurveyAssessment } from '../components/SurveyAssessment'

function formatCurrency(amount: number | null) {
  return amount != null ? `₹ ${amount.toLocaleString('en-IN')}` : '—'
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : '—'
}

function bandClass(bandName: string) {
  return `band-badge band-${bandName.toLowerCase()}`
}

function BandBadge({ bandName }: { bandName: string }) {
  return <span className={bandClass(bandName)}>{bandName}</span>
}

export function ClaimDetailPage() {
  const { claimId } = useParams<{ claimId: string }>()
  const { roleId, session } = useAuth()
  const currentUserId = session?.user.id ?? null

  const [claim, setClaim] = useState<ClaimResponseDto | null>(null)
  const [scoring, setScoring] = useState<InternalClaimScoringDto | null>(null)
  const [decisions, setDecisions] = useState<ClaimDecisionResponseDto[]>([])
  const [documents, setDocuments] = useState<ClaimDocumentResponseDto[]>([])
  const [comments, setComments] = useState<ReassessmentCommentResponseDto[]>([])
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
      const decisionsPromise =
        roleId === RoleId.Surveyor
          ? getLatestDecision(claimId).then((d) => (d ? [d] : []))
          : getDecisionHistory(claimId).catch(() => [])

      const [
        claimData,
        scoringData,
        decisionData,
        documentData,
        commentData,
        estimateData,
        paymentData,
      ] = await Promise.all([
        getClaim(claimId),
        getInternalClaimScoring(claimId).catch(() => null),
        decisionsPromise,
        getClaimDocuments(claimId).catch(() => []),
        getReassessmentComments(claimId).catch(() => []),
        getRepairEstimatesByClaim(claimId).catch(() => []),
        getPaymentsByClaim(claimId).catch(() => []),
      ])

      setClaim(claimData)
      setScoring(scoringData)
      setDecisions(decisionData)
      setDocuments(documentData)
      setComments(commentData)
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

  if (loading) {
    return <p>Loading…</p>
  }

  if (loadError || !claim) {
    return <p className="error-text">{loadError ?? 'Claim not found.'}</p>
  }

  const latestDecision = decisions[0] ?? null

  const isOpenEscalation =
    latestDecision != null &&
    latestDecision.roleId === RoleId.Surveyor &&
    claim.statusId === ClaimStatus.SurveyCompleted

  const canSurveyorDecide =
    roleId === RoleId.Surveyor &&
    claim.statusId === ClaimStatus.SurveyCompleted &&
    decisions.length === 0

  const canApproverDecide =
    (roleId === RoleId.Approver || roleId === RoleId.Admin) &&
    isOpenEscalation

  const canManagePaymentsAndEstimates =
    roleId === RoleId.Approver || roleId === RoleId.Admin

  return (
    <div className="claim-detail">
      <p>
        <Link to="/queue">← Back to my queue</Link>
      </p>

      <h1>{claim.claimNumber}</h1>

      {(roleId === RoleId.Surveyor ||
        roleId === RoleId.Approver ||
        roleId === RoleId.Admin) && (
        <SurveyAssessment claim={claim} roleId={roleId} currentUserId={currentUserId} />
      )}

      <section className="card">
        <h2>Claim summary</h2>
        <dl className="fact-grid">
          <dt>Status</dt>
          <dd>{ClaimStatusName[claim.statusId ?? 0] ?? 'Unknown'}</dd>

          <dt>Incident date</dt>
          <dd>{formatDate(claim.incidentDate)}</dd>

          <dt>Reported date</dt>
          <dd>{formatDate(claim.reportedDate)}</dd>

          <dt>Estimated loss</dt>
          <dd>{formatCurrency(claim.estimatedLossAmount)}</dd>

          <dt>Approved amount</dt>
          <dd>{formatCurrency(claim.approvedAmount)}</dd>

          <dt>Fraud suspected</dt>
          <dd>{claim.isFraudSuspected ? 'Yes' : 'No'}</dd>

          <dt>Location</dt>
          <dd>{claim.incidentLocation ?? '—'}</dd>
        </dl>
        {claim.incidentDescription && (
          <>
            <h3>Description</h3>
            <p>{claim.incidentDescription}</p>
          </>
        )}
      </section>

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

          {scoring.stages.map((stage) => (
            <div key={stage.stage} className="stage-block">
              <h3>
                {stage.stageName} <BandBadge bandName={stage.bandName} />
                {stage.hardFlagTriggered && (
                  <span className="badge">hard rule triggered</span>
                )}
              </h3>
              <dl className="fact-grid">
                <dt>Score</dt>
                <dd>{stage.scoreValue}</dd>

                <dt>Scored at</dt>
                <dd>{formatDate(stage.scoredAt)}</dd>

                <dt>Rule set version</dt>
                <dd>{stage.ruleSetVersion}</dd>
              </dl>
              {stage.triggeredRuleIds.length > 0 && (
                <ul className="rule-id-list">
                  {stage.triggeredRuleIds.map((ruleId) => (
                    <li key={ruleId}>{ruleId}</li>
                  ))}
                </ul>
              )}
              <p className="reasoning-text">{stage.reasonText}</p>
            </div>
          ))}
        </section>
      )}

      {actionMessage && <p className="success-text banner">{actionMessage}</p>}

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

      {canSurveyorDecide && (
        <DecisionForm
          title="Record your decision"
          options={[Decision.Approve, Decision.Review, Decision.Deny]}
          onSubmit={(decision, reasoning) =>
            submitSurveyorDecision(claim.claimId, decision, reasoning)
          }
          onDone={(message) => {
            setActionMessage(message)
            void loadAll()
          }}
        />
      )}

      {canApproverDecide && (
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
        />
      )}

      {(estimates.length > 0 || canManagePaymentsAndEstimates) && (
        <section className="card">
          <h2>Repair estimates</h2>
          {estimates.length === 0 && <p>No repair estimates submitted yet.</p>}
          {estimates.length > 0 && (
            <ul className="timeline">
              {estimates.map((estimate) => (
                <li key={estimate.repairEstimateId}>
                  <strong>{formatCurrency(estimate.estimatedAmount)}</strong>{' '}
                  submitted {formatDate(estimate.submittedDate)}
                  {estimate.estimatedCompletionDays != null && (
                    <> · {estimate.estimatedCompletionDays} day(s) estimated</>
                  )}{' '}
                  <span className="badge">
                    {estimate.approvalStatus ?? 'Pending'}
                  </span>
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
              ))}
            </ul>
          )}
        </section>
      )}

      {(payments.length > 0 || canManagePaymentsAndEstimates) && (
        <section className="card">
          <h2>Payments</h2>
          {payments.length === 0 && <p>No payments recorded yet.</p>}
          {payments.length > 0 && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Transaction ref</th>
                  <th>Date</th>
                  {canManagePaymentsAndEstimates && <th></th>}
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.paymentId}>
                    <td>{formatCurrency(payment.amount)}</td>
                    <td>{payment.paymentStatus}</td>
                    <td>{payment.transactionReference ?? '—'}</td>
                    <td>{formatDate(payment.paymentDate)}</td>
                    {canManagePaymentsAndEstimates && (
                      <td>
                        <PaymentActions
                          payment={payment}
                          onDone={(message) => {
                            setActionMessage(message)
                            void loadAll()
                          }}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {canManagePaymentsAndEstimates &&
            claim.statusId === ClaimStatus.Approved && (
              <CreatePaymentForm
                claimId={claim.claimId}
                approvedAmount={claim.approvedAmount}
                onDone={(message) => {
                  setActionMessage(message)
                  void loadAll()
                }}
              />
            )}
        </section>
      )}

      <section className="card">
        <h2>Documents</h2>
        {documents.length === 0 && <p>No documents on this claim.</p>}
        {documents.length > 0 && (
          <ul className="document-list">
            {documents.map((doc) => (
              <li key={doc.claimDocumentId}>
                {doc.originalFileName}{' '}
                <button
                  type="button"
                  onClick={() => void downloadDocument(doc.claimDocumentId)}
                >
                  Download
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>Reassessment comments</h2>
        {comments.length === 0 && <p>No comments yet.</p>}
        {comments.length > 0 && (
          <ul className="comment-list">
            {comments.map((c) => (
              <li key={c.reassessmentCommentId}>
                <strong>{c.authorName}</strong> · {formatDate(c.createdDate)}
                <p>{c.comment}</p>
              </li>
            ))}
          </ul>
        )}
        <CommentForm claimId={claim.claimId} onPosted={loadAll} />
      </section>
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

function DecisionForm({
  title,
  options,
  onSubmit,
  onDone,
}: {
  title: string
  options: readonly number[]
  onSubmit: (decision: number, reasoning: string) => Promise<{ message: string }>
  onDone: (message: string) => void
}) {
  const [decision, setDecision] = useState<number>(options[0])
  const [reasoning, setReasoning] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const response = await onSubmit(decision, reasoning)
      onDone(response.message)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to submit decision.')
      setSubmitting(false)
    }
  }

  return (
    <section className="card">
      <h2>{title}</h2>
      <form onSubmit={handleSubmit}>
        <label htmlFor="decision">Decision</label>
        <select
          id="decision"
          value={decision}
          onChange={(event) => setDecision(Number(event.target.value))}
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {DecisionName[option]}
            </option>
          ))}
        </select>

        <label htmlFor="reasoning">Reasoning</label>
        <textarea
          id="reasoning"
          value={reasoning}
          onChange={(event) => setReasoning(event.target.value)}
          required
          rows={4}
        />

        {error && <p className="error-text">{error}</p>}

        <button type="submit" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit decision'}
        </button>
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

      <label htmlFor={`review-remarks-${estimate.repairEstimateId}`}>
        Remarks
      </label>
      <textarea
        id={`review-remarks-${estimate.repairEstimateId}`}
        value={remarks}
        onChange={(event) => setRemarks(event.target.value)}
        rows={2}
      />

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

function PaymentActions({
  payment,
  onDone,
}: {
  payment: PaymentResponseDto
  onDone: (message: string) => void
}) {
  const [busy, setBusy] = useState(false)

  const run = async (
    action: () => Promise<{ success: boolean; message: string }>,
  ) => {
    setBusy(true)
    try {
      const response = await action()
      onDone(response.message)
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to update payment.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {payment.paymentStatusId === PaymentStatus.Pending && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(() => processPayment(payment.paymentId))}
        >
          Process
        </button>
      )}
      {payment.paymentStatusId === PaymentStatus.Processing && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(() => completePayment(payment.paymentId))}
        >
          Complete
        </button>
      )}
      {(payment.paymentStatusId === PaymentStatus.Pending ||
        payment.paymentStatusId === PaymentStatus.Processing) && (
        <>
          {' '}
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void run(() => failPayment(payment.paymentId, 'Marked as failed.'))
            }
          >
            Fail
          </button>{' '}
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void run(() => cancelPayment(payment.paymentId, 'Cancelled.'))
            }
          >
            Cancel
          </button>
        </>
      )}
      {payment.paymentStatusId !== PaymentStatus.Paid && (
        <>
          {' '}
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => deletePayment(payment.paymentId))}
          >
            Delete
          </button>
        </>
      )}
    </>
  )
}

function CreatePaymentForm({
  claimId,
  approvedAmount,
  onDone,
}: {
  claimId: string
  approvedAmount: number | null
  onDone: (message: string) => void
}) {
  const [amount, setAmount] = useState(
    approvedAmount != null ? String(approvedAmount) : '',
  )
  const [transactionReference, setTransactionReference] = useState('')
  const [remarks, setRemarks] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      await createPayment(claimId, Number(amount), transactionReference, remarks)
      onDone('Payment created.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create payment.')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h3>Create payment</h3>

      <label htmlFor="payment-amount">Amount (₹)</label>
      <input
        id="payment-amount"
        type="number"
        min="0"
        step="0.01"
        max={approvedAmount ?? undefined}
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        required
      />

      <label htmlFor="transaction-reference">Transaction reference (optional)</label>
      <input
        id="transaction-reference"
        value={transactionReference}
        onChange={(event) => setTransactionReference(event.target.value)}
      />

      <label htmlFor="payment-remarks">Remarks</label>
      <textarea
        id="payment-remarks"
        value={remarks}
        onChange={(event) => setRemarks(event.target.value)}
        rows={2}
      />

      {error && <p className="error-text">{error}</p>}

      <button type="submit" disabled={submitting}>
        {submitting ? 'Creating…' : 'Create payment'}
      </button>
    </form>
  )
}

function CommentForm({
  claimId,
  onPosted,
}: {
  claimId: string
  onPosted: () => void
}) {
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      await postReassessmentComment(claimId, comment)
      setComment('')
      onPosted()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to post comment.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="comment-form">
      <textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        placeholder="Add a comment…"
        rows={3}
        required
      />
      {error && <p className="error-text">{error}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? 'Posting…' : 'Post comment'}
      </button>
    </form>
  )
}