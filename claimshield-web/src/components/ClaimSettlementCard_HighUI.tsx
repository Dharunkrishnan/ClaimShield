import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Calculator, Eye, Pencil, RefreshCw, Save, Send } from 'lucide-react'
import {
  ApiError,
  computeClaimSettlement,
  getClaimSettlement,
  getLiabilityDamageItems,
  getSurveyAssessment,
  submitLiability,
  updateLiabilityDamageItems,
  updateLiabilityFigures,
} from '../lib/api'
import type {
  ClaimSettlementResponseDto,
  LiabilityDamageItemResponseDto,
  SurveyAssessmentResponseDto,
} from '../lib/types'
import { DamageCategoryName } from '../lib/statuses'
import { useToast } from '../context/ToastContext'
import { SkeletonBlock } from './Skeleton'
import { Modal } from './Modal'
import './ClaimSettlementCard.css'

function formatCurrency(amount: number | null | undefined) {
  return amount != null ? `₹ ${amount.toLocaleString('en-IN')}` : '—'
}

function toNum(value: string): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

// Same view-only-row pattern as Claim 360's InfoCard/InfoRow.
function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="detail-item">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value}</span>
    </div>
  )
}

export interface LiabilityFigures {
  taxAmount: number | null
  totalLabour: number | null
  totalParts: number | null
  depWaiver: number | null
  depreciationAmount: number | null
  compulsoryExcess: number | null
  imposedExcess: number | null
  salvageDeductions: number | null
  otherDeduction: number | null
  towingAmount: number | null
}

