import { useEffect, useState, type FormEvent } from 'react'
import { Landmark, ArrowRight } from 'lucide-react'
import { ApiError, createPayment, getSurveyAssessment } from '../lib/api'
import { PaymentMethod, PayeeType } from '../lib/statuses'

function formatCurrency(amount: number | null) {
  return amount != null ? `₹ ${amount.toLocaleString('en-IN')}` : '—'
}

// The workshop stored on the claim (Claim.WorkshopRecommendation) is
// saved as a single combined string, e.g. "Aadhi Cars Private Limited
// (Repairer: V Srinivasan)" - same format ClaimDetailPage's own
// RepairAuthorizationCard already parses for display. Reusing that
// exact shape here means "Payments To: Repairer" can default to a
// real name instead of an empty field, with no extra API call needed.
// Falls back to showing the whole string as-is if it doesn't match
// that shape (older data, or freeform text), rather than losing it.
//
// workshopRecommendation is only set when a workshop was actually
// chosen at Register Claim - customer-submitted claims (or Register
// Claim entries left blank) leave it empty, silently producing an
// empty payee name with no fallback. inspectionWorkshopName (the
// Surveyor's own SurveyReport.EstimatedRepairerName, fetched fresh in
// this component) is used as a fallback in that case - it only has a
// workshop name, not a separate repairer contact name, so the "Name -
// Workshop" combined format only applies when workshopRecommendation
// itself is present.
function defaultRepairerPayeeName(
  workshopRecommendation: string | null | undefined,
  inspectionWorkshopName: string | null | undefined,
) {
  if (!workshopRecommendation) return inspectionWorkshopName ?? ''

  const match = workshopRecommendation.match(/^(.*?)\s*\(Repairer:\s*(.*?)\)\s*$/)

  if (!match) return workshopRecommendation

  const [, workshopName, repairerName] = match
  return `${repairerName} - ${workshopName}`
}

