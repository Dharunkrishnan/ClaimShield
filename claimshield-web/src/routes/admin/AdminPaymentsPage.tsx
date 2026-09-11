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
import { PaymentStatus } from '../../lib/statuses'
import { useAuth } from '../../context/AuthContext'
import { RoleId } from '../../lib/roles'

function formatCurrency(amount: number) {
  return `₹ ${amount.toLocaleString('en-IN')}`
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

  return (
    <div>
      <h1>Payments</h1>

      {error && <p className="error-text">{error}</p>}
      {!error && !payments && <p>Loading…</p>}
      {payments && payments.length === 0 && <p>No payments recorded yet.</p>}

      {payments && payments.length > 0 && (
        <div className="table-responsive">
          <table className="data-table queue-table">
            <thead>
              <tr>
                <th>Claim</th>
                <th>Amount</th>
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
                  <td>{formatCurrency(payment.amount)}</td>
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
        </div>
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

  const run = async (
    action: () => Promise<{ success: boolean; message: string }>,
  ) => {
    setBusy(true)
    try {
      await action()
      onDone()
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
    </>
  )
}
