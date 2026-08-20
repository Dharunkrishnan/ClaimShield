import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link, useParams } from 'react-router-dom'
import {
  ApiError,
  closeClaim,
  getClaim,
  getPaymentsByClaim,
  getPolicyById,
  getVehicleById,
} from '../lib/api'
import type {
  ClaimResponseDto,
  PaymentResponseDto,
  PolicyResponseDto,
  VehicleResponseDto,
} from '../lib/types'
import { ClaimStatus, ClaimStatusName, LossType, LossTypeName, PolicyTypeName } from '../lib/statuses'
import {
  ClipboardList,
  ShieldCheck,
  Car,
  ChevronDown,
  Wallet,
  Gauge,
  Percent,
  Zap,
  Check,
  Sparkles,
} from 'lucide-react'

function formatCurrency(amount: number | null) {
  return amount != null ? `₹ ${amount.toLocaleString('en-IN')}` : '—'
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString('en-IN') : '—'
}

// incidentDate is a date-only value (from a date picker) - formatting
// it with a time component produces a misleading artifact like
// "5:30 AM" that was never actually chosen by anyone.
function formatDateOnly(value: string | null) {
  return value
    ? new Date(value).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—'
}

const INSTANT_PART_LABELS: Record<string, string> = {
  windshieldFront: 'Windshield (Front)',
  windshieldRear: 'Windshield (Rear)',
  glass: 'Glass / Window',
  tyre: 'Tyre',
}

const INSTANT_ELIGIBLE_CATEGORIES = ['Minor dents', 'Windshield & glass', 'Scratches']

function parseInstantParts(raw: string | null): string[] {
  if (!raw) return []
  try {
    const obj = JSON.parse(raw) as Record<string, boolean>
    return Object.entries(obj)
      .filter(([, selected]) => selected)
      .map(([key]) => INSTANT_PART_LABELS[key] ?? key)
  } catch {
    return []
  }
}

type SectionKey = 'claim' | 'policy' | 'vehicle'