export function CreatePaymentForm({
  claimId,
  claimNumber,
  customerName,
  workshopRecommendation,
  approvedAmount,
  submitLabel = 'Submit',
  onDeny,
  onDone,
}: {
  claimId: string
  claimNumber: string
  policyNumber: string | null
  customerName: string | null
  workshopRecommendation?: string | null
  approvedAmount: number | null
  // Defaults to "Submit" - the Liability stage passes "Save" instead,
  // since saving bank details there isn't the claim's final action the
  // way it is on the Approval stage.
  submitLabel?: string
  // Only provided by the Liability stage's call site - when set, a
  // third "Denial" button renders alongside Back/Submit. Kept as a
  // plain callback (not a router call inside this component) so this
  // shared form doesn't need to know about app routing.
  onDeny?: () => void
  onDone: (message: string) => void
}) {
  const [payeeType, setPayeeType] = useState<number>(PayeeType.Customer)
  const [payeeName, setPayeeName] = useState(customerName ?? '')
  const [payeeCode, setPayeeCode] = useState('')
  const [inspectionWorkshopName, setInspectionWorkshopName] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getSurveyAssessment(claimId)
      .then((result) => {
        if (!cancelled) setInspectionWorkshopName(result?.estimatedRepairerName ?? null)
      })
      .catch(() => {
        if (!cancelled) setInspectionWorkshopName(null)
      })
    return () => {
      cancelled = true
    }
  }, [claimId])
  const [paymentMethodId, setPaymentMethodId] = useState<number | null>(null)
  const [bankAccountNumber, setBankAccountNumber] = useState('')
  const [confirmBankAccountNumber, setConfirmBankAccountNumber] = useState('')
  const [ifscCode, setIfscCode] = useState('')
  const [bankName, setBankName] = useState('')
  const [branchName, setBranchName] = useState('')
  const [mobileNumber, setMobileNumber] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const accountsMatch =
    bankAccountNumber.length > 0 && bankAccountNumber === confirmBankAccountNumber

  const canSubmit =
    accountsMatch &&
    payeeName.trim().length > 0 &&
    payeeCode.trim().length > 0 &&
    paymentMethodId !== null &&
    ifscCode.trim().length > 0 &&
    bankName.trim().length > 0 &&
    branchName.trim().length > 0 &&
    mobileNumber.length === 10 &&
    (approvedAmount ?? 0) > 0

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()

    if (paymentMethodId === null) {
      setError('Please select a payment mode.')
      return
    }

    if (!accountsMatch) {
      setError('Account number and confirmation do not match.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      await createPayment({
        claimId,
        amount: approvedAmount ?? 0,
        transactionReference: '',
        remarks: '',
        paymentMethodId,
        payeeType,
        payeeCode,
        beneficiaryName: payeeName,
        bankAccountNumber,
        ifscCode: ifscCode.toUpperCase(),
        bankName,
        branchName,
        mobileNumber,
      })
      onDone('Payment saved.')
      setSubmitting(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create payment.')
      setSubmitting(false)
    }
  }

  return (
    <section className="card bank-details-card">
      <div className="bank-details-header">
        <span className="bank-details-icon">
          <Landmark size={20} />
        </span>
        <div>
          <span className="bank-details-claim-label">Claim Number</span>
          <span className="bank-details-claim-number">{claimNumber}</span>
        </div>
      </div>

      <h2 className="bank-details-title">Bank account details</h2>
      <div className="bank-details-underline" />

      <p className="bank-details-description">
        Enter the account for your approved amount of{' '}
        <strong>{formatCurrency(approvedAmount)}</strong>.
      </p>

      {(approvedAmount ?? 0) <= 0 && (
        <p className="error-text">
          This claim's approved amount is ₹0, so a payment can't be submitted yet. Go to
          Liability and confirm the Assessment Summary figures (Total Labour, Total Parts, Tax,
          etc.) have actually been saved.
        </p>
      )}

      <form onSubmit={handleSubmit}>
        <div className="survey-grid bank-details-grid">
          <div className="survey-field">
            <span className="payment-field-label">Payments To</span>
            <div className="payment-choice-row" role="radiogroup" aria-label="Payments To">
              <label className="payment-choice">
                <input
                  type="radio"
                  name="payee-type"
                  checked={payeeType === PayeeType.Customer}
                  onChange={() => {
                    setPayeeType(PayeeType.Customer)
                    setPayeeName(customerName ?? '')
                  }}
                />
                Customer
              </label>
              <label className="payment-choice">
                <input
                  type="radio"
                  name="payee-type"
                  checked={payeeType === PayeeType.Repairer}
                  onChange={() => {
                    setPayeeType(PayeeType.Repairer)
                    setPayeeName(defaultRepairerPayeeName(workshopRecommendation, inspectionWorkshopName))
                  }}
                />
                Repairer
              </label>
            </div>
          </div>

          <div className="survey-field">
            <label htmlFor="payee-name">Payee Name</label>
            <input
              id="payee-name"
              value={payeeName}
              onChange={(event) => setPayeeName(event.target.value)}
              placeholder="Payee name"
              required
            />
          </div>

          <div className="survey-field">
            <label htmlFor="payee-code">Payee Code</label>
            <input
              id="payee-code"
              value={payeeCode}
              onChange={(event) => setPayeeCode(event.target.value)}
              placeholder="Payee code"
              required
            />
          </div>

          <div className="survey-field">
            <span className="payment-field-label">Payment Mode</span>
            <div className="payment-choice-row" role="group" aria-label="Payment Mode">
              {[
                { id: PaymentMethod.Neft, label: 'NEFT' },
                { id: PaymentMethod.Rtgs, label: 'RTGS' },
                { id: PaymentMethod.Upi, label: 'UPI' },
              ].map((mode) => (
                <label key={mode.id} className="payment-choice">
                  <input
                    type="checkbox"
                    checked={paymentMethodId === mode.id}
                    onChange={() =>
                      // Rendered as checkboxes per design, but only one
                      // payment mode can actually apply to a single
                      // payment (the backend stores one PaymentMethodId,
                      // not a list) - selecting one here deselects any
                      // other, the same end result as a radio group.
                      setPaymentMethodId((current) => (current === mode.id ? null : mode.id))
                    }
                  />
                  {mode.label}
                </label>
              ))}
            </div>
          </div>

          <div className="survey-field">
            <label htmlFor="bank-account-number">Account Number</label>
            <input
              id="bank-account-number"
              value={bankAccountNumber}
              onChange={(event) => setBankAccountNumber(event.target.value)}
              placeholder="Account number"
              required
            />
          </div>

          <div className="survey-field">
            <label htmlFor="confirm-bank-account-number">Confirm Account Number</label>
            <input
              id="confirm-bank-account-number"
              value={confirmBankAccountNumber}
              onChange={(event) => setConfirmBankAccountNumber(event.target.value)}
              placeholder="Re-enter account number"
              required
            />
            {confirmBankAccountNumber.length > 0 && !accountsMatch && (
              <span className="error-text" style={{ fontSize: '0.78rem' }}>
                Doesn't match
              </span>
            )}
          </div>

          <div className="survey-field">
            <label htmlFor="ifsc-code">IFSC Code</label>
            <input
              id="ifsc-code"
              value={ifscCode}
              onChange={(event) => setIfscCode(event.target.value.toUpperCase())}
              placeholder="e.g. SBIN0001234"
              required
            />
          </div>

          <div className="survey-field">
            <label htmlFor="bank-name">Bank Name</label>
            <input
              id="bank-name"
              value={bankName}
              onChange={(event) => setBankName(event.target.value)}
              placeholder="Bank name"
              required
            />
          </div>

          <div className="survey-field">
            <label htmlFor="branch-name">Branch Name</label>
            <input
              id="branch-name"
              value={branchName}
              onChange={(event) => setBranchName(event.target.value)}
              placeholder="Branch name"
              required
            />
          </div>

          <div className="survey-field">
            <label htmlFor="mobile-number">Mobile Number</label>
            <input
              id="mobile-number"
              type="tel"
              inputMode="numeric"
              value={mobileNumber}
              onChange={(event) =>
                setMobileNumber(event.target.value.replace(/\D/g, '').slice(0, 10))
              }
              placeholder="10-digit mobile number"
              maxLength={10}
              required
            />
          </div>
        </div>

        {error && <p className="error-text">{error}</p>}

        <div className="bank-details-actions">
          <button
            type="button"
            className="bank-details-back-button"
            onClick={() => {
              setPayeeType(PayeeType.Customer)
              setPayeeName(customerName ?? '')
              setPayeeCode('')
              setPaymentMethodId(null)
              setBankAccountNumber('')
              setConfirmBankAccountNumber('')
              setIfscCode('')
              setBankName('')
              setBranchName('')
              setMobileNumber('')
              setError(null)
            }}
          >
            Back
          </button>
          {onDeny && (
            <button
              type="button"
              className="bank-details-deny-button"
              onClick={onDeny}
            >
              Denial
            </button>
          )}
          <button type="submit" disabled={submitting || !canSubmit}>
            {submitting ? 'Submitting…' : submitLabel}
            {!submitting && <ArrowRight size={16} style={{ verticalAlign: '-3px', marginLeft: '0.4rem' }} />}
          </button>
        </div>
      </form>
    </section>
  )
}