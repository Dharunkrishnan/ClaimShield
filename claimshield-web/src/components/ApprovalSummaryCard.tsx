import { useEffect, useState } from 'react'
import {
  ApiError,
  getLiabilityDamageItems,
  getClaimInvoices,
  getPaymentsByClaim,
  getRepairAssignmentsByClaim,
  getRepairers,
  getSurveyAssessment,
  processPayment,
  completePayment,
  submitApproverDecision,
} from '../lib/api'
import type {
  ClaimResponseDto,
  ClaimDecisionResponseDto,
  LiabilityDamageItemResponseDto,
  InvoiceResponseDto,
  PaymentResponseDto,
  RepairAssignmentResponseDto,
  UserResponseDto,
  SurveyAssessmentResponseDto,
} from '../lib/types'
import { Decision } from '../lib/types'
import { ClaimStatusName, LossTypeName, DamageCategoryName, PaymentStatus } from '../lib/statuses'
import { REPAIRER_MASTER } from '../lib/repairerMaster'
import { Modal } from './Modal'
import { CheckCircle2 } from 'lucide-react'
import './ApprovalSummaryCard.css'

interface ApprovalSummaryCardProps {
  claim: ClaimResponseDto
  canApprove: boolean
  approverDecision: ClaimDecisionResponseDto | null
  canManagePayments: boolean
  onApproved: (message: string) => void
  onPaymentDone: (message: string) => void
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString('en-IN') : '—'
}

function formatCurrency(amount: number | null | undefined) {
  return amount != null ? `₹ ${amount.toLocaleString('en-IN')}` : '—'
}

// Same formula already used in ClaimSettlementCard.tsx / the Liability
// stage elsewhere - Claim.ApprovedAmount itself isn't kept live, so
// the net figure is always computed from the Liability* fields, not
// stored as a separate value that could drift out of sync.
function computeFinalAmount(claim: ClaimResponseDto) {
  const gross =
    (claim.liabilityTotalLabour ?? 0) +
    (claim.liabilityTotalParts ?? 0) +
    (claim.liabilityTaxAmount ?? 0)

  const deductions =
    (claim.liabilityDepreciationAmount ?? 0) +
    (claim.liabilityCompulsoryExcess ?? 0) +
    (claim.liabilityImposedExcess ?? 0) +
    (claim.liabilitySalvageDeductions ?? 0) +
    (claim.liabilityOtherDeduction ?? 0)

  const net = gross - deductions
  return { gross, deductions, net: net < 0 ? 0 : net }
}

// Claim.WorkshopRecommendation is saved as a single combined string,
// e.g. "Aadhi Cars Private Limited (Repairer: V Srinivasan)" - same
// shape CreatePaymentForm.tsx already parses for its own "Payments
// To: Repairer" default. REPAIRER_MASTER is then used only to look up
// the workshop's reference code (id), since that isn't part of the
// combined string itself.
function parseWorkshopRecommendation(value: string | null) {
  if (!value) return { workshopName: null, repairerName: null, workshopCode: null }

  const match = value.match(/^(.*?)\s*\(Repairer:\s*(.*?)\)\s*$/)

  if (!match) {
    return { workshopName: value, repairerName: null, workshopCode: null }
  }

  const [, workshopName, repairerName] = match
  const masterEntry = REPAIRER_MASTER.find((entry) => entry.workshopName === workshopName)

  return {
    workshopName,
    repairerName,
    workshopCode: masterEntry?.id ?? null,
  }
}

