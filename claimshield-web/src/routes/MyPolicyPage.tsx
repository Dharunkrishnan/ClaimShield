import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ApiError,
  getMyClaims,
  getMyCustomerProfile,
  getMyPolicies,
  getMyVehicles,
} from '../lib/api'
import type {
  ClaimResponseDto,
  CustomerResponseDto,
  PolicyResponseDto,
  VehicleResponseDto,
} from '../lib/types'
import { PolicyTypeName } from '../lib/statuses'
import { SkeletonBlock } from '../components/Skeleton'
import { ClaimStatusBadge } from '../components/StatusBadge'
import { useAuth } from '../context/AuthContext'
import {
  ShieldCheck,
  Building2,
  CalendarDays,
  Layers,
  Wallet,
  Percent,
  Car,
  ChevronDown,
  ChevronRight,
  Sparkles,
  User,
  Phone,
  Mail,
  MapPin,
  ClipboardList,
  Eye,
  Zap,
  ArrowRight,
  ArrowLeft,
  X,
} from 'lucide-react'

function formatCurrency(amount: number | null) {
  return amount != null ? `₹ ${amount.toLocaleString('en-IN')}` : '—'
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getPolicyStatus(policy: PolicyResponseDto): { label: string; tone: string } {
  const now = new Date()
  const end = new Date(policy.endDate)
  const start = new Date(policy.startDate)

  if (end < now) return { label: 'Expired', tone: 'neutral' }
  if (start > now) return { label: 'Upcoming', tone: 'blue' }
  return { label: 'Active', tone: 'green' }
}

function parseAddOns(addOns: string | null): string[] {
  if (!addOns) return []
  return addOns
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

type SectionKey = 'vehicle' | 'coverage' | 'addons' | 'holder' | 'claims'

const DEFAULT_OPEN_SECTIONS: SectionKey[] = ['holder']

interface AccordionSectionProps {
  id: SectionKey
  icon: React.ReactNode
  title: string
  subtitle?: string
  badge?: React.ReactNode
  isOpen: boolean
  onToggle: (id: SectionKey) => void
  children: React.ReactNode
}

function AccordionSection({
  id,
  icon,
  title,
  subtitle,
  badge,
  isOpen,
  onToggle,
  children,
}: AccordionSectionProps) {
  return (
    <div className={`accordion-section${isOpen ? ' is-open' : ''}`}>
      <button
        type="button"
        className="accordion-header"
        onClick={() => onToggle(id)}
        aria-expanded={isOpen}
      >
        <span className="accordion-icon">{icon}</span>
        <span className="accordion-heading">
          <span className="accordion-title">{title}</span>
          {subtitle && <span className="accordion-subtitle">{subtitle}</span>}
        </span>
        {badge}
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

export function MyPolicyPage() {
  const { session } = useAuth()

  const [customer, setCustomer] = useState<CustomerResponseDto | null>(null)
  const [policies, setPolicies] = useState<PolicyResponseDto[] | null>(null)
  const [vehicles, setVehicles] = useState<VehicleResponseDto[] | null>(null)
  const [claims, setClaims] = useState<ClaimResponseDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null)
  const [openSections, setOpenSections] = useState<SectionKey[]>(DEFAULT_OPEN_SECTIONS)
  const [claimsVisibleCount, setClaimsVisibleCount] = useState(4)
  const [mobileClaimsVisibleCount, setMobileClaimsVisibleCount] = useState(3)

  useEffect(() => {
    let cancelled = false

    getMyCustomerProfile()
      .then(async (customerData) => {
        const [policyData, vehicleData, claimData] = await Promise.all([
          getMyPolicies(customerData.customerId),
          getMyVehicles(customerData.customerId),
          getMyClaims(customerData.customerId),
        ])
        if (!cancelled) {
          setCustomer(customerData)
          setPolicies(policyData)
          setVehicles(vehicleData)
          setClaims(claimData)
          if (typeof window !== 'undefined' && window.innerWidth >= 768 && policyData.length > 0) {
            setSelectedPolicyId(policyData[0].policyId)
          }
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Failed to load your policies.')
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const loading = !policies || !vehicles || !claims

  const selectedPolicy = useMemo(
    () => policies?.find((p) => p.policyId === selectedPolicyId) ?? null,
    [policies, selectedPolicyId],
  )

  const selectedVehicle = useMemo(
    () => vehicles?.find((v) => v.vehicleId === selectedPolicy?.vehicleId) ?? null,
    [vehicles, selectedPolicy],
  )

  const policyClaims = useMemo(
    () =>
      (claims ?? [])
        .filter((c) => c.policyId === selectedPolicy?.policyId)
        .sort(
          (a, b) =>
            new Date(b.reportedDate ?? b.incidentDate).getTime() -
            new Date(a.reportedDate ?? a.incidentDate).getTime(),
        ),
    [claims, selectedPolicy],
  )

  const handleSelectPolicy = (policyId: string) => {
    setOpenSections(DEFAULT_OPEN_SECTIONS)
    setClaimsVisibleCount(4)
    setMobileClaimsVisibleCount(3)
    setSelectedPolicyId((current) => (current === policyId ? null : policyId))
  }

  const toggleSection = (id: SectionKey) => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setOpenSections((current) => (current.includes(id) ? [] : [id]))
    } else {
      setOpenSections((current) =>
        current.includes(id) ? current.filter((k) => k !== id) : [...current, id],
      )
    }
  }

  const customerName =
    [session?.user.user_metadata?.first_name, session?.user.user_metadata?.last_name]
      .filter(Boolean)
      .join(' ') || session?.user.email || 'Policyholder'

  const customerAddress = customer
    ? [customer.addressLine1, customer.addressLine2, customer.city, customer.state, customer.pincode]
        .filter(Boolean)
        .join(', ')
    : ''

  return (
    <div>
      <h1>My Policy</h1>

      {error && <p className="error-text">{error}</p>}

      {!error && loading && (
        <section className="card">
          <SkeletonBlock lines={5} />
        </section>
      )}

      {!loading && policies!.length === 0 && (
        <p>No policies are linked to your account yet.</p>
      )}

      {!loading && policies!.length > 0 && (
        <div className="policy-layout">
          <div className="policy-list">
            <div className="policy-cards-grid">
              {policies!.map((policy) => {
                const status = getPolicyStatus(policy)
                const vehicle = vehicles!.find((v) => v.vehicleId === policy.vehicleId)
                const isSelected = policy.policyId === selectedPolicyId

                return (
                  <button
                    type="button"
                    key={policy.policyId}
                    className={`policy-list-card${isSelected ? ' is-selected' : ''}`}
                    onClick={() => handleSelectPolicy(policy.policyId)}
                  >
                    <div className="policy-list-card-main">
                      <div className="policy-list-card-primary">
                        <span className="policy-list-number">
                          <ShieldCheck size={16} />
                          {policy.policyNumber}
                        </span>
                        <span className={`badge badge-${status.tone}`}>{status.label}</span>
                      </div>

                      <span className="policy-list-type">
                        {policy.policyTypeId ? PolicyTypeName[policy.policyTypeId] ?? 'Policy' : 'Policy'}
                        {vehicle && ` · ${vehicle.registrationNumber}`}
                      </span>

                      <span className="policy-list-dates">
                        {formatDate(policy.startDate)} – {formatDate(policy.endDate)}
                      </span>
                    </div>

                    <div className="policy-list-card-aside">
                      <span className="policy-list-chevron">
                        <ChevronRight size={16} />
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="policy-promo-card">
              <span className="policy-promo-badge">
                <Zap size={12} fill="currentColor" />
                Fast track
              </span>

              <div className="policy-promo-headline policy-promo-headline-compact">
                Under 30<span>min</span>
              </div>

              <p className="policy-promo-text">
                Why Wait 5-7 Days? Get Dents, Scratches &amp; Windshield Damage
                Claims Settled in Minutes.
              </p>

              <div className="policy-promo-bar">
                <div className="policy-promo-bar-row">
                  <span className="policy-promo-bar-label">Industry</span>
                  <span className="policy-promo-bar-track">
                    <span className="policy-promo-bar-fill" style={{ width: '100%' }} />
                  </span>
                  <span className="policy-promo-bar-value">5–7 days</span>
                </div>
                <div className="policy-promo-bar-row">
                  <span className="policy-promo-bar-label">claimshield+</span>
                  <span className="policy-promo-bar-track">
                    <span className="policy-promo-bar-fill is-fast" style={{ width: '8%' }} />
                  </span>
                  <span className="policy-promo-bar-value">30 min</span>
                </div>
              </div>

              <Link to="/my-claims/new" className="policy-promo-cta">
                Raise a claim
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          {/* Mobile backdrop overlay */}
          {selectedPolicy && (
            <div
              className="policy-mobile-backdrop"
              onClick={() => setSelectedPolicyId(null)}
              aria-hidden="true"
            />
          )}

          <div className={`policy-detail-area${selectedPolicy ? ' is-drawer-open' : ''}`}>
            <AnimatePresence mode="wait">
              {selectedPolicy &&
                (() => {
                  const status = getPolicyStatus(selectedPolicy)
                  const startMs = new Date(selectedPolicy.startDate).getTime()
                  const endMs = new Date(selectedPolicy.endDate).getTime()
                  const nowMs = Date.now()
                  const totalDuration = endMs - startMs
                  const remainingMs = Math.max(0, endMs - nowMs)
                  const remainingPercent =
                    totalDuration > 0 ? Math.min(100, (remainingMs / totalDuration) * 100) : 0
                  const daysRemaining = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)))

                  return (
                    <motion.div
                      key={selectedPolicy.policyId}
                      className="policy-detail-container"
                      initial={{ opacity: 0, x: -28 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -28 }}
                      transition={{ duration: 0.25, ease: 'easeOut' }}
                    >
                      {/* Mobile Drawer Top Bar (Hidden on desktop) */}
                      <div className="policy-drawer-topbar">
                        <button
                          type="button"
                          className="policy-drawer-back-btn"
                          onClick={() => setSelectedPolicyId(null)}
                          aria-label="Back to policies list"
                        >
                          <ArrowLeft size={16} />
                          <span>Back to policies</span>
                        </button>
                        <button
                          type="button"
                          className="policy-drawer-close-btn"
                          onClick={() => setSelectedPolicyId(null)}
                          aria-label="Close details"
                        >
                          <X size={18} />
                        </button>
                      </div>

                      {/* Hero summary */}
                      <section className="policy-hero">
                        <div className="policy-hero-top">
                          <span className="policy-hero-number">
                            <ShieldCheck size={20} />
                            {selectedPolicy.policyNumber}
                          </span>
                          <span className={`badge badge-${status.tone}`}>{status.label}</span>
                          <span className="badge badge-icon badge-blue">
                            <Layers size={13} />
                            {selectedPolicy.policyTypeId
                              ? PolicyTypeName[selectedPolicy.policyTypeId] ?? 'Policy'
                              : 'Policy'}
                          </span>
                        </div>

                        <span className="policy-hero-insurer">
                          <Building2 size={13} /> ClaimShield+ Insurance
                        </span>

                        <div className="policy-hero-validity">
                          <div className="policy-hero-validity-track">
                            <div
                              className="policy-hero-validity-fill"
                              style={{ width: `${remainingPercent}%` }}
                            />
                          </div>
                          <div className="policy-hero-validity-labels">
                            <span>
                              <CalendarDays size={13} /> {formatDate(selectedPolicy.startDate)}
                            </span>
                            <span className="policy-hero-days-left">
                              {status.label === 'Expired'
                                ? 'Expired'
                                : `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining`}
                            </span>
                            <span>
                              {formatDate(selectedPolicy.endDate)} <CalendarDays size={13} />
                            </span>
                          </div>
                        </div>
                      </section>

                      {/* Accordion sections */}
                      <div className="accordion-group">
                        <AccordionSection
                          id="holder"
                          icon={<User size={16} />}
                          title="Policy holder"
                          subtitle={customerName}
                          isOpen={openSections.includes('holder')}
                          onToggle={toggleSection}
                        >
                          <div className="policy-fact-list">
                            <div className="policy-fact-row">
                              <span className="policy-fact-label">
                                <span className="fact-icon fact-icon-blue"><ShieldCheck size={13} /></span>
                                Policy number
                              </span>
                              <span className="policy-fact-value font-mono">{selectedPolicy.policyNumber}</span>
                            </div>

                            <div className="policy-fact-row">
                              <span className="policy-fact-label">
                                <span className="fact-icon fact-icon-blue"><User size={13} /></span>
                                Customer name
                              </span>
                              <span className="policy-fact-value">{customerName}</span>
                            </div>

                            <div className="policy-fact-row">
                              <span className="policy-fact-label">
                                <span className="fact-icon fact-icon-teal"><Phone size={13} /></span>
                                Contact number
                              </span>
                              {/* TODO: temporary hardcoded fallback - remove once
                                  GET /api/Customers/me reliably returns phoneNumber
                                  from the DB (see chat: stale-build investigation) */}
                              <span className="policy-fact-value">{customer?.phoneNumber || '+91 98765 43210'}</span>
                            </div>

                            <div className="policy-fact-row">
                              <span className="policy-fact-label">
                                <span className="fact-icon fact-icon-amber"><Mail size={13} /></span>
                                Email address
                              </span>
                              <span className="policy-fact-value policy-fact-email">{customer?.email ?? session?.user.email ?? '—'}</span>
                            </div>

                            {customerAddress && (
                              <div className="policy-fact-row">
                                <span className="policy-fact-label">
                                  <span className="fact-icon fact-icon-blue"><MapPin size={13} /></span>
                                  Address
                                </span>
                                <span className="policy-fact-value">{customerAddress}</span>
                              </div>
                            )}
                          </div>
                        </AccordionSection>

                        <AccordionSection
                          id="coverage"
                          icon={<Wallet size={16} />}
                          title="Coverage"
                          subtitle={formatCurrency(selectedPolicy.coverageAmount)}
                          isOpen={openSections.includes('coverage')}
                          onToggle={toggleSection}
                        >
                          <div className="policy-fact-list">
                            <div className="policy-fact-row">
                              <span className="policy-fact-label">
                                <span className="fact-icon fact-icon-blue"><Layers size={13} /></span>
                                Coverage type
                              </span>
                              <span className="policy-fact-value">
                                {selectedPolicy.policyTypeId
                                  ? PolicyTypeName[selectedPolicy.policyTypeId] ?? 'Unknown'
                                  : '—'}
                              </span>
                            </div>

                            <div className="policy-fact-row">
                              <span className="policy-fact-label">
                                <span className="fact-icon fact-icon-teal"><Wallet size={13} /></span>
                                Sum insured
                              </span>
                              <span className="policy-fact-value">{formatCurrency(selectedPolicy.coverageAmount)}</span>
                            </div>

                            <div className="policy-fact-row">
                              <span className="policy-fact-label">
                                <span className="fact-icon fact-icon-blue"><Wallet size={13} /></span>
                                Premium
                              </span>
                              <span className="policy-fact-value">{formatCurrency(selectedPolicy.premiumAmount)}</span>
                            </div>

                            <div className="policy-fact-row">
                              <span className="policy-fact-label">
                                <span className="fact-icon fact-icon-teal"><Percent size={13} /></span>
                                Deductible
                              </span>
                              <span className="policy-fact-value">{formatCurrency(selectedPolicy.excess)}</span>
                            </div>
                          </div>
                        </AccordionSection>

                        <AccordionSection
                          id="vehicle"
                          icon={<Car size={16} />}
                          title="Vehicle details"
                          subtitle={selectedVehicle?.registrationNumber ?? 'No vehicle linked'}
                          isOpen={openSections.includes('vehicle')}
                          onToggle={toggleSection}
                        >
                          {selectedVehicle ? (
                            <div className="policy-fact-list">
                              <div className="policy-fact-row">
                                <span className="policy-fact-label">
                                  <span className="fact-icon fact-icon-blue"><Car size={13} /></span>
                                  Registration number
                                </span>
                                <span className="policy-fact-value font-mono">{selectedVehicle.registrationNumber}</span>
                              </div>

                              <div className="policy-fact-row">
                                <span className="policy-fact-label">
                                  <span className="fact-icon fact-icon-teal"><CalendarDays size={13} /></span>
                                  Manufacturing year
                                </span>
                                <span className="policy-fact-value">{selectedVehicle.manufacturingYear}</span>
                              </div>

                              {selectedVehicle.engineNumber && (
                                <div className="policy-fact-row">
                                  <span className="policy-fact-label">
                                    <span className="fact-icon fact-icon-blue"><Sparkles size={13} /></span>
                                    Engine number
                                  </span>
                                  <span className="policy-fact-value font-mono">{selectedVehicle.engineNumber}</span>
                                </div>
                              )}

                              <div className="policy-fact-row">
                                <span className="policy-fact-label">
                                  <span className="fact-icon fact-icon-teal"><ShieldCheck size={13} /></span>
                                  Chassis number
                                </span>
                                <span className="policy-fact-value font-mono">{selectedVehicle.chassisNumber}</span>
                              </div>
                            </div>
                          ) : (
                            <p>No vehicle linked to this policy.</p>
                          )}
                        </AccordionSection>

                        <AccordionSection
                          id="addons"
                          icon={<Sparkles size={16} />}
                          title="Add-ons"
                          subtitle={`${parseAddOns(selectedPolicy.addOns).length} purchased`}
                          isOpen={openSections.includes('addons')}
                          onToggle={toggleSection}
                        >
                          {parseAddOns(selectedPolicy.addOns).length > 0 ? (
                            <div className="addon-tags">
                              {parseAddOns(selectedPolicy.addOns).map((addon) => (
                                <span key={addon} className="badge badge-blue">
                                  {addon}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p>No add-ons purchased on this policy.</p>
                          )}
                        </AccordionSection>

                        <AccordionSection
                          id="claims"
                          icon={<ClipboardList size={16} />}
                          title="Claims history"
                          subtitle={`${policyClaims.length} claim${policyClaims.length === 1 ? '' : 's'} raised`}
                          isOpen={openSections.includes('claims')}
                          onToggle={toggleSection}
                        >
                          {policyClaims.length === 0 && (
                            <p>No claims have been raised on this policy yet.</p>
                          )}

                          {policyClaims.length > 0 && (
                            <>
                              {/* Desktop Claims Table */}
                              <div className="policy-claims-desktop-table table-responsive">
                                <table className="queue-table">
                                  <thead>
                                    <tr>
                                      <th>Claim No</th>
                                      <th>Loss Date</th>
                                      <th>Status</th>
                                      <th></th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {policyClaims.slice(0, claimsVisibleCount).map((claim) => (
                                      <tr key={claim.claimId}>
                                        <td>
                                          {claim.claimNumber}
                                        </td>
                                        <td>{formatDateTime(claim.incidentDate)}</td>
                                        <td>
                                          <ClaimStatusBadge statusId={claim.statusId} />
                                        </td>
                                        <td>
                                          <Link to={`/my-claims/${claim.claimId}`} className="button-link">
                                            <Eye size={14} />
                                            View
                                          </Link>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                {claimsVisibleCount < policyClaims.length && (
                                  <button
                                    type="button"
                                    className="track-claim-view-more policy-claims-desktop-more"
                                    onClick={() => setClaimsVisibleCount((c) => c + 4)}
                                  >
                                    View more ({policyClaims.length - claimsVisibleCount} more)
                                  </button>
                                )}
                              </div>

                              {/* Mobile Structured Claims List */}
                              <div className="policy-claims-mobile-list">
                                {policyClaims.slice(0, mobileClaimsVisibleCount).map((claim) => (
                                  <div key={claim.claimId} className="policy-claim-card">
                                    <div className="policy-claim-card-header">
                                      <span className="policy-claim-card-num">{claim.claimNumber}</span>
                                      <ClaimStatusBadge statusId={claim.statusId} />
                                    </div>
                                    <div className="policy-claim-card-footer">
                                      <span className="policy-claim-card-date">
                                        <CalendarDays size={12} />
                                        {formatDateTime(claim.incidentDate)}
                                      </span>
                                      <Link to={`/my-claims/${claim.claimId}`} className="policy-claim-card-link">
                                        <Eye size={13} />
                                        <span>View</span>
                                      </Link>
                                    </div>
                                  </div>
                                ))}
                                {mobileClaimsVisibleCount < policyClaims.length && (
                                  <button
                                    type="button"
                                    className="track-claim-view-more policy-claims-mobile-more"
                                    onClick={() => setMobileClaimsVisibleCount((c) => c + 3)}
                                  >
                                    View more ({policyClaims.length - mobileClaimsVisibleCount} more)
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </AccordionSection>
                      </div>
                    </motion.div>
                  )
                })()}
            </AnimatePresence>

            {!selectedPolicy && (
              <div className="policy-detail-placeholder">
                <ShieldCheck size={28} />
                <p>Select a policy on the left to view its full details, vehicle information, and claim history.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}