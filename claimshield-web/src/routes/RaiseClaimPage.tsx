import {
  useEffect,
  useState,
  type FormEvent,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  CarFront,
  PackageX,
  CloudLightning,
  AlertOctagon,
  Siren,
  Flame,
  OctagonX,
  Mic,
  CheckCircle2,
  FileText,
  HelpCircle,
  Wallet,
  Car,
  ShieldCheck,
  ArrowRight,
  Check,
  AlertTriangle,
  Zap,
  User,
  Loader2,
  ScanLine,
  Database,
  type LucideIcon,
} from 'lucide-react'

import {
  acceptInstantClaim,
  ApiError,
  confirmVehicleOcrDetails,
  declineInstantClaim,
  generateEstimate,
  getDocumentOcrPreview,
  getMyCustomerProfile,
  getMyPolicies,
  getMyVehicles,
  getVehicleById,
  raiseClaimStep1,
  raiseClaimStep2,
} from '../lib/api'

import type {
  ClaimEstimateResultDto,
  InstantClaimPartsSelection,
  OcrExtractionResult,
  PolicyResponseDto,
  VehicleResponseDto,
} from '../lib/types'

import {
  LossType,
  LossTypeName,
  VehicleLocationName,
  DocumentType,
} from '../lib/statuses'
import { TAMIL_NADU_CITIES } from '../lib/tamilNaduCities'

import { WizardShell } from '../components/WizardShell'
import { Modal } from '../components/Modal'
import { useAuth } from '../context/AuthContext'
import { UploadCard } from '../components/UploadCard'
import { SkeletonBlock } from '../components/Skeleton'
import { useToast } from '../context/ToastContext'
import { CompactDropdown } from '../components/CompactDropdown'
import { ModernDateTimePicker } from '../components/ModernDateTimePicker'
import { RazorpayModal, type RazorpayPaymentResult } from '../components/RazorpayModal'

const STEP_LABELS = [
  'Basic Information',
  'Documents & Checks',
  'Review & Estimate',
]

const LOSS_TYPE_ICONS: Record<
  number,
  { Icon: LucideIcon; tone: string }
> = {
  [LossType.MinorAccident]: {
    Icon: CarFront,
    tone: 'blue',
  },
  [LossType.PartsTheft]: {
    Icon: PackageX,
    tone: 'amber',
  },
  [LossType.NaturalCalamities]: {
    Icon: CloudLightning,
    tone: 'teal',
  },
  [LossType.FullLossTheft]: {
    Icon: AlertOctagon,
    tone: 'red',
  },
  [LossType.MajorAccident]: {
    Icon: Siren,
    tone: 'red',
  },
  [LossType.Fire]: {
    Icon: Flame,
    tone: 'amber',
  },
  [LossType.TotalLoss]: {
    Icon: OctagonX,
    tone: 'red',
  },
}

// Local (not UTC) YYYY-MM-DD - toISOString().slice(0,10) would give
// the wrong calendar day for several hours around midnight in IST
// (UTC+5:30), since it reports the UTC date, not the local one.
function formatLocalDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatCurrency(amount: number) {
  return `₹${Math.round(amount || 0).toLocaleString('en-IN')}`
}

export function RaiseClaimPage() {
  const navigate = useNavigate()

  const [step, setStep] = useState(1)

  const [claimId, setClaimId] =
    useState<string | null>(null)

  const [claimVehicleId, setClaimVehicleId] =
    useState<string | null>(null)

  const [claimLossType, setClaimLossType] =
    useState<number | null>(null)

  const [claimNumber, setClaimNumber] =
    useState<string | null>(null)

  const [customerLoading, setCustomerLoading] =
    useState(true)

  const [policies, setPolicies] =
    useState<PolicyResponseDto[]>([])

  const [vehicles, setVehicles] =
    useState<VehicleResponseDto[]>([])

  const [loadError, setLoadError] =
    useState<string | null>(null)

  const [showConfirmModal, setShowConfirmModal] =
    useState(false)

  const [wasInstantClaim, setWasInstantClaim] =
    useState(false)

  const [assignedHandlerName, setAssignedHandlerName] =
    useState<string | null>(null)

  const [carriedAnswers, setCarriedAnswers] =
    useState<{
      vehicleParkedSafely: boolean
      deathOccurred: boolean
    } | null>(null)

  const [showRoutedModal, setShowRoutedModal] =
    useState(false)

  const [routedMessage, setRoutedMessage] =
    useState('')

  useEffect(() => {
    getMyCustomerProfile()
      .then((customer) =>
        Promise.all([
          getMyPolicies(customer.customerId),
          getMyVehicles(customer.customerId),
        ]),
      )
      .then(([policyData, vehicleData]) => {
        setPolicies(policyData)
        setVehicles(vehicleData)
      })
      .catch((err: unknown) => {
        setLoadError(
          err instanceof ApiError
            ? err.message
            : 'Failed to load your details.',
        )
      })
      .finally(() => {
        setCustomerLoading(false)
      })
  }, [])

  const handleStep1Done = (
    id: string,
    number: string,
    _message: string,
    instantClaimSelected: boolean,
    handlerName: string | null,
    answers: { vehicleParkedSafely: boolean; deathOccurred: boolean },
    vehicleId: string,
    lossType: number,
  ) => {
    setClaimId(id)
    setClaimNumber(number)
    setClaimVehicleId(vehicleId)
    setClaimLossType(lossType)
    setWasInstantClaim(instantClaimSelected)
    setAssignedHandlerName(handlerName)
    setCarriedAnswers(answers)
    setShowConfirmModal(true)
  }

  const handleRouted = (message: string) => {
    setRoutedMessage(message)
    setShowRoutedModal(true)
  }

  if (loadError) {
    return (
      <p className="error-text">
        {loadError}
      </p>
    )
  }

  return (
    <div>
      <h1>Raise a Claim</h1>

      <WizardShell
        currentStep={step}
        labels={STEP_LABELS}
      >
        {step === 1 && (
          <Step1
            loading={customerLoading}
            policies={policies}
            vehicles={vehicles}
            onDone={handleStep1Done}
          />
        )}

        {step === 2 && claimId && claimVehicleId && claimLossType && carriedAnswers && (
          <Step2
            claimId={claimId}
            claimNumber={claimNumber!}
            vehicleId={claimVehicleId}
            lossType={claimLossType}
            answers={carriedAnswers}
            onVerified={() => setStep(3)}
            onRouted={handleRouted}
          />
        )}

        {step === 3 && claimId && (
          <Step3
            claimId={claimId}
            claimNumber={claimNumber!}
            onDone={() => {
              navigate(`/my-claims/${claimId}`)
            }}
            onRouted={handleRouted}
          />
        )}
      </WizardShell>

      <Modal
        open={showConfirmModal}
        title={wasInstantClaim ? 'Fast track eligible!' : 'Claim registered!'}
      >
        <div className="claim-created-content claim-created-content-compact">
          <div
            className={`claim-success-icon ${
              wasInstantClaim ? 'claim-success-icon-instant' : ''
            }`}
          >
            {wasInstantClaim ? <Zap size={30} fill="currentColor" /> : <CheckCircle2 size={30} />}
          </div>

          {claimNumber && (
            <div className="claim-number-box claim-number-box-compact">
              <span>Claim Number</span>
              <strong>{claimNumber}</strong>
            </div>
          )}

          {wasInstantClaim ? (
            <>
              <p className="claim-created-lead">
                You're 2 quick steps away from an instant payout.
              </p>

              <ol className="instant-step-tracker">
                <li className="is-done">
                  <span className="instant-step-dot">
                    <Check size={12} />
                  </span>
                  Details submitted
                </li>
                <li className="is-current">
                  <span className="instant-step-dot">2</span>
                  Upload documents
                </li>
                <li>
                  <span className="instant-step-dot">3</span>
                  Get paid
                </li>
              </ol>
            </>
          ) : (
            <>
              <p className="claim-created-lead">
                Your claim has been assigned for review.
              </p>

              {assignedHandlerName && (
                <div className="claim-handler-box">
                  <span className="claim-handler-avatar">
                    <User size={16} />
                  </span>
                  <span>
                    <span className="claim-handler-label">Claim Handler</span>
                    <strong>{assignedHandlerName}</strong>
                  </span>
                </div>
              )}
            </>
          )}

          <button
            type="button"
            onClick={() => {
              setShowConfirmModal(false)
              setStep(2)
            }}
          >
            Continue
            <ArrowRight size={17} />
          </button>
        </div>
      </Modal>

      <Modal
        open={showRoutedModal}
        title="Routed to a Surveyor"
      >
        <div className="claim-created-content">
          <div className="claim-surveyor-icon">
            <AlertTriangle size={34} />
          </div>

          <p>{routedMessage}</p>

          {claimNumber && (
            <div className="claim-number-box">
              <span>Claim Number</span>

              <strong>
                {claimNumber}
              </strong>

              <small>
                Keep this number for future reference.
              </small>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setShowRoutedModal(false)
              navigate(`/my-claims/${claimId}`)
            }}
          >
            View my claim
            <ArrowRight size={17} />
          </button>
        </div>
      </Modal>
    </div>
  )
}