export function ApprovalSummaryCard({
  claim,
  canApprove,
  approverDecision,
  canManagePayments,
  onApproved,
  onPaymentDone,
}: ApprovalSummaryCardProps) {
  const [damageItems, setDamageItems] = useState<LiabilityDamageItemResponseDto[]>([])
  const [invoices, setInvoices] = useState<InvoiceResponseDto[]>([])
  const [payments, setPayments] = useState<PaymentResponseDto[]>([])
  const [repairAssignment, setRepairAssignment] = useState<RepairAssignmentResponseDto | null>(null)
  const [repairerUser, setRepairerUser] = useState<UserResponseDto | null>(null)
  const [assessment, setAssessment] = useState<SurveyAssessmentResponseDto | null>(null)
  const [loaded, setLoaded] = useState(false)

  const [approving, setApproving] = useState(false)
  const [approveError, setApproveError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [processError, setProcessError] = useState<string | null>(null)
  const [showPaymentConfirmation, setShowPaymentConfirmation] = useState(false)

  useEffect(() => {
    let cancelled = false

    Promise.all([
      getLiabilityDamageItems(claim.claimId).catch(() => [] as LiabilityDamageItemResponseDto[]),
      getClaimInvoices(claim.claimId).catch(() => [] as InvoiceResponseDto[]),
      getPaymentsByClaim(claim.claimId).catch(() => [] as PaymentResponseDto[]),
      getRepairAssignmentsByClaim(claim.claimId).catch(() => [] as RepairAssignmentResponseDto[]),
      getRepairers().catch(() => [] as UserResponseDto[]),
      getSurveyAssessment(claim.claimId).catch(() => null),
    ]).then(([damageItemsResult, invoicesResult, paymentsResult, repairAssignments, repairers, assessmentResult]) => {
      if (cancelled) return
      setDamageItems(damageItemsResult)
      setInvoices(invoicesResult)
      setPayments(paymentsResult)
      setAssessment(assessmentResult)

      const foundAssignment = repairAssignments[0] ?? null
      setRepairAssignment(foundAssignment)
      setRepairerUser(
        foundAssignment
          ? repairers.find((r) => r.userId === foundAssignment.repairerId) ?? null
          : null,
      )

      setLoaded(true)
    })

    return () => {
      cancelled = true
    }
  }, [claim.claimId])

  const { gross, deductions, net } = computeFinalAmount(claim)

  // A claim's repairer info can come from three different places,
  // checked in this order:
  //
  //  1. The Surveyor's own Repair Authorization choice
  //     (SurveyReport.EstimatedRepairerName) - this is what the
  //     Repair Authorization card on ClaimDetailPage.tsx actually
  //     shows as "Workshop name" today, so it's the primary source.
  //     REPAIRER_MASTER (the same static workshop->contact lookup the
  //     Repair Authorization form itself is built from) resolves the
  //     owner/contact person's name for it.
  //  2. A real RepairAssignment (a Repairer formally assigned to a
  //     real account) - a separate, Admin-driven mechanism from #1,
  //     not currently populated by the Repair Authorization flow
  //     itself, but still shown here when one exists.
  //  3. The free-text Claim.WorkshopRecommendation string, from the
  //     older customer/staff claim-registration flow.
  const assessmentWorkshopName = assessment?.estimatedRepairerName ?? null
  const assessmentMasterEntry = assessmentWorkshopName
    ? REPAIRER_MASTER.find((entry) => entry.workshopName === assessmentWorkshopName)
    : undefined

  const { workshopName: parsedWorkshopName, repairerName: parsedRepairerName, workshopCode: parsedWorkshopCode } =
    parseWorkshopRecommendation(claim.workshopRecommendation)

  const assignedRepairerName = repairerUser
    ? `${repairerUser.firstName} ${repairerUser.lastName ?? ''}`.trim()
    : null

  const workshopName = assessmentWorkshopName ?? parsedWorkshopName
  const repairerName = assessmentMasterEntry?.repairerName ?? assignedRepairerName ?? parsedRepairerName
  const workshopCode = assessmentMasterEntry?.id ?? parsedWorkshopCode

  const latestPayment =
    payments.length > 0
      ? [...payments].sort(
          (a, b) => new Date(b.createdDate ?? 0).getTime() - new Date(a.createdDate ?? 0).getTime(),
        )[0]
      : null

  const invoiceTotal = invoices.reduce((sum, inv) => sum + inv.invoiceAmount, 0)

  // No invoice file is ever uploaded for a claim - these are
  // structured line items entered directly (ClaimInvoice), not a
  // document - so "download the invoice" means exporting that real
  // data as a file, not fetching something already stored.
  const csvEscape = (value: string) => `"${value.replace(/"/g, '""')}"`

  const handleDownloadInvoices = () => {
    const header = ['Invoice Number', 'Date', 'Favour', 'Amount']
    const rows = invoices.map((inv) => [
      inv.invoiceNumber,
      formatDate(inv.invoiceDate),
      inv.invoiceFavourName,
      inv.invoiceAmount.toFixed(2),
    ])

    const csvLines = [
      `Claim ${claim.claimNumber}`,
      `Total: ${invoiceTotal.toFixed(2)}`,
      '',
      header.map(csvEscape).join(','),
      ...rows.map((row) => row.map(csvEscape).join(',')),
    ]

    const blob = new Blob([csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${claim.claimNumber}-invoices.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const alreadyApproved = approverDecision?.decision === Decision.Approve

  const handleApprove = async () => {
    setApproving(true)
    setApproveError(null)
    try {
      const result = await submitApproverDecision(
        claim.claimId,
        Decision.Approve,
        'Approved from the Approval screen.',
      )
      onApproved(result.message)
    } catch (err) {
      setApproveError(err instanceof ApiError ? err.message : 'Failed to approve the claim.')
    } finally {
      setApproving(false)
    }
  }

  // Moves the payment already saved on Liability from Pending to
  // Processing - no new bank-details form here, the banking
  // information was already captured and saved there.
  const handleProcessPayment = async () => {
    if (!latestPayment) return

    setProcessing(true)
    setProcessError(null)
    try {
      await processPayment(latestPayment.paymentId)
      // Show the confirmation popup first, deferring onPaymentDone
      // until it's closed - onPaymentDone triggers the parent page to
      // reload the claim, which can unmount/remount this card and
      // destroy showPaymentConfirmation before the popup ever gets a
      // chance to render (same fix already applied in
      // CreatePaymentForm for the same reason).
      setShowPaymentConfirmation(true)
    } catch (err) {
      setProcessError(err instanceof ApiError ? err.message : 'Failed to process the payment.')
    } finally {
      setProcessing(false)
    }
  }

  // Moves a Processing payment to Paid (and the claim to Settled) -
  // the Surveyor's own final step, no separate Approver sign-off
  // required.
  const handleCompletePayment = async () => {
    if (!latestPayment) return

    setProcessing(true)
    setProcessError(null)
    try {
      const result = await completePayment(latestPayment.paymentId)
      onPaymentDone(result.message)
    } catch (err) {
      setProcessError(err instanceof ApiError ? err.message : 'Failed to complete the payment.')
    } finally {
      setProcessing(false)
    }
  }

  if (!loaded) {
    return null
  }

  return (
    <section className="card approval-summary-card">
      <h2>Approval</h2>

      {/* Claim details */}
      <div className="approval-two-col">
        <div className="approval-block">
          <h3>Claim Details</h3>
          <dl>
            <dt>Claim number</dt>
            <dd>{claim.claimNumber}</dd>
            <dt>Policy number</dt>
            <dd>{claim.policyNumber ?? '—'}</dd>
            <dt>Customer</dt>
            <dd>{claim.customerName ?? '—'}</dd>
            <dt>Vehicle</dt>
            <dd>{claim.vehicleRegistrationNumber ?? '—'}</dd>
          </dl>
        </div>
        <div className="approval-block">
          <h3>Claim Status / Summary</h3>
          <dl>
            <dt>Loss type</dt>
            <dd>{claim.lossTypeId != null ? LossTypeName[claim.lossTypeId] ?? '—' : '—'}</dd>
            <dt>Incident date</dt>
            <dd>{formatDate(claim.incidentDate)}</dd>
            <dt>Location</dt>
            <dd>{claim.incidentLocation ?? '—'}</dd>
            <dt>Status</dt>
            <dd>{claim.statusId != null ? ClaimStatusName[claim.statusId] ?? '—' : '—'}</dd>
          </dl>
        </div>
      </div>

      {/* Liability summary - four cards */}
      <h3 className="approval-section-title">Liability Summary</h3>
      <div className="approval-four-col">
        <div className="approval-mini-card">
          <h4>Invoice Particulars</h4>
          <p className="approval-mini-stat">{invoices.length} invoice{invoices.length === 1 ? '' : 's'}</p>
          <p className="approval-mini-total">{formatCurrency(invoiceTotal)}</p>
          {invoices.length > 0 && (
            <button
              type="button"
              className="link-inline-button"
              onClick={handleDownloadInvoices}
            >
              Download invoice
            </button>
          )}
        </div>
        <div className="approval-mini-card">
          <h4>Depreciation</h4>
          <dl className="approval-mini-dl">
            <dt>Waiver</dt>
            <dd>{formatCurrency(claim.liabilityDepWaiver)}</dd>
            <dt>Amount</dt>
            <dd>{formatCurrency(claim.liabilityDepreciationAmount)}</dd>
          </dl>
        </div>
        <div className="approval-mini-card">
          <h4>Deductions</h4>
          <dl className="approval-mini-dl">
            <dt>Compulsory excess</dt>
            <dd>{formatCurrency(claim.liabilityCompulsoryExcess)}</dd>
            <dt>Imposed excess</dt>
            <dd>{formatCurrency(claim.liabilityImposedExcess)}</dd>
            <dt>Salvage</dt>
            <dd>{formatCurrency(claim.liabilitySalvageDeductions)}</dd>
            <dt>Other</dt>
            <dd>{formatCurrency(claim.liabilityOtherDeduction)}</dd>
          </dl>
        </div>
        <div className="approval-mini-card approval-mini-card-final">
          <h4>Final Assessment</h4>
          <dl className="approval-mini-dl">
            <dt>Gross</dt>
            <dd>{formatCurrency(gross)}</dd>
            <dt>Deductions</dt>
            <dd>{formatCurrency(deductions)}</dd>
          </dl>
          <p className="approval-mini-total approval-mini-total-net">{formatCurrency(net)}</p>
        </div>
      </div>

      {/* Vehicle damage inspection */}
      {damageItems.length > 0 && (
        <>
          <h3 className="approval-section-title">Vehicle Damage Inspection</h3>
          <div className="approval-table-wrap">
            <table className="approval-damage-table">
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Item</th>
                  <th>Action</th>
                  <th>Category</th>
                  <th>Labour</th>
                  <th>Parts</th>
                  <th>Depn</th>
                  <th>R/R</th>
                  <th>T/D</th>
                  <th>Ptg</th>
                  <th>Others</th>
                </tr>
              </thead>
              <tbody>
                {damageItems.map((item, index) => (
                  <tr key={item.damageAssessmentItemId}>
                    <td>{index + 1}</td>
                    <td>{item.componentName || '—'}</td>
                    <td>{item.replacementRequired ? 'Replace' : 'Repair'}</td>
                    <td>
                      {item.damageCategoryId != null
                        ? DamageCategoryName[item.damageCategoryId] ?? '—'
                        : '—'}
                    </td>
                    <td>{formatCurrency(item.labourAmount)}</td>
                    <td>{formatCurrency(item.partsAmount)}</td>
                    <td>{formatCurrency(item.depreciationAmount)}</td>
                    <td>{formatCurrency(item.rrAmount)}</td>
                    <td>{formatCurrency(item.tdAmount)}</td>
                    <td>{formatCurrency(item.paintingAmount)}</td>
                    <td>{formatCurrency(item.othersAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Repairer details */}
      <h3 className="approval-section-title">Repairer Details</h3>
      <div className="approval-block approval-block-standalone">
        {repairerName || workshopName ? (
          <dl>
            <dt>Repairer name</dt>
            <dd>{repairerName ?? '—'}</dd>
            <dt>Workshop</dt>
            <dd>{workshopName ?? '—'}</dd>
            {workshopCode && (
              <>
                <dt>Workshop code</dt>
                <dd>{workshopCode}</dd>
              </>
            )}
            {!assessmentMasterEntry && assignedRepairerName && (
              <>
                <dt>Assigned date</dt>
                <dd>{formatDate(repairAssignment?.assignedDate ?? null)}</dd>
              </>
            )}
          </dl>
        ) : (
          <p className="approval-empty-text">No repairer recorded on this claim.</p>
        )}
      </div>

      {/* Final payment */}
      <div className="approval-final-payment-row">
        <div>
          <h3 className="approval-section-title approval-final-payment-title">Final Payment</h3>
          <p className="approval-final-payment-amount">{formatCurrency(net)}</p>
        </div>

        <div className="approval-final-payment-actions">
          {canManagePayments && (
            <button
              type="button"
              className="approval-action-button approval-action-secondary"
              disabled={
                processing ||
                !latestPayment ||
                (latestPayment.paymentStatusId !== PaymentStatus.Pending &&
                  latestPayment.paymentStatusId !== PaymentStatus.Processing)
              }
              onClick={() =>
                void (latestPayment?.paymentStatusId === PaymentStatus.Processing
                  ? handleCompletePayment()
                  : handleProcessPayment())
              }
            >
              {!latestPayment
                ? 'No Payment Saved'
                : processing
                  ? latestPayment.paymentStatusId === PaymentStatus.Processing
                    ? 'Completing…'
                    : 'Processing…'
                  : latestPayment.paymentStatusId === PaymentStatus.Pending
                    ? 'Process Payment'
                    : latestPayment.paymentStatusId === PaymentStatus.Processing
                      ? 'Complete Payment'
                      : latestPayment.paymentStatus}
            </button>
          )}

          {canApprove && (
            <button
              type="button"
              className="approval-action-button approval-action-primary"
              disabled={approving || alreadyApproved}
              onClick={() => void handleApprove()}
            >
              {alreadyApproved ? 'Approved' : approving ? 'Approving…' : 'Approve'}
            </button>
          )}
        </div>
      </div>

      {approveError && <p className="error-text">{approveError}</p>}
      {processError && <p className="error-text">{processError}</p>}

      <Modal
        open={showPaymentConfirmation}
        onClose={() => {
          setShowPaymentConfirmation(false)
          onPaymentDone('Payment processed.')
        }}
        title="Payment Completed"
      >
        <div className="payment-confirmation">
          <CheckCircle2 size={40} className="payment-confirmation-icon" />
          <dl className="payment-confirmation-details">
            <dt>Policy Number</dt>
            <dd>{claim.policyNumber ?? '—'}</dd>
            <dt>Claim Number</dt>
            <dd>{claim.claimNumber}</dd>
            <dt>Insured Name</dt>
            <dd>{claim.customerName ?? '—'}</dd>
          </dl>
          <p className="payment-confirmation-description">
            The approved amount: <strong>{formatCurrency(net)}</strong> has been sent to the bank
            account.
          </p>
          <button
            type="button"
            onClick={() => {
              setShowPaymentConfirmation(false)
              onPaymentDone('Payment processed.')
            }}
          >
            Close
          </button>
        </div>
      </Modal>
    </section>
  )
}