function AccordionSection({
  icon,
  title,
  subtitle,
  isOpen,
  onToggle,
  children,
}: {
  icon: ReactNode
  title: string
  subtitle?: string
  isOpen: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className={`accordion-section${isOpen ? ' is-open' : ''}`}>
      <button type="button" className="accordion-header" onClick={onToggle} aria-expanded={isOpen}>
        <span className="accordion-icon">{icon}</span>
        <span className="accordion-heading">
          <span className="accordion-title">{title}</span>
          {subtitle && <span className="accordion-subtitle">{subtitle}</span>}
        </span>
        <ChevronDown size={18} className="accordion-chevron" />
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="accordion-content">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function MyClaimDetailPage() {
  const { claimId } = useParams<{ claimId: string }>()

  const [claim, setClaim] = useState<ClaimResponseDto | null>(null)
  const [policy, setPolicy] = useState<PolicyResponseDto | null>(null)
  const [vehicle, setVehicle] = useState<VehicleResponseDto | null>(null)
  const [payments, setPayments] = useState<PaymentResponseDto[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  const [openSections, setOpenSections] = useState<SectionKey[]>(['claim'])

  const toggleSection = (key: SectionKey) =>
    setOpenSections((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key],
    )

  const loadAll = useCallback(async () => {
    if (!claimId) return

    setLoading(true)
    setLoadError(null)

    try {
      const claimData = await getClaim(claimId)

      const [policyData, vehicleData, paymentData] = await Promise.all([
        getPolicyById(claimData.policyId).catch(() => null),
        getVehicleById(claimData.vehicleId).catch(() => null),
        getPaymentsByClaim(claimId).catch(() => []),
      ])

      setClaim(claimData)
      setPolicy(policyData)
      setVehicle(vehicleData)
      setPayments(paymentData)
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to load this claim.')
    } finally {
      setLoading(false)
    }
  }, [claimId])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const handleClose = async () => {
    if (!claimId) return

    try {
      const result = await closeClaim(claimId, 'Closed by customer.')
      setActionMessage(result.message)
      void loadAll()
    } catch (err) {
      setActionMessage(
        err instanceof ApiError ? err.message : 'Failed to close claim.',
      )
    }
  }

  if (loading) {
    return <p>Loading…</p>
  }

  if (loadError || !claim) {
    return <p className="error-text">{loadError ?? 'Claim not found.'}</p>
  }

  const isMinorAccident = claim.lossTypeId === LossType.MinorAccident
  const usedInstantClaim = isMinorAccident && claim.instantClaimToggle === true
  const selectedParts = parseInstantParts(claim.instantClaimParts)

  return (
    <div>
      <p>
        <Link to="/my-claims">← Back to my claims</Link>
      </p>

      <h1>{claim.claimNumber}</h1>

      <div className="claim-summary-layout">
        <div className="claim-summary-main">
          <div className="accordion-group">
            <AccordionSection
              icon={<ClipboardList size={16} />}
              title="Claim details"
              subtitle={ClaimStatusName[claim.statusId ?? 0] ?? 'Unknown'}
              isOpen={openSections.includes('claim')}
              onToggle={() => toggleSection('claim')}
            >
              <dl className="fact-grid fact-grid-rich">
                <dt>Status</dt>
                <dd>{ClaimStatusName[claim.statusId ?? 0] ?? 'Unknown'}</dd>

                <dt>Loss type</dt>
                <dd>{claim.lossTypeId ? LossTypeName[claim.lossTypeId] ?? '—' : '—'}</dd>

                <dt>Incident date</dt>
                <dd>{formatDateOnly(claim.incidentDate)}</dd>

                <dt>Location</dt>
                <dd>{claim.incidentLocation ?? '—'}</dd>

                <dt>Approved amount</dt>
                <dd>{formatCurrency(claim.approvedAmount)}</dd>
              </dl>

              {claim.incidentDescription && (
                <>
                  <h3 style={{ marginTop: '1rem' }}>What happened</h3>
                  <p style={{ margin: 0 }}>{claim.incidentDescription}</p>
                </>
              )}
            </AccordionSection>

            <AccordionSection
              icon={<ShieldCheck size={16} />}
              title="Policy details"
              subtitle={policy?.policyNumber}
              isOpen={openSections.includes('policy')}
              onToggle={() => toggleSection('policy')}
            >
              {policy ? (
                <dl className="fact-grid fact-grid-rich">
                  <dt>Policy number</dt>
                  <dd>{policy.policyNumber}</dd>

                  <dt>Policy type</dt>
                  <dd>
                    {policy.policyTypeId
                      ? PolicyTypeName[policy.policyTypeId] ?? 'Unknown'
                      : '—'}
                  </dd>

                  <dt>Policy period</dt>
                  <dd>
                    {new Date(policy.startDate).toLocaleDateString('en-IN')} –{' '}
                    {new Date(policy.endDate).toLocaleDateString('en-IN')}
                  </dd>

                  <dt>Sum insured / coverage</dt>
                  <dd>{formatCurrency(policy.coverageAmount)}</dd>

                  <dt>IDV</dt>
                  <dd>{formatCurrency(policy.idv)}</dd>

                  <dt>Deductible / excess</dt>
                  <dd>{formatCurrency(policy.excess)}</dd>
                </dl>
              ) : (
                <p>Policy details are unavailable.</p>
              )}
            </AccordionSection>

            <AccordionSection
              icon={<Car size={16} />}
              title="Vehicle details"
              subtitle={vehicle?.registrationNumber ?? claim.vehicleRegistrationNumber ?? undefined}
              isOpen={openSections.includes('vehicle')}
              onToggle={() => toggleSection('vehicle')}
            >
              {vehicle ? (
                <dl className="fact-grid fact-grid-rich">
                  <dt>Vehicle registration number</dt>
                  <dd>{vehicle.registrationNumber}</dd>

                  <dt>Manufacturing year</dt>
                  <dd>{vehicle.manufacturingYear}</dd>

                  {vehicle.engineNumber && (
                    <>
                      <dt>Engine number</dt>
                      <dd>{vehicle.engineNumber}</dd>
                    </>
                  )}

                  <dt>Chassis number</dt>
                  <dd>{vehicle.chassisNumber}</dd>
                </dl>
              ) : (
                <p>Vehicle details are unavailable.</p>
              )}
            </AccordionSection>
          </div>

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

          {actionMessage && <p className="success-text banner">{actionMessage}</p>}

          {claim.statusId === ClaimStatus.Settled && (
            <section className="card">
              <p>
                Your claim is Settled. You can close it once you're satisfied
                everything is resolved.
              </p>
              <button type="button" onClick={() => void handleClose()}>
                Close claim
              </button>
            </section>
          )}
        </div>

        <aside className="claim-summary-side">
          <section className="card card-tint-blue claim-coverage-panel">
            <h2>Policy coverage</h2>

            {policy ? (
              <dl className="fact-grid" style={{ marginBottom: '1rem' }}>
                <dt><Wallet size={13} /> Sum insured</dt>
                <dd>{formatCurrency(policy.coverageAmount)}</dd>

                <dt><Gauge size={13} /> IDV</dt>
                <dd>{formatCurrency(policy.idv)}</dd>

                <dt><Percent size={13} /> Deductible</dt>
                <dd>{formatCurrency(policy.excess)}</dd>
              </dl>
            ) : (
              <p>Coverage details are unavailable.</p>
            )}

            {usedInstantClaim ? (
              <div className="instant-coverage-block instant-coverage-block-used">
                <span className="instant-coverage-badge">
                  <Zap size={12} fill="currentColor" />
                  Instant Claim used
                </span>

                <p className="instant-coverage-text">
                  You selected these parts for fast-track settlement:
                </p>

                {selectedParts.length > 0 ? (
                  <ul className="instant-coverage-list">
                    {selectedParts.map((part) => (
                      <li key={part}>
                        <Check size={13} />
                        {part}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="instant-coverage-text">No specific parts recorded.</p>
                )}
              </div>
            ) : (
              <div className="instant-coverage-block">
                <span className="instant-coverage-badge instant-coverage-badge-neutral">
                  <Sparkles size={12} />
                  Fast track eligible
                </span>

                <p className="instant-coverage-text">
                  Minor claims like this can qualify for Instant Claim — settled
                  in around 30 minutes instead of the usual 5–7 days. These are
                  covered:
                </p>

                <ul className="instant-coverage-list">
                  {INSTANT_ELIGIBLE_CATEGORIES.map((category) => (
                    <li key={category}>
                      <Check size={13} />
                      {category}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}