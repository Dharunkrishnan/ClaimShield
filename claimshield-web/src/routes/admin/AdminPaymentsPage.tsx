import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  ApiError,
  cancelPayment,
  completePayment,
  failPayment,
  getAllClaims,
  getAllPayments,
  processPayment,
} from '../../lib/api'
import type { ClaimResponseDto, PaymentResponseDto } from '../../lib/types'
import { ClaimStatus, PaymentStatus } from '../../lib/statuses'
import { useAuth } from '../../context/AuthContext'
import { RoleId } from '../../lib/roles'
import { CreatePaymentForm } from '../../components/CreatePaymentForm'

// Same live-computation as ClaimDetailPage.tsx - see the comment there
// for why this doesn't rely on Claim.ApprovedAmount directly.
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

export function AdminPaymentsPage() {
  const { roleId } = useAuth()

  const [payments, setPayments] = useState<PaymentResponseDto[] | null>(null)
  const [claims, setClaims] = useState<ClaimResponseDto[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [paymentData, claimData] = await Promise.all([
        getAllPayments(),
        getAllClaims(),
      ])
      setPayments(paymentData)
      setClaims(claimData)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load payments.')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (roleId !== RoleId.Admin && roleId !== RoleId.Approver) {
    return <Navigate to="/" replace />
  }

  const claimNumberFor = (claimId: string) =>
    claims.find((c) => c.claimId === claimId)?.claimNumber ?? claimId

  const [selectedClaimId, setSelectedClaimId] = useState('')
  const eligibleClaims = claims.filter((c) => c.statusId === ClaimStatus.Approved)
  const selectedClaim = claims.find((c) => c.claimId === selectedClaimId) ?? null

  return (
    <div>
      <h1>Payments</h1>

      <section className="card">
        <h2>Create a new payment</h2>
        {eligibleClaims.length === 0 && (
          <p>No claims are currently Approved and awaiting payment.</p>
        )}
        {eligibleClaims.length > 0 && (
          <div className="form-field" style={{ maxWidth: '420px' }}>
            <label htmlFor="payment-claim-select">Claim</label>
            <select
              id="payment-claim-select"
              value={selectedClaimId}
              onChange={(e) => setSelectedClaimId(e.target.value)}
            >
              <option value="">Select a claim…</option>
              {eligibleClaims.map((c) => (
                <option key={c.claimId} value={c.claimId}>
                  {c.claimNumber} — {c.customerName ?? 'Unknown customer'}
                </option>
              ))}
            </select>
          </div>
        )}
      </section>

      {selectedClaim && (
        <CreatePaymentForm
          claimId={selectedClaim.claimId}
          claimNumber={selectedClaim.claimNumber}
          policyNumber={selectedClaim.policyNumber}
          customerName={selectedClaim.customerName}
          workshopRecommendation={selectedClaim.workshopRecommendation}
          approvedAmount={computeLiveApprovedAmount(selectedClaim)}
          onDone={(message) => {
            setSelectedClaimId('')
            void load()
            alert(message)
          }}
        />
      )}

      {error && <p className="error-text">{error}</p>}
      {!error && !payments && <p>Loading…</p>}
      {payments && payments.length === 0 && <p>No payments recorded yet.</p>}

      {payments && payments.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Claim</th>
              <th>Status</th>
              <th>Transaction ref</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.paymentId}>
                <td>
                  <Link to={`/claims/${payment.claimId}`}>
                    {claimNumberFor(payment.claimId)}
                  </Link>
                </td>
                <td>{payment.paymentStatus}</td>
                <td>{payment.transactionReference ?? '—'}</td>
                <td>{formatDate(payment.paymentDate)}</td>
                <td>
                  <PaymentRowActions payment={payment} onDone={() => void load()} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function PaymentRowActions({
  payment,
  onDone,
}: {
  payment: PaymentResponseDto
  onDone: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const run = async (
    action: () => Promise<{ success: boolean; message: string }>,
  ) => {
    setBusy(true)
    setActionError(null)
    try {
      await action()
      onDone()
    } catch (err) {
      // A plain browser alert() here can be easy to miss or get
      // silently blocked depending on the environment - an inline
      // message next to the button is more reliable and matches the
      // pattern used elsewhere in the app (e.g. RepairAuthorizationCard).
      setActionError(err instanceof ApiError ? err.message : 'Failed to update payment.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {actionError && (
        <p className="error-text" style={{ margin: '0 0 0.4rem' }}>
          {actionError}
        </p>
      )}
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
    </>
  )
}