const RAISE_CLAIM_DRAFT_KEY = 'claimshield.raiseClaimDraft'

interface RaiseClaimDraft {
  policyId: string
  vehicleId: string
  vehicleLocationAtLoss: number
  lossType: number
  dateOfLoss: string
  timeOfLoss: string
  locationOfLoss: string
  description: string
  instantToggle: boolean
  parts: InstantClaimPartsSelection
  vehicleParkedSafely: boolean | null
  deathOccurred: boolean | null
  savedAt: string
}

function loadRaiseClaimDraft(): RaiseClaimDraft | null {
  try {
    const raw = localStorage.getItem(RAISE_CLAIM_DRAFT_KEY)
    return raw ? (JSON.parse(raw) as RaiseClaimDraft) : null
  } catch {
    return null
  }
}

function clearRaiseClaimDraft() {
  try {
    localStorage.removeItem(RAISE_CLAIM_DRAFT_KEY)
  } catch {
    // Non-critical.
  }
}

// =====================================================================
// STEP 1 - Basic Information
// =====================================================================

function Step1({
  loading,
  policies,
  vehicles,
  onDone,
}: {
  loading: boolean
  policies: PolicyResponseDto[]
  vehicles: VehicleResponseDto[]
  onDone: (
    claimId: string,
    claimNumber: string,
    message: string,
    instantClaimSelected: boolean,
    handlerName: string | null,
    answers: { vehicleParkedSafely: boolean; deathOccurred: boolean },
    vehicleId: string,
    lossType: number,
  ) => void
}) {
  const { showToast } = useToast()
  const { displayName } = useAuth()

  const [policyId, setPolicyId] = useState('')
  const [vehicleId, setVehicleId] = useState('')

  const [
    vehicleLocationAtLoss,
    setVehicleLocationAtLoss,
  ] = useState(0)

  const [lossType, setLossType] = useState(0)

  const [dateOfLoss, setDateOfLoss] =
    useState(() => formatLocalDate(new Date()))

  const [timeOfLoss, setTimeOfLoss] =
    useState(() => {
      const now = new Date()
      return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    })

  const [locationOfLoss, setLocationOfLoss] =
    useState('')

  const [showLocationSuggestions, setShowLocationSuggestions] =
    useState(false)

  const [description, setDescription] =
    useState('')

  const [instantToggle, setInstantToggle] =
    useState(false)

  const [parts, setParts] =
    useState<InstantClaimPartsSelection>({
      windshieldFront: false,
      windshieldRear: false,
      glass: false,
      tyre: false,
    })

  const [vehicleParkedSafely, setVehicleParkedSafely] =
    useState<boolean | null>(null)

  const [deathOccurred, setDeathOccurred] =
    useState<boolean | null>(null)

  const [listening, setListening] =
    useState(false)

  const [voiceUnsupported, setVoiceUnsupported] =
    useState(false)

  const [submitting, setSubmitting] =
    useState(false)

  const [error, setError] =
    useState<string | null>(null)

  const [draftBanner, setDraftBanner] =
    useState<string | null>(null)

  // Restore a saved draft on first mount, before the "auto-select
  // first policy" effect below (which no-ops once policyId is
  // already set, so this takes priority).
  useEffect(() => {
    const draft = loadRaiseClaimDraft()
    if (!draft) return

    setPolicyId(draft.policyId)
    setVehicleId(draft.vehicleId)
    setVehicleLocationAtLoss(draft.vehicleLocationAtLoss)
    setLossType(draft.lossType)
    setDateOfLoss(draft.dateOfLoss)
    setTimeOfLoss(draft.timeOfLoss)
    setLocationOfLoss(draft.locationOfLoss)
    setDescription(draft.description)
    setInstantToggle(draft.instantToggle)
    setParts(draft.parts)
    setVehicleParkedSafely(draft.vehicleParkedSafely)
    setDeathOccurred(draft.deathOccurred)

    setDraftBanner(
      `Draft restored from ${new Date(draft.savedAt).toLocaleString('en-IN')}.`,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (
      !loading &&
      policies.length > 0 &&
      !policyId
    ) {
      setPolicyId(policies[0].policyId)
      setVehicleId(policies[0].vehicleId)
    }
  }, [
    loading,
    policies,
    policyId,
  ])

  const selectedPolicy =
    policies.find(
      (p) => p.policyId === policyId,
    )

  const selectedVehicle =
    vehicles.find(
      (v) => v.vehicleId === vehicleId,
    )

  const today = formatLocalDate(new Date())

  const minDate =
    selectedPolicy?.startDate.slice(0, 10)

  // Up to 5 Tamil Nadu cities whose name starts with whatever the
  // customer has typed so far (e.g. typing "C" surfaces Chennai,
  // Coimbatore, Cuddalore...).
  const locationSuggestions =
    locationOfLoss.trim().length > 0
      ? TAMIL_NADU_CITIES.filter((city) =>
          city.toLowerCase().startsWith(locationOfLoss.trim().toLowerCase()),
        ).slice(0, 5)
      : []

  const handleMic = () => {
    const SpeechRecognitionCtor =
      (
        window as unknown as {
          SpeechRecognition?: new () => SpeechRecognition
        }
      ).SpeechRecognition ??
      (
        window as unknown as {
          webkitSpeechRecognition?: new () => SpeechRecognition
        }
      ).webkitSpeechRecognition

    if (!SpeechRecognitionCtor) {
      setVoiceUnsupported(true)
      return
    }

    const recognition =
      new SpeechRecognitionCtor()

    recognition.lang = 'en-IN'
    recognition.interimResults = false

    recognition.onresult = (
      event: SpeechRecognitionEvent,
    ) => {
      const transcript =
        event.results[0]?.[0]?.transcript ?? ''

      setDescription((current) =>
        current
          ? `${current} ${transcript}`
          : transcript,
      )
    }

    recognition.onerror = (
      event: SpeechRecognitionErrorEvent,
    ) => {
      setListening(false)

      const message =
        event.error === 'not-allowed' ||
        event.error === 'service-not-allowed'
          ? 'Microphone access was denied. Allow microphone access in your browser and try again.'
          : event.error === 'no-speech'
            ? "Didn't catch that - no speech was detected. Please try again."
            : event.error === 'audio-capture'
              ? 'No microphone was found on this device.'
              : 'Voice input failed. Please try again or type your description.'

      showToast(message, 'error')
    }

    recognition.onend = () => {
      setListening(false)
    }

    setListening(true)
    recognition.start()
  }

  const handleSaveDraft = () => {
    const draft: RaiseClaimDraft = {
      policyId,
      vehicleId,
      vehicleLocationAtLoss,
      lossType,
      dateOfLoss,
      timeOfLoss,
      locationOfLoss,
      description,
      instantToggle,
      parts,
      vehicleParkedSafely,
      deathOccurred,
      savedAt: new Date().toISOString(),
    }

    try {
      localStorage.setItem(RAISE_CLAIM_DRAFT_KEY, JSON.stringify(draft))
      showToast('Draft saved — resume this claim anytime before submitting.', 'success')
    } catch {
      showToast('Failed to save draft on this device.', 'error')
    }
  }

  const handleSubmit = async (
    e: FormEvent,
  ) => {
    e.preventDefault()
    setError(null)

    if (!policyId || !vehicleId) {
      setError(
        'Select a policy and vehicle.',
      )

      return
    }

    if (
      !vehicleLocationAtLoss ||
      !lossType ||
      !dateOfLoss ||
      !timeOfLoss ||
      !locationOfLoss ||
      description.length < 10
    ) {
      setError(
        'Please complete all required fields.',
      )

      return
    }

    if (
      vehicleParkedSafely === null ||
      deathOccurred === null
    ) {
      setError(
        'Please answer both questions below.',
      )

      return
    }

    const effectiveToggle =
      lossType === LossType.MinorAccident &&
      instantToggle

    if (
      effectiveToggle &&
      !Object.values(parts).some(Boolean)
    ) {
      setError(
        'Select at least one part for the Instant Claim option.',
      )

      return
    }

    setSubmitting(true)

    try {
      const result =
        await raiseClaimStep1({
          policyId,
          vehicleId,
          vehicleLocationAtLoss,
          lossType,
          dateOfLoss: new Date(
            `${dateOfLoss}T${timeOfLoss}:00`,
          ).toISOString(),
          locationOfLoss,
          description,
          instantClaimToggle:
            effectiveToggle,
          instantClaimParts:
            effectiveToggle
              ? parts
              : null,
          customerEstimatedAmount: null,
        })

      clearRaiseClaimDraft()

      onDone(
        result.claimId,
        result.claimNumber,
        result.message,
        effectiveToggle,
        result.assignedHandlerName,
        {
          vehicleParkedSafely,
          deathOccurred,
        },
        vehicleId,
        lossType,
      )
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Failed to submit claim.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {draftBanner && (
        <div className="draft-restored-banner">
          <span>{draftBanner}</span>
          <button
            type="button"
            onClick={() => {
              clearRaiseClaimDraft()
              setDraftBanner(null)
            }}
          >
            Discard draft
          </button>
        </div>
      )}

      <section className="card card-tint-blue details-strip-card">
        <h2>Your details</h2>

        {loading ? (
          <SkeletonBlock lines={1} />
        ) : policies.length === 0 ? (
          <p className="error-text">
            No policy is on file for your account.
            Please contact support.
          </p>
        ) : (
          <div className="details-strip">
            <div className="details-strip-item details-strip-static">
              <span className="details-strip-label">
                <User size={13} />
                Insured Name
              </span>
              <strong>{displayName || '—'}</strong>
            </div>

            <div className="details-strip-divider" />

            <div className="details-strip-item">
              <label htmlFor="policy">
                <FileText size={13} />
                Policy
              </label>

              <CompactDropdown
                id="policy"
                value={policyId}
                className="policy-details-dropdown"
                onChange={(val) => {
                  const valStr = String(val)
                  setPolicyId(valStr)

                  const p = policies.find((x) => x.policyId === valStr)
                  if (p) {
                    setVehicleId(p.vehicleId)
                  }
                }}
                options={policies.map((p) => ({
                  value: p.policyId,
                  label: p.policyNumber,
                }))}
              />
            </div>

            <div className="details-strip-divider" />

            <div className="details-strip-item details-strip-static">
              <span className="details-strip-label">
                <Car size={13} />
                Vehicle
              </span>
              <strong>
                {selectedVehicle?.registrationNumber ?? '—'}
              </strong>
            </div>

            <div className="details-strip-divider" />

            <div className="details-strip-item details-strip-static">
              <span className="details-strip-label">
                <Wallet size={13} />
                Coverage
              </span>
              <strong>
                {selectedPolicy
                  ? formatCurrency(selectedPolicy.coverageAmount)
                  : '—'}
              </strong>
            </div>
          </div>
        )}
      </section>

      <section className="card card-tint-blue">
        <h2>Incident details</h2>

        <div className="form-field">
          <label htmlFor="vehicleLocation">
            Vehicle location right now <span className="required-asterisk">*</span>
          </label>

          <CompactDropdown
            id="vehicleLocation"
            value={vehicleLocationAtLoss}
            placeholder="Select…"
            className="vehicle-location-dropdown"
            onChange={(val) => setVehicleLocationAtLoss(Number(val))}
            options={Object.entries(VehicleLocationName).map(([value, name]) => ({
              value: Number(value),
              label: name,
            }))}
            required
          />
        </div>

        <div className="form-field">
          <label>Type of Loss <span className="required-asterisk">*</span></label>

          <div className="loss-type-cards">
            {Object.entries(
              LossTypeName,
            ).map(([value, name]) => {
              const iconData =
                LOSS_TYPE_ICONS[
                  Number(value)
                ]

              if (!iconData) {
                return null
              }

              const { Icon, tone } =
                iconData

              const isSelected =
                lossType === Number(value)

              return (
                <div
                  key={value}
                  className={`loss-type-card ${
                    isSelected
                      ? 'selected'
                      : ''
                  }`}
                  onClick={() => {
                    setLossType(
                      Number(value),
                    )

                    if (
                      Number(value) !==
                      LossType.MinorAccident
                    ) {
                      setInstantToggle(
                        false,
                      )
                    }
                  }}
                >
                  {isSelected && (
                    <CheckCircle2
                      size={16}
                      className="loss-type-card-check"
                    />
                  )}

                  <span
                    className={`loss-type-card-icon loss-type-card-icon-${tone}`}
                  >
                    <Icon size={20} />
                  </span>

                  {name}
                </div>
              )
            })}
          </div>
        </div>

        <div className="form-row loss-datetime-location-row">
          <div className="form-field">
            <label htmlFor="lossDateTime">
              Date & Time of Loss <span className="required-asterisk">*</span>
            </label>

            <ModernDateTimePicker
              id="lossDateTime"
              date={dateOfLoss}
              time={timeOfLoss}
              onDateChange={setDateOfLoss}
              onTimeChange={setTimeOfLoss}
              maxDate={today}
              minDate={minDate}
              required
            />
          </div>

          <div className="form-field location-autocomplete-wrap">
            <label htmlFor="locationOfLoss">
              Location of Loss <span className="required-asterisk">*</span>
            </label>

            <input
              id="locationOfLoss"
              value={locationOfLoss}
              placeholder="City or area (e.g. Chennai)"
              onChange={(e) => {
                setLocationOfLoss(e.target.value)
                setShowLocationSuggestions(true)
              }}
              onFocus={() => setShowLocationSuggestions(true)}
              onBlur={() =>
                setTimeout(() => setShowLocationSuggestions(false), 120)
              }
              autoComplete="off"
              required
            />

            {showLocationSuggestions && locationSuggestions.length > 0 && (
              <ul className="location-suggestions">
                {locationSuggestions.map((city) => (
                  <li key={city}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setLocationOfLoss(city)
                        setShowLocationSuggestions(false)
                      }}
                    >
                      {city}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="description">
            Loss Description <span className="required-asterisk">*</span>
          </label>

          <div
            style={{
              display: 'flex',
              gap: '0.6rem',
              alignItems:
                'flex-start',
            }}
          >
            <textarea
              id="description"
              value={description}
              onChange={(e) =>
                setDescription(
                  e.target.value,
                )
              }
              rows={4}
              required
              minLength={10}
              style={{ flex: 1 }}
            />

            <button
              type="button"
              className={`mic-button ${
                listening
                  ? 'listening'
                  : ''
              }`}
              onClick={handleMic}
              title="Speak your description"
            >
              <Mic size={19} />
            </button>
          </div>

          {voiceUnsupported && (
            <p className="error-text">
              Voice input isn't supported in
              this browser. Please type your
              description.
            </p>
          )}

          {description.length > 0 &&
            description.length < 10 && (
              <p className="error-text">
                Please provide a bit more detail
                (at least 10 characters).
              </p>
            )}
        </div>

        {lossType ===
          LossType.MinorAccident && (
          <motion.div
            className="instant-claim-toggle-row instant-claim-toggle-highlight"
            initial={{
              opacity: 0,
              scale: 0.96,
            }}
            animate={{
              opacity: 1,
              scale: 1,
            }}
            transition={{
              duration: 0.35,
              ease: 'easeOut',
            }}
          >
            <button
              type="button"
              className={`toggle-switch ${
                instantToggle
                  ? 'on'
                  : ''
              }`}
              onClick={() =>
                setInstantToggle(
                  (v) => !v,
                )
              }
              aria-pressed={
                instantToggle
              }
            >
              <span
                className="toggle-switch-knob"
                style={{
                  transform:
                    instantToggle
                      ? 'translateX(1.4rem)'
                      : 'translateX(0)',
                }}
              />
            </button>

            <span>
              Try for an Instant Claim
            </span>
          </motion.div>
        )}

        {instantToggle &&
          lossType ===
            LossType.MinorAccident && (
            <div className="instant-parts-checkboxes">
              {(
                [
                  [
                    'windshieldFront',
                    'Windshield — Front',
                  ],
                  [
                    'windshieldRear',
                    'Windshield — Rear',
                  ],
                  [
                    'glass',
                    'Glass (other than windshield)',
                  ],
                  [
                    'tyre',
                    'Tyre',
                  ],
                ] as const
              ).map(
                ([key, label]) => (
                  <label
                    key={key}
                    className={`instant-part-checkbox ${
                      parts[key]
                        ? 'checked'
                        : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={
                        parts[key]
                      }
                      onChange={(e) =>
                        setParts(
                          (p) => ({
                            ...p,
                            [key]:
                              e.target
                                .checked,
                          }),
                        )
                      }
                    />

                    {label}
                  </label>
                ),
              )}
            </div>
          )}
      </section>

      <section className="card card-tint-blue quick-questions-card">
        <h2>
          <HelpCircle
            size={16}
            style={{
              verticalAlign: '-3px',
              marginRight: '0.4rem',
            }}
          />
          A couple of quick questions
        </h2>

        <div className="quick-question-row">
          <label>
            Is the vehicle parked? <span className="required-asterisk">*</span>
          </label>

          <div className="radio-pill-group">
            <label className="radio-pill">
              <input
                type="radio"
                name="parked"
                checked={vehicleParkedSafely === true}
                onChange={() => setVehicleParkedSafely(true)}
              />
              Yes
            </label>

            <label className="radio-pill">
              <input
                type="radio"
                name="parked"
                checked={vehicleParkedSafely === false}
                onChange={() => setVehicleParkedSafely(false)}
              />
              No
            </label>
          </div>
        </div>

        <div className="quick-question-row">
          <label>
            Any injuries occurred? <span className="required-asterisk">*</span>
          </label>

          <div className="radio-pill-group">
            <label className="radio-pill">
              <input
                type="radio"
                name="death"
                checked={deathOccurred === true}
                onChange={() => setDeathOccurred(true)}
              />
              Yes
            </label>

            <label className="radio-pill">
              <input
                type="radio"
                name="death"
                checked={deathOccurred === false}
                onChange={() => setDeathOccurred(false)}
              />
              No
            </label>
          </div>
        </div>

        {error && (
          <p className="error-text">
            {error}
          </p>
        )}

        <div className="raise-claim-step1-actions">
          <button
            type="button"
            className="raise-claim-draft-button"
            onClick={handleSaveDraft}
            disabled={submitting || loading}
          >
            Save draft
          </button>

          <button
            type="submit"
            disabled={
              submitting || loading
            }
          >
            {submitting
              ? 'Submitting…'
              : 'Next'}
          </button>
        </div>
      </section>
    </form>
  )
}

// =====================================================================
// STEP 2 - Documents & Confirmatory Checks
// =====================================================================

function Step2({
  claimId,
  claimNumber,
  vehicleId,
  lossType,
  answers,
  onVerified,
  onRouted,
}: {
  claimId: string
  claimNumber: string
  vehicleId: string
  lossType: number
  answers: { vehicleParkedSafely: boolean; deathOccurred: boolean }
  onVerified: () => void
  onRouted: (message: string) => void
}) {
  const [uploaded, setUploaded] =
    useState<Record<number, boolean>>({})

  const [rcOcr, setRcOcr] =
    useState<OcrExtractionResult | null>(null)

  const [plateOcr, setPlateOcr] =
    useState<OcrExtractionResult | null>(null)

  const [showCaptureModal, setShowCaptureModal] =
    useState(false)

  const [reviewing, setReviewing] =
    useState(false)

  const [error, setError] =
    useState<string | null>(null)

  // The correct fallback for a failed OCR read is "what's already on
  // file for THIS vehicle" - a hardcoded placeholder from an earlier
  // test vehicle will mismatch as soon as a different vehicle is used
  // (exactly the bug reported: chassis/engine shown didn't match the
  // real CHASSIS.../ENGINE... numbers for this vehicle).
  const [vehicleRecord, setVehicleRecord] =
    useState<VehicleResponseDto | null>(null)

  useEffect(() => {
    let cancelled = false

    getVehicleById(vehicleId)
      .then((data) => {
        if (!cancelled) setVehicleRecord(data)
      })
      .catch(() => {
        // Falls through to "Not detected" below if this fails too.
      })

    return () => {
      cancelled = true
    }
  }, [vehicleId])

  const [extractingOcr, setExtractingOcr] =
    useState(false)

  const [frontDocId, setFrontDocId] =
    useState<string | null>(null)

  const [rcDocId, setRcDocId] =
    useState<string | null>(null)

  // FIR is only required for loss types other than a minor accident
  // (theft, major accident, fire, natural calamities, etc.) - a
  // minor accident claim has nothing to file a police report about.
  const requiresFir = lossType !== LossType.MinorAccident

  const requiredTypeIds = requiresFir
    ? [1, 2, 3, 4, DocumentType.RegistrationCertificate, DocumentType.FirDocument]
    : [1, 2, 3, 4, DocumentType.RegistrationCertificate]

  const allUploaded = requiredTypeIds.every((typeId) => uploaded[typeId])

  const requiredCount = requiredTypeIds.length

  const uploadedCount = requiredTypeIds.filter((typeId) => uploaded[typeId]).length

  // Registered details from database for this vehicle
  const dbRcNo = vehicleRecord?.registrationNumber || '—'
  const dbEngineNo = vehicleRecord?.engineNumber || '—'
  const dbChassisNo = vehicleRecord?.chassisNumber || '—'

  // Actual values extracted from uploaded photos & RC
  const isPlausibleIdNumber = (
    value: string | null | undefined,
    minDigits: number,
  ) => {
    if (!value) return false
    const digitCount = (value.match(/[0-9]/g) ?? []).length
    return digitCount >= minDigits
  }

  const extractedPlateNo = isPlausibleIdNumber(plateOcr?.registrationNumber, 4)
    ? plateOcr!.registrationNumber!
    : null

  const extractedRcNo = isPlausibleIdNumber(rcOcr?.registrationNumber, 4)
    ? rcOcr!.registrationNumber!
    : null

  const extractedChassisNo = rcOcr?.chassisNumber && rcOcr.chassisNumber.length >= 6
    ? rcOcr.chassisNumber
    : null

  const extractedEngineNo = rcOcr?.engineNumber && rcOcr.engineNumber.length >= 4
    ? rcOcr.engineNumber
    : null

  // Clean comparison helper
  const cleanStr = (s?: string | null) => s?.toUpperCase().replace(/[^A-Z0-9]/g, '') || ''

  const isFieldMatch = (dbVal: string, extVal: string | null): boolean | null => {
    if (!extVal) return null // not detected
    const a = cleanStr(dbVal)
    const b = cleanStr(extVal)
    if (!a || !b) return null
    if (a === b) return true

    // Substring / Prefix match: handles OCR trailing noise e.g. D4FALM158370EP1 or MALFC81DLMM17654118
    if (a.length >= 5 && b.length >= 5) {
      if (b.startsWith(a) || a.startsWith(b) || b.includes(a) || a.includes(b)) {
        return true
      }
    }

    if (Math.abs(a.length - b.length) <= 1) {
      const minLen = Math.min(a.length, b.length)
      let diff = Math.abs(a.length - b.length)
      for (let i = 0; i < minLen; i++) {
        if (a[i] !== b[i]) diff++
        if (diff > 1) return false
      }
      return diff <= 1
    }
    return false
  }

  const plateMatched = isFieldMatch(dbRcNo, extractedPlateNo)
  const rcMatched = isFieldMatch(dbRcNo, extractedRcNo)
  const engineMatched = isFieldMatch(dbEngineNo, extractedEngineNo)
  const chassisMatched = isFieldMatch(dbChassisNo, extractedChassisNo)

  // Any explicit mismatch disqualifies fast-track settlement
  const hasExplicitMismatch = Boolean(
    rcMatched === false ||
    plateMatched === false ||
    engineMatched === false ||
    chassisMatched === false
  )

  // Eligible for instant fast track only if no mismatches exist and RC or plate matched
  const isOverallMatched = Boolean(
    !hasExplicitMismatch && (rcMatched === true || plateMatched === true)
  )

  const renderStatusPill = (status: boolean | null) => {
    if (status === null) {
      return (
        <span className="ocr-status-pill ocr-status-neutral">
          <HelpCircle size={11} /> Not Detected
        </span>
      )
    }
    if (status === true) {
      return (
        <span className="ocr-status-pill ocr-status-matched">
          <CheckCircle2 size={11} /> Matched
        </span>
      )
    }
    return (
      <span className="ocr-status-pill ocr-status-mismatched">
        <AlertTriangle size={11} /> Mismatch
      </span>
    )
  }

  const handleContinueClick = async () => {
    if (!allUploaded) {
      setError(
        `Please upload all ${requiredCount} required documents before continuing.`,
      )

      return
    }

    setError(null)

    // If OCR is still in progress or hasn't completed yet, finalize preview before opening modal
    if ((!plateOcr && frontDocId) || (!rcOcr && rcDocId)) {
      setExtractingOcr(true)
      try {
        const promises: Promise<unknown>[] = []

        if (!plateOcr && frontDocId) {
          promises.push(
            getDocumentOcrPreview(frontDocId)
              .then((res) => {
                if (res) setPlateOcr(res)
              })
              .catch(() => null),
          )
        }

        if (!rcOcr && rcDocId) {
          promises.push(
            getDocumentOcrPreview(rcDocId)
              .then((res) => {
                if (res) setRcOcr(res)
              })
              .catch(() => null),
          )
        }

        if (promises.length > 0) {
          await Promise.all(promises)
        }
      } finally {
        setExtractingOcr(false)
      }
    }

    setShowCaptureModal(true)
  }

  const handleConfirmAndVerify = async () => {
    setShowCaptureModal(false)
    setReviewing(true)

    // Only update vehicle chassis/engine if vehicle details actually matched
    if (isOverallMatched && (extractedChassisNo || extractedEngineNo)) {
      try {
        await confirmVehicleOcrDetails(vehicleId, {
          chassisNumber: extractedChassisNo,
          engineNumber: extractedEngineNo,
        })
      } catch {
        // Non-critical.
      }
    }

    try {
      const result =
        await raiseClaimStep2(
          claimId,
          answers,
        )

      if (result.routedToSurveyor) {
        onRouted(result.message)
      } else {
        onVerified()
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setError(err.message)
      } else {
        onVerified()
      }
    } finally {
      setReviewing(false)
    }
  }

  const vehiclePhotoSlots: [number, string][] = [
    [1, 'Vehicle photo — Front'],
    [2, 'Vehicle photo — Left'],
    [3, 'Vehicle photo — Back'],
    [4, 'Vehicle photo — Right'],
  ]

  const markUploaded = (typeId: number) =>
    setUploaded((u) => ({ ...u, [typeId]: true }))

  return (
    <div>
      <section className="card card-tint-blue">
        <h2>
          <FileText
            size={17}
            style={{
              verticalAlign: '-3px',
              marginRight: '0.4rem',
            }}
          />

          {claimNumber} — Documents

          <span className="upload-count-pill">
            {uploadedCount}/{requiredCount} uploaded
          </span>
        </h2>

        <div className="upload-grid">
          {vehiclePhotoSlots.map(
            ([typeId, label]) => (
              <UploadCard
                key={typeId}
                label={label}
                claimId={claimId}
                documentTypeId={typeId}
                onUploaded={(doc) => {
                  markUploaded(typeId)
                  if (typeId === 1) setFrontDocId(doc.claimDocumentId)
                }}
                extractOcr={typeId === 1}
                onOcrExtracted={
                  typeId === 1
                    ? (res) => {
                        if (res) setPlateOcr(res)
                      }
                    : undefined
                }
              />
            ),
          )}

          <UploadCard
            label="RC document"
            claimId={claimId}
            documentTypeId={DocumentType.RegistrationCertificate}
            onUploaded={(doc) => {
              markUploaded(DocumentType.RegistrationCertificate)
              setRcDocId(doc.claimDocumentId)
            }}
            extractOcr
            onOcrExtracted={(res) => {
              if (res) setRcOcr(res)
            }}
          />

          {requiresFir && (
            <UploadCard
              label="FIR document"
              claimId={claimId}
              documentTypeId={DocumentType.FirDocument}
              onUploaded={() => markUploaded(DocumentType.FirDocument)}
            />
          )}

          <UploadCard
            label="Driving licence (optional)"
            claimId={claimId}
            documentTypeId={DocumentType.DrivingLicense}
            onUploaded={() => {}}
          />
        </div>

        {error && (
          <p className="error-text">
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={reviewing || showCaptureModal || extractingOcr}
          onClick={() => void handleContinueClick()}
        >
          Continue
        </button>
      </section>

      <Modal open={extractingOcr}>
        <div className="processing-modal-content">
          <motion.div
            className="processing-modal-spinner"
            animate={{ rotate: 360 }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
          >
            <Loader2 size={30} />
          </motion.div>

          <p>
            Extracting vehicle number plate, engine, and chassis details from your documents…
          </p>
        </div>
      </Modal>

      <Modal
        open={showCaptureModal}
        onClose={() => setShowCaptureModal(false)}
        title={isOverallMatched ? 'RC Verification & Fast-Track Eligibility' : 'Verification Mismatch Detected'}
        wide
      >
        <div className="ocr-verification-modal">
          {isOverallMatched ? (
            <div className="ocr-fasttrack-card">
              <div className="ocr-fasttrack-icon">
                <ShieldCheck size={26} />
              </div>
              <div className="ocr-fasttrack-details">
                <div className="ocr-fasttrack-badge">
                  <Zap size={11} fill="currentColor" />
                  <span>Fast-Track Claim Eligible</span>
                </div>
                <h3 className="ocr-fasttrack-title">
                  Data from Database &amp; Extracted Plate/RC Matched!
                </h3>
                <p className="ocr-fasttrack-desc">
                  Your uploaded vehicle photo and RC document details match the registered policy records. You are eligible for <strong>Instant 30-Min Fast-Track Claim</strong> settlement.
                </p>
              </div>
            </div>
          ) : (
            <div className="ocr-fasttrack-card ocr-fasttrack-card-mismatch">
              <div className="ocr-fasttrack-icon ocr-fasttrack-icon-mismatch">
                <AlertTriangle size={26} />
              </div>
              <div className="ocr-fasttrack-details">
                <div className="ocr-fasttrack-badge ocr-fasttrack-badge-mismatch">
                  <AlertTriangle size={11} />
                  <span>Verification Mismatch</span>
                </div>
                <h3 className="ocr-fasttrack-title">
                  Vehicle Details Do Not Match Registered Policy
                </h3>
                <p className="ocr-fasttrack-desc">
                  The uploaded vehicle / RC details ({extractedRcNo || extractedPlateNo || 'Unknown'}) do not match the registered vehicle record ({dbRcNo}). Per policy rules, this claim must be routed to a Surveyor for manual inspection.
                </p>
              </div>
            </div>
          )}

          <div className="ocr-comparison-wrapper">
            <div className="ocr-comparison-header-row">
              <span className="ocr-comp-header-label">Field</span>
              <span className="ocr-comp-header-col ocr-comp-db">
                <Database size={12} /> Registered in DB
              </span>
              <span className="ocr-comp-header-col ocr-comp-ocr">
                <ScanLine size={12} /> Extracted Value
              </span>
              <span className="ocr-comp-header-status">Status</span>
            </div>

            <div className="ocr-comparison-rows">
              {/* Row 1: Number Plate */}
              <div className="ocr-comparison-row">
                <div className="ocr-row-mobile-header">
                  <span className="ocr-row-label">Number Plate</span>
                  {renderStatusPill(plateMatched)}
                </div>
                <div className="ocr-row-desktop-label">
                  <strong>Number Plate</strong>
                </div>
                <div className="ocr-row-val ocr-val-db font-mono">
                  <span className="ocr-mobile-tag"><Database size={10} /> DB:</span>
                  {dbRcNo}
                </div>
                <div className="ocr-row-val ocr-val-ocr font-mono">
                  <span className="ocr-mobile-tag"><ScanLine size={10} /> Plate:</span>
                  {extractedPlateNo || 'Not detected in photo'}
                </div>
                <div className="ocr-row-desktop-status">
                  {renderStatusPill(plateMatched)}
                </div>
              </div>

              {/* Row 2: RC Number */}
              <div className="ocr-comparison-row">
                <div className="ocr-row-mobile-header">
                  <span className="ocr-row-label">RC Number</span>
                  {renderStatusPill(rcMatched)}
                </div>
                <div className="ocr-row-desktop-label">
                  <strong>RC Number</strong>
                </div>
                <div className="ocr-row-val ocr-val-db font-mono">
                  <span className="ocr-mobile-tag"><Database size={10} /> DB:</span>
                  {dbRcNo}
                </div>
                <div className="ocr-row-val ocr-val-ocr font-mono">
                  <span className="ocr-mobile-tag"><ScanLine size={10} /> RC:</span>
                  {extractedRcNo || 'Not detected in RC'}
                </div>
                <div className="ocr-row-desktop-status">
                  {renderStatusPill(rcMatched)}
                </div>
              </div>

              {/* Row 3: Engine Number */}
              <div className="ocr-comparison-row">
                <div className="ocr-row-mobile-header">
                  <span className="ocr-row-label">Engine Number</span>
                  {renderStatusPill(engineMatched)}
                </div>
                <div className="ocr-row-desktop-label">
                  <strong>Engine Number</strong>
                </div>
                <div className="ocr-row-val ocr-val-db font-mono">
                  <span className="ocr-mobile-tag"><Database size={10} /> DB:</span>
                  {dbEngineNo}
                </div>
                <div className="ocr-row-val ocr-val-ocr font-mono">
                  <span className="ocr-mobile-tag"><ScanLine size={10} /> RC:</span>
                  {extractedEngineNo || 'Not detected in RC'}
                </div>
                <div className="ocr-row-desktop-status">
                  {renderStatusPill(engineMatched)}
                </div>
              </div>

              {/* Row 4: Chassis Number */}
              <div className="ocr-comparison-row">
                <div className="ocr-row-mobile-header">
                  <span className="ocr-row-label">Chassis Number</span>
                  {renderStatusPill(chassisMatched)}
                </div>
                <div className="ocr-row-desktop-label">
                  <strong>Chassis Number</strong>
                </div>
                <div className="ocr-row-val ocr-val-db font-mono">
                  <span className="ocr-mobile-tag"><Database size={10} /> DB:</span>
                  {dbChassisNo}
                </div>
                <div className="ocr-row-val ocr-val-ocr font-mono">
                  <span className="ocr-mobile-tag"><ScanLine size={10} /> RC:</span>
                  {extractedChassisNo || 'Not detected in RC'}
                </div>
                <div className="ocr-row-desktop-status">
                  {renderStatusPill(chassisMatched)}
                </div>
              </div>
            </div>
          </div>

          {isOverallMatched ? (
            <button
              type="button"
              className="ocr-confirm-btn"
              disabled={reviewing}
              onClick={() => void handleConfirmAndVerify()}
            >
              <span>Confirm &amp; Proceed to Fast-Track</span>
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              className="ocr-confirm-btn ocr-route-btn"
              disabled={reviewing}
              onClick={() => void handleConfirmAndVerify()}
            >
              <AlertTriangle size={16} />
              <span>Route to Surveyor for Assessment</span>
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      </Modal>

      <Modal open={reviewing}>
        <div className="processing-modal-content">
          <motion.div
            className="processing-modal-spinner"
            animate={{ rotate: 360 }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
          >
            <Loader2 size={30} />
          </motion.div>

          <p>
            Thank you for your patience — our smart assistant
            is verifying your documents and images.
          </p>
        </div>
      </Modal>
    </div>
  )
}

// =====================================================================
// STEP 3 - Review, Estimate & Decision
// =====================================================================

function Step3({
  claimId,
  claimNumber,
  onDone,
  onRouted,
}: {
  claimId: string
  claimNumber: string
  onDone: (message: string) => void
  onRouted: (message: string) => void
}) {
  const { session } = useAuth()
  const [
    loadingEstimate,
    setLoadingEstimate,
  ] = useState(true)

  const [estimate, setEstimate] =
    useState<ClaimEstimateResultDto | null>(
      null,
    )

  const [
    notEligibleReason,
    setNotEligibleReason,
  ] = useState<string | null>(null)

  const [error, setError] =
    useState<string | null>(null)

  const [
    showRazorpayModal,
    setShowRazorpayModal,
  ] = useState(false)

  useEffect(() => {
    let cancelled = false

    generateEstimate(claimId)
      .then((result) => {
        if (cancelled) return

        if (result.eligible) {
          setEstimate({
            ...result,
            claimId,
          })
        } else {
          setNotEligibleReason(
            result.reason,
          )
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : 'Failed to generate estimate.',
          )
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingEstimate(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [claimId])

  const handleRouteToSurveyor =
    async () => {
      try {
        const result =
          await declineInstantClaim(
            claimId,
          )

        onRouted(result.message)
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Failed to route claim.',
        )
      }
    }

  const calculatedNetAmount = estimate
    ? (estimate.lineItems.removeRefitCharge || 0) +
      (estimate.lineItems.dentingCharge || 0) +
      (estimate.lineItems.paintingCharge || 0) +
      (estimate.lineItems.totalLabourCharges || 0) +
      (estimate.lineItems.totalPartsAmount || 0) -
      (estimate.lineItems.policyExcess || 0) -
      (estimate.lineItems.salvageAmount || 0) -
      (estimate.lineItems.otherDeductions || 0)
    : 0

  return (
    <div>
      <section className="claim-reference-banner">
        <div>
          <span>Claim Number</span>

          <strong>
            {claimNumber}
          </strong>
        </div>

        <div className="claim-reference-status">
          <CheckCircle2 size={18} />
          Assessment in progress
        </div>
      </section>

      {loadingEstimate && (
        <section className="card">
          <div className="reviewing-banner">
            <span className="spinner" />
            Generating your assessment…
          </div>
        </section>
      )}

      {!loadingEstimate &&
        notEligibleReason && (
          <section className="card">
            <h2>
              This claim will go to a
              Surveyor
            </h2>

            <p>
              This claim doesn't qualify
              for Instant Claim right now
              ({' '}
              {notEligibleReason}
              ). It has been submitted for
              standard assessment and you'll
              be notified once a Surveyor
              has been assigned.
            </p>
          </section>
        )}

      {!loadingEstimate &&
        !estimate &&
        !notEligibleReason &&
        error && (
          <section className="card">
            <h2>
              Couldn't generate your
              estimate
            </h2>

            <p className="error-text">
              {error}
            </p>
          </section>
        )}

      {!loadingEstimate &&
        estimate && (
          <section className="card card-tint-blue">
            <h2>
              <Wallet
                size={17}
                style={{
                  verticalAlign: '-3px',
                  marginRight:
                    '0.4rem',
                }}
              />

              Smart Assessment Summary
            </h2>

            <div className="smart-assessment-box">
              <h3>
                Smart Assistant Assessment
              </h3>

              <p>
                Based on the documents
                and pictures submitted,
                our Smart Assistant has
                calculated an estimated
                payable amount of{' '}
                <strong style={{ whiteSpace: 'nowrap' }}>
                  {formatCurrency(
                    calculatedNetAmount,
                  )}
                </strong>
                .
              </p>

              <p>
                By accepting this amount,
                the approved amount will be
                disbursed into your bank
                account. If you do not
                accept the assessment, your
                claim will be immediately
                routed to our Surveyor for
                further action.
              </p>
            </div>

            <h3 className="assessment-subheading">
              Assessment cost breakdown
            </h3>

            <table className="estimate-breakdown">
              <tbody>
                <tr>
                  <td>
                    Remove &amp; Refit Charges
                  </td>

                  <td style={{ whiteSpace: 'nowrap' }}>
                    {formatCurrency(
                      estimate.lineItems
                        .removeRefitCharge,
                    )}
                  </td>
                </tr>

                <tr>
                  <td>
                    Denting Charges
                  </td>

                  <td style={{ whiteSpace: 'nowrap' }}>
                    {formatCurrency(
                      estimate.lineItems
                        .dentingCharge,
                    )}
                  </td>
                </tr>

                <tr>
                  <td>
                    Painting Charges
                  </td>

                  <td style={{ whiteSpace: 'nowrap' }}>
                    {formatCurrency(
                      estimate.lineItems
                        .paintingCharge,
                    )}
                  </td>
                </tr>

                <tr>
                  <td>
                    Total Labour Charges
                  </td>

                  <td style={{ whiteSpace: 'nowrap' }}>
                    {formatCurrency(
                      estimate.lineItems
                        .totalLabourCharges,
                    )}
                  </td>
                </tr>

                <tr>
                  <td>
                    Total Parts Amount
                  </td>

                  <td style={{ whiteSpace: 'nowrap' }}>
                    {formatCurrency(
                      estimate.lineItems
                        .totalPartsAmount,
                    )}
                  </td>
                </tr>

                <tr>
                  <td>
                    Policy Excess
                  </td>

                  <td style={{ whiteSpace: 'nowrap' }}>
                    −{formatCurrency(
                      estimate.lineItems
                        .policyExcess,
                    )}
                  </td>
                </tr>

                <tr>
                  <td>
                    Salvage Amount
                  </td>

                  <td style={{ whiteSpace: 'nowrap' }}>
                    −{formatCurrency(
                      estimate.lineItems
                        .salvageAmount,
                    )}
                  </td>
                </tr>

                <tr>
                  <td>
                    Other Deductions
                  </td>

                  <td style={{ whiteSpace: 'nowrap' }}>
                    −{formatCurrency(
                      estimate.lineItems
                        .otherDeductions,
                    )}
                  </td>
                </tr>

                <tr className="net-total">
                  <td>
                    Net Assessment Amount
                  </td>

                  <td style={{ whiteSpace: 'nowrap' }}>
                    {formatCurrency(
                      calculatedNetAmount,
                    )}
                  </td>
                </tr>
              </tbody>
            </table>

            {error && (
              <p className="error-text">
                {error}
              </p>
            )}

            <div className="assessment-actions">
              <button
                type="button"
                className="assessment-accept-button"
                onClick={() => setShowRazorpayModal(true)}
              >
                <Check size={18} />
                Accept &amp; Continue
              </button>

              <button
                type="button"
                className="assessment-surveyor-button"
                onClick={() =>
                  void handleRouteToSurveyor()
                }
              >
                <AlertTriangle size={18} />
                Route to Surveyor
              </button>
            </div>
          </section>
        )}

      <RazorpayModal
        isOpen={showRazorpayModal}
        onClose={() => setShowRazorpayModal(false)}
        amount={calculatedNetAmount}
        claimNumber={claimNumber}
        claimId={claimId}
        customerName={session?.user?.user_metadata?.first_name || 'Claimant'}
        customerPhone={session?.user?.phone || '9876543210'}
        isPayout={true}
        onSuccess={async (_result: RazorpayPaymentResult) => {
          try {
            await acceptInstantClaim(claimId)
          } catch (err) {
            console.error('Accept claim API error:', err)
          }
        }}
        onFinish={() => {
          setShowRazorpayModal(false)
          onDone('Claim amount successfully credited to your bank account via RazorpayX Instant Disbursal.')
        }}
      />
    </div>
  )
}