// Liability stage - same pattern as Claim 360: a view-only summary
// card with an "Edit" link that opens a modal for the fields that
// actually have a real update endpoint, rather than always-visible
// inline inputs.
//
// Every field in the modal is genuinely editable and persisted
// (Claim.Liability* fields, PATCH .../liability-figures) - saved
// separately from the survey's own SurveyReport record and the
// settlement engine's own record, so editing here never overwrites
// either of those source records.
//
// Pre-filled the first time the modal opens from the claim's own
// saved liability figures if already set, otherwise from the closest
// real source: Total Labour/Total Parts from the survey's damage
// component items, Dep/Compulsory Excess/Salvage/Towing from the
// survey assessment's own fields, Dep Waiver from the settlement
// engine. Imposed Excess and Other Deduction have no matching source
// anywhere else, so they default to 0 - a real, saved zero once
// edited and saved, not a placeholder.
export function ClaimSettlementCard({
  claimId,
  canCompute,
  canEditAmount,
  liabilitySubmitted,
  liabilityFigures,
  onAmountSaved,
}: {
  claimId: string
  canCompute: boolean
  canEditAmount: boolean
  liabilitySubmitted: boolean
  liabilityFigures: LiabilityFigures
  onAmountSaved: (message: string) => void
}) {
  const { showToast } = useToast()
  const [settlement, setSettlement] = useState<ClaimSettlementResponseDto | null>(null)
  const [assessment, setAssessment] = useState<SurveyAssessmentResponseDto | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [computing, setComputing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showSettlementPreview, setShowSettlementPreview] = useState(false)

  const [editingFigures, setEditingFigures] = useState(false)

  const [totalLabourStr, setTotalLabourStr] = useState('')
  const [totalPartsStr, setTotalPartsStr] = useState('')
  const [taxStr, setTaxStr] = useState('')
  const [depStr, setDepStr] = useState('')
  const [depWaiverStr, setDepWaiverStr] = useState('')
  const [compulsoryExcessStr, setCompulsoryExcessStr] = useState('')
  const [imposedExcessStr, setImposedExcessStr] = useState('')
  const [salvageStr, setSalvageStr] = useState('')
  const [otherDeductionStr, setOtherDeductionStr] = useState('')
  const [towingStr, setTowingStr] = useState('')
  const [savingFigures, setSavingFigures] = useState(false)
  const [figuresError, setFiguresError] = useState<string | null>(null)

  const [damageItems, setDamageItems] = useState<LiabilityDamageItemResponseDto[]>([])
  const [damageItemsLoadError, setDamageItemsLoadError] = useState<string | null>(null)
  const [itemEdits, setItemEdits] = useState<
    Record<string, { dep: string; rr: string; td: string; ptg: string; others: string }>
  >({})
  const [savingItems, setSavingItems] = useState(false)
  const [itemsError, setItemsError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    Promise.all([
      getClaimSettlement(claimId).catch(() => null),
      getSurveyAssessment(claimId).catch(() => null),
      getLiabilityDamageItems(claimId).catch((err: unknown) => {
        // Surfaced, not swallowed - an empty table and a failed fetch
        // look identical to the person unless the actual error is
        // shown, and this endpoint is new enough that a real backend
        // problem (migration not applied, endpoint missing) is a
        // realistic possibility worth showing plainly.
        setDamageItemsLoadError(
          err instanceof ApiError ? err.message : 'Failed to load the damage item table.',
        )
        return [] as LiabilityDamageItemResponseDto[]
      }),
    ]).then(([settlementData, assessmentData, items]) => {
      if (cancelled) return
      setSettlement(settlementData)
      setAssessment(assessmentData)
      setDamageItems(items)
      setItemEdits(
        Object.fromEntries(
          items.map((item) => [
            item.damageAssessmentItemId,
            {
              dep: String(item.depreciationAmount ?? 0),
              rr: String(item.rrAmount ?? 0),
              td: String(item.tdAmount ?? 0),
              ptg: String(item.paintingAmount ?? 0),
              others: String(item.othersAmount ?? 0),
            },
          ]),
        ),
      )
      setLoaded(true)
    })

    return () => {
      cancelled = true
    }
  }, [claimId])

  const computedLabour = (assessment?.damageAssessmentItems ?? []).reduce(
    (sum, item) => sum + (item.labourAmount ?? 0),
    0,
  )
  const computedParts = (assessment?.damageAssessmentItems ?? []).reduce(
    (sum, item) => sum + (item.partsAmount ?? 0),
    0,
  )

  // Current display figures - saved liability value if set, otherwise
  // the closest real source. Shown in the view-only card, and used to
  // seed the modal's inputs each time it opens.
  const displayTotalLabour = liabilityFigures.totalLabour ?? computedLabour
  const displayTotalParts = liabilityFigures.totalParts ?? computedParts
  const displayTax = liabilityFigures.taxAmount ?? assessment?.taxAmount ?? 0
  const displayDep = liabilityFigures.depreciationAmount ?? assessment?.depreciationAmount ?? 0
  const displayDepWaiver =
    liabilityFigures.depWaiver ?? settlement?.zeroDepreciationWaiverAmount ?? 0
  const displayCompulsoryExcess =
    liabilityFigures.compulsoryExcess ?? assessment?.compulsoryExcess ?? 0
  const displayImposedExcess = liabilityFigures.imposedExcess ?? 0
  const displaySalvage = liabilityFigures.salvageDeductions ?? assessment?.salvageAmount ?? 0
  const displayOtherDeduction = liabilityFigures.otherDeduction ?? 0
  const displayTowing = liabilityFigures.towingAmount ?? assessment?.towingCharges ?? 0

  const gross = displayTotalLabour + displayTotalParts + displayTax
  const totalDeduction =
    displayDep + displayCompulsoryExcess + displayImposedExcess + displaySalvage +
    displayOtherDeduction
  const netAssessment = Math.max(0, gross - totalDeduction)

  const openEditFigures = () => {
    setTotalLabourStr(String(displayTotalLabour))
    setTotalPartsStr(String(displayTotalParts))
    setTaxStr(String(displayTax))
    setDepStr(String(displayDep))
    setDepWaiverStr(String(displayDepWaiver))
    setCompulsoryExcessStr(String(displayCompulsoryExcess))
    setImposedExcessStr(String(displayImposedExcess))
    setSalvageStr(String(displaySalvage))
    setOtherDeductionStr(String(displayOtherDeduction))
    setTowingStr(String(displayTowing))
    setFiguresError(null)
    setEditingFigures(true)
  }

  const handleCompute = async () => {
    setComputing(true)
    try {
      const result = await computeClaimSettlement(claimId)
      setSettlement(result)
      showToast('Settlement computed.', 'success')
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to compute settlement.', 'error')
    } finally {
      setComputing(false)
    }
  }

  // Submit must be WYSIWYG: the card always shows a plausible number
  // via fallbacks (survey assessment, damage items, settlement
  // engine) even when nothing has ever actually been saved to
  // Claim.Liability* - and SubmitLiabilityAsync computes ApprovedAmount
  // purely from those raw saved columns, never from these display
  // fallbacks. Without this save-then-submit here, a person could see
  // real-looking figures on screen, click Submit without ever having
  // opened the edit modal, and silently get ApprovedAmount = 0 because
  // the backend only reads the (still-null) saved columns. Saving the
  // currently-displayed effective figures first guarantees Submit
  // always uses exactly what's on screen, regardless of whether the
  // modal's own Save was ever separately used.
  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      await updateLiabilityFigures({
        claimId,
        liabilityTaxAmount: displayTax,
        liabilityTotalLabour: displayTotalLabour,
        liabilityTotalParts: displayTotalParts,
        liabilityDepWaiver: displayDepWaiver,
        liabilityDepreciationAmount: displayDep,
        liabilityCompulsoryExcess: displayCompulsoryExcess,
        liabilityImposedExcess: displayImposedExcess,
        liabilitySalvageDeductions: displaySalvage,
        liabilityOtherDeduction: displayOtherDeduction,
        liabilityTowingAmount: displayTowing,
      })
      const result = await submitLiability(claimId)
      onAmountSaved(`${result.message} Approval is now unlocked.`)
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to submit liability.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleViewSettlement = () => {
    setShowSettlementPreview(true)
  }

  const handleSaveFigures = async (event: FormEvent) => {
    event.preventDefault()
    setSavingFigures(true)
    setFiguresError(null)

    try {
      const result = await updateLiabilityFigures({
        claimId,
        liabilityTaxAmount: toNum(taxStr),
        liabilityTotalLabour: toNum(totalLabourStr),
        liabilityTotalParts: toNum(totalPartsStr),
        liabilityDepWaiver: toNum(depWaiverStr),
        liabilityDepreciationAmount: toNum(depStr),
        liabilityCompulsoryExcess: toNum(compulsoryExcessStr),
        liabilityImposedExcess: toNum(imposedExcessStr),
        liabilitySalvageDeductions: toNum(salvageStr),
        liabilityOtherDeduction: toNum(otherDeductionStr),
        liabilityTowingAmount: toNum(towingStr),
      })
      setEditingFigures(false)
      onAmountSaved(result.message)
    } catch (err) {
      setFiguresError(err instanceof ApiError ? err.message : 'Failed to save liability figures.')
    } finally {
      setSavingFigures(false)
    }
  }

  const handleItemFieldChange = (
    itemId: string,
    field: 'dep' | 'rr' | 'td' | 'ptg' | 'others',
    value: string,
  ) => {
    setItemEdits((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value },
    }))
  }

  const handleSaveItems = async () => {
    setSavingItems(true)
    setItemsError(null)

    try {
      const result = await updateLiabilityDamageItems({
        claimId,
        items: damageItems.map((item) => {
          const edit = itemEdits[item.damageAssessmentItemId]
          return {
            damageAssessmentItemId: item.damageAssessmentItemId,
            depreciationAmount: toNum(edit?.dep ?? '0'),
            rrAmount: toNum(edit?.rr ?? '0'),
            tdAmount: toNum(edit?.td ?? '0'),
            paintingAmount: toNum(edit?.ptg ?? '0'),
            othersAmount: toNum(edit?.others ?? '0'),
          }
        }),
      })
      onAmountSaved(result.message)
    } catch (err) {
      setItemsError(err instanceof ApiError ? err.message : 'Failed to save damage item figures.')
    } finally {
      setSavingItems(false)
    }
  }

  if (!loaded) {
    return (
      <section className="card">
        <SkeletonBlock lines={3} />
      </section>
    )
  }

  if (!assessment && !canCompute && !canEditAmount) {
    return null
  }

  return (
    <div className="settlement-reorder-wrap">
      <section className="card card-tint-blue settlement-card settlement-order-2">
        <div className="claim360-card-header">
          <h2>
            <Calculator size={17} style={{ verticalAlign: '-3px', marginRight: '0.4rem' }} />
            Assessment Summary
          </h2>
          {canEditAmount && assessment && (
            <button type="button" className="claim360-edit-link" onClick={openEditFigures}>
              <Pencil size={13} /> Edit
            </button>
          )}
        </div>

        {!assessment && <p>No survey assessment has been saved for this claim yet.</p>}

        {assessment && (
          <div className="detail-panel-box claim360-info-grid">
            <div className="detail-panel-col">
              <InfoRow label="Total Labour" value={formatCurrency(displayTotalLabour)} />
              <InfoRow label="Total Part" value={formatCurrency(displayTotalParts)} />
              <InfoRow label="Tax" value={formatCurrency(displayTax)} />
              <InfoRow label="Gross" value={formatCurrency(gross)} />
            </div>
            <div className="detail-panel-col">
              <InfoRow label="Dep" value={formatCurrency(displayDep)} />
              <InfoRow label="Dep Waiver" value={formatCurrency(displayDepWaiver)} />
              <InfoRow label="Compulsory Excess" value={formatCurrency(displayCompulsoryExcess)} />
              <InfoRow label="Imposed Excess" value={formatCurrency(displayImposedExcess)} />
            </div>
            <div className="detail-panel-col">
              <InfoRow label="Salvage Deductions" value={formatCurrency(displaySalvage)} />
              <InfoRow label="Other Deduction" value={formatCurrency(displayOtherDeduction)} />
              <InfoRow label="Total Deduction" value={formatCurrency(totalDeduction)} />
              <InfoRow label="Towing Amount" value={formatCurrency(displayTowing)} />
            </div>
          </div>
        )}

        {assessment && (
          <dl className="fact-grid settlement-fact-grid" style={{ marginTop: '0.9rem' }}>
            <dt className="settlement-net-label">Net Assessment</dt>
            <dd className="settlement-net-value">{formatCurrency(netAssessment)}</dd>
          </dl>
        )}

        {settlement && (
          <p className="settlement-computed-at">
            Settlement last computed {new Date(settlement.computedAt).toLocaleString('en-IN')}
          </p>
        )}

        <div className="settlement-actions-row">
          {canCompute && (
            <button type="button" onClick={() => void handleCompute()} disabled={computing}>
              <RefreshCw size={14} style={{ verticalAlign: '-2px', marginRight: '0.3rem' }} />
              {computing ? 'Computing…' : settlement ? 'Recompute settlement' : 'Compute settlement'}
            </button>
          )}

          {canEditAmount && (
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting || liabilitySubmitted}
              title={liabilitySubmitted ? 'Already submitted' : undefined}
            >
              <Send size={14} style={{ verticalAlign: '-2px', marginRight: '0.3rem' }} />
              {submitting ? 'Submitting…' : liabilitySubmitted ? 'Submitted' : 'Submit'}
            </button>
          )}
          <button
            type="button"
            className="liability-view-button"
            onClick={handleViewSettlement}
            title="View settlement summary"
          >
            <Eye size={14} style={{ verticalAlign: '-2px', marginRight: '0.3rem' }} />
            View
          </button>
        </div>
      </section>

      {damageItemsLoadError && (
        <section className="card settlement-order-1">
          <p className="error-text">
            Couldn't load the Vehicle Damage Inspection table: {damageItemsLoadError}
          </p>
        </section>
      )}

      {damageItems.length > 0 && (
        <section className="card damage-inspection-card settlement-order-1">
          <div className="damage-inspection-header">
            <div>
              <div className="damage-inspection-eyebrow">VEHICLE INSPECTION</div>
              <h2>Vehicle Damage Inspection</h2>
              <p>Detailed component findings, repair actions and assessed financial impact.</p>
            </div>
            <div className="damage-inspection-count">
              <strong>{damageItems.length}</strong>
              <span>Items assessed</span>
            </div>
          </div>

          <div className="damage-inspection-summary">
            <div className="damage-summary-card">
              <span className="damage-summary-label">Damaged Components</span>
              <strong>{damageItems.length}</strong>
            </div>
            <div className="damage-summary-card">
              <span className="damage-summary-label">Repair</span>
              <strong>{damageItems.filter((item) => !item.replacementRequired).length}</strong>
            </div>
            <div className="damage-summary-card">
              <span className="damage-summary-label">Replace</span>
              <strong>{damageItems.filter((item) => item.replacementRequired).length}</strong>
            </div>
            <div className="damage-summary-card damage-summary-card-cost">
              <span className="damage-summary-label">Base Assessed Cost</span>
              <strong>
                {formatCurrency(
                  damageItems.reduce(
                    (sum, item) => sum + (item.labourAmount ?? 0) + (item.partsAmount ?? 0),
                    0,
                  ),
                )}
              </strong>
            </div>
          </div>

          <div className="damage-inspection-section-title">
            <div>
              <h3>Inspection Details</h3>
              <p>Review each damaged component and its assessment.</p>
            </div>
          </div>

          <div className="damage-inspection-list">
            {damageItems.map((item, index) => {
              const edit = itemEdits[item.damageAssessmentItemId] ?? {
                dep: '0',
                rr: '0',
                td: '0',
                ptg: '0',
                others: '0',
              }
              const category = item.damageCategoryId
                ? DamageCategoryName[item.damageCategoryId] ?? 'Uncategorized'
                : 'Uncategorized'
              const action = item.replacementRequired ? 'Replace' : 'Repair'
              const baseCost = (item.labourAmount ?? 0) + (item.partsAmount ?? 0)

              return (
                <article className="damage-inspection-item" key={item.damageAssessmentItemId}>
                  <div className="damage-inspection-item-top">
                    <div className="damage-inspection-number">{String(index + 1).padStart(2, '0')}</div>

                    <div className="damage-inspection-component">
                      <h4>{item.componentName}</h4>
                      <div className="damage-inspection-meta">
                        <span className={`damage-action-badge ${item.replacementRequired ? 'replace' : 'repair'}`}>
                          {action}
                        </span>
                        <span className="damage-category-badge">{category}</span>
                      </div>
                    </div>

                    <div className="damage-inspection-base-cost">
                      <span>Base cost</span>
                      <strong>{formatCurrency(baseCost)}</strong>
                    </div>
                  </div>

                  <div className="damage-inspection-financials">
                    <div className="damage-financial-box">
                      <span>Labour</span>
                      <strong>{formatCurrency(item.labourAmount)}</strong>
                    </div>
                    <div className="damage-financial-box">
                      <span>Parts</span>
                      <strong>{formatCurrency(item.partsAmount)}</strong>
                    </div>

                    <label className="damage-edit-field">
                      <span>Depreciation</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        disabled={!canEditAmount}
                        value={edit.dep}
                        onChange={(e) =>
                          handleItemFieldChange(item.damageAssessmentItemId, 'dep', e.target.value)
                        }
                      />
                    </label>

                    <label className="damage-edit-field">
                      <span>R/R</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        disabled={!canEditAmount}
                        value={edit.rr}
                        onChange={(e) =>
                          handleItemFieldChange(item.damageAssessmentItemId, 'rr', e.target.value)
                        }
                      />
                    </label>

                    <label className="damage-edit-field">
                      <span>T/D</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        disabled={!canEditAmount}
                        value={edit.td}
                        onChange={(e) =>
                          handleItemFieldChange(item.damageAssessmentItemId, 'td', e.target.value)
                        }
                      />
                    </label>

                    <label className="damage-edit-field">
                      <span>Painting</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        disabled={!canEditAmount}
                        value={edit.ptg}
                        onChange={(e) =>
                          handleItemFieldChange(item.damageAssessmentItemId, 'ptg', e.target.value)
                        }
                      />
                    </label>

                    <label className="damage-edit-field">
                      <span>Others</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        disabled={!canEditAmount}
                        value={edit.others}
                        onChange={(e) =>
                          handleItemFieldChange(item.damageAssessmentItemId, 'others', e.target.value)
                        }
                      />
                    </label>
                  </div>
                </article>
              )
            })}
          </div>

          <div className="damage-inspection-total">
            <div>
              <span>Inspection Total</span>
              <small>Labour + parts + all assessed adjustments</small>
            </div>
            <strong>
              {formatCurrency(
                damageItems.reduce((sum, item) => {
                  const edit = itemEdits[item.damageAssessmentItemId]
                  return (
                    sum +
                    (item.labourAmount ?? 0) +
                    (item.partsAmount ?? 0) +
                    toNum(edit?.dep ?? '0') +
                    toNum(edit?.rr ?? '0') +
                    toNum(edit?.td ?? '0') +
                    toNum(edit?.ptg ?? '0') +
                    toNum(edit?.others ?? '0')
                  )
                }, 0),
              )}
            </strong>
          </div>

          {itemsError && <p className="error-text">{itemsError}</p>}

          {canEditAmount && (
            <div className="damage-inspection-actions">
              <button type="button" onClick={() => void handleSaveItems()} disabled={savingItems}>
                <Save size={15} style={{ verticalAlign: '-2px', marginRight: '0.4rem' }} />
                {savingItems ? 'Saving…' : 'Save inspection details'}
              </button>
            </div>
          )}
        </section>
      )}

      <Modal
        open={showSettlementPreview}
        onClose={() => setShowSettlementPreview(false)}
        title="Liability Settlement Preview"
      >
        <div className="liability-settlement-preview">
          <div className="liability-settlement-preview-header">
            <div>
              <h3>Liability Settlement</h3>
              <p>Assessment summary</p>
            </div>
            <button
              type="button"
              className="liability-settlement-print-button"
              onClick={() => window.print()}
            >
              Print / Save PDF
            </button>
          </div>

          <div className="liability-settlement-preview-grid">
            <InfoRow label="Total Labour" value={formatCurrency(displayTotalLabour)} />
            <InfoRow label="Total Parts" value={formatCurrency(displayTotalParts)} />
            <InfoRow label="Tax" value={formatCurrency(displayTax)} />
            <InfoRow label="Gross" value={formatCurrency(gross)} />
            <InfoRow label="Depreciation" value={formatCurrency(displayDep)} />
            <InfoRow label="Dep Waiver" value={formatCurrency(displayDepWaiver)} />
            <InfoRow label="Compulsory Excess" value={formatCurrency(displayCompulsoryExcess)} />
            <InfoRow label="Imposed Excess" value={formatCurrency(displayImposedExcess)} />
            <InfoRow label="Salvage Deductions" value={formatCurrency(displaySalvage)} />
            <InfoRow label="Other Deduction" value={formatCurrency(displayOtherDeduction)} />
            <InfoRow label="Total Deduction" value={formatCurrency(totalDeduction)} />
            <InfoRow label="Towing Amount" value={formatCurrency(displayTowing)} />
          </div>

          <div className="liability-settlement-preview-total">
            <span>Net Assessment</span>
            <strong>{formatCurrency(netAssessment)}</strong>
          </div>
        </div>
      </Modal>

      <Modal open={editingFigures} onClose={() => setEditingFigures(false)} title="Edit Assessment Summary">
        <form onSubmit={(e) => void handleSaveFigures(e)}>
          <div className="survey-grid">
            <div className="survey-field">
              <label htmlFor="liab-total-labour">Total Labour (₹)</label>
              <input id="liab-total-labour" type="number" min="0" step="0.01" value={totalLabourStr} onChange={(e) => setTotalLabourStr(e.target.value)} />
            </div>
            <div className="survey-field">
              <label htmlFor="liab-total-parts">Total Part (₹)</label>
              <input id="liab-total-parts" type="number" min="0" step="0.01" value={totalPartsStr} onChange={(e) => setTotalPartsStr(e.target.value)} />
            </div>
            <div className="survey-field">
              <label htmlFor="liab-tax">Tax (₹)</label>
              <input id="liab-tax" type="number" min="0" step="0.01" value={taxStr} onChange={(e) => setTaxStr(e.target.value)} />
            </div>
            <div className="survey-field">
              <label htmlFor="liab-dep">Dep (₹)</label>
              <input id="liab-dep" type="number" min="0" step="0.01" value={depStr} onChange={(e) => setDepStr(e.target.value)} />
            </div>
            <div className="survey-field">
              <label htmlFor="liab-dep-waiver">Dep Waiver (₹)</label>
              <input id="liab-dep-waiver" type="number" min="0" step="0.01" value={depWaiverStr} onChange={(e) => setDepWaiverStr(e.target.value)} />
            </div>
            <div className="survey-field">
              <label htmlFor="liab-compulsory-excess">Compulsory Excess (₹)</label>
              <input id="liab-compulsory-excess" type="number" min="0" step="0.01" value={compulsoryExcessStr} onChange={(e) => setCompulsoryExcessStr(e.target.value)} />
            </div>
            <div className="survey-field">
              <label htmlFor="liab-imposed-excess">Imposed Excess (₹)</label>
              <input id="liab-imposed-excess" type="number" min="0" step="0.01" value={imposedExcessStr} onChange={(e) => setImposedExcessStr(e.target.value)} />
            </div>
            <div className="survey-field">
              <label htmlFor="liab-salvage">Salvage Deductions (₹)</label>
              <input id="liab-salvage" type="number" min="0" step="0.01" value={salvageStr} onChange={(e) => setSalvageStr(e.target.value)} />
            </div>
            <div className="survey-field">
              <label htmlFor="liab-other-deduction">Other Deduction (₹)</label>
              <input id="liab-other-deduction" type="number" min="0" step="0.01" value={otherDeductionStr} onChange={(e) => setOtherDeductionStr(e.target.value)} />
            </div>
            <div className="survey-field">
              <label htmlFor="liab-towing">Towing Amount (₹)</label>
              <input id="liab-towing" type="number" min="0" step="0.01" value={towingStr} onChange={(e) => setTowingStr(e.target.value)} />
            </div>
          </div>
          {figuresError && <p className="error-text">{figuresError}</p>}
          <button type="submit" disabled={savingFigures}>
            <Save size={15} style={{ verticalAlign: '-2px', marginRight: '0.4rem' }} />
            {savingFigures ? 'Saving…' : 'Save changes'}
          </button>{' '}
          <button type="button" onClick={() => setEditingFigures(false)} disabled={savingFigures}>
            Cancel
          </button>
        </form>
      </Modal>
    </div>
  )
}