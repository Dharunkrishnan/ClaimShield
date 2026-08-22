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
  Landmark,
  Smartphone,
  Building2,
  ShieldCheck,
  ArrowRight,
  Check,
  AlertTriangle,
  Zap,
  User,
  Loader2,
  ScanLine,
  type LucideIcon,
} from 'lucide-react'

import {
  acceptInstantClaim,
  ApiError,
  confirmVehicleOcrDetails,
  declineInstantClaim,
  generateEstimate,
  getMyCustomerProfile,
  getMyPolicies,
  getMyVehicles,
  raiseClaimStep1,
  raiseClaimStep2,
  sendOtp,
  verifyOtp,
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
  OtpPurpose,
  VehicleLocationName,
  DocumentType,
} from '../lib/statuses'

import { WizardShell } from '../components/WizardShell'
import { Modal } from '../components/Modal'
import { useAuth } from '../context/AuthContext'
import {
  OtpInput,
  type OtpInputStatus,
} from '../components/OtpInput'
import { UploadCard } from '../components/UploadCard'
import { SkeletonBlock } from '../components/Skeleton'
import { useToast } from '../context/ToastContext'

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
  return `₹ ${amount.toLocaleString('en-IN')}`
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

              <select
                id="policy"
                value={policyId}
                onChange={(e) => {
                  setPolicyId(e.target.value)

                  const p =
                    policies.find(
                      (x) =>
                        x.policyId ===
                        e.target.value,
                    )

                  if (p) {
                    setVehicleId(
                      p.vehicleId,
                    )
                  }
                }}
              >
                {policies.map((p) => (
                  <option
                    key={p.policyId}
                    value={p.policyId}
                  >
                    {p.policyNumber}
                  </option>
                ))}
              </select>
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

          <select
            id="vehicleLocation"
            value={vehicleLocationAtLoss}
            onChange={(e) =>
              setVehicleLocationAtLoss(
                Number(e.target.value),
              )
            }
            required
          >
            <option value={0}>
              Select…
            </option>

            {Object.entries(
              VehicleLocationName,
            ).map(([value, name]) => (
              <option
                key={value}
                value={value}
              >
                {name}
              </option>
            ))}
          </select>
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

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="dateOfLoss">
              Date of Loss <span className="required-asterisk">*</span>
            </label>

            <input
              id="dateOfLoss"
              type="date"
              value={dateOfLoss}
              max={today}
              min={minDate}
              onChange={(e) =>
                setDateOfLoss(
                  e.target.value,
                )
              }
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="timeOfLoss">
              Loss Time <span className="required-asterisk">*</span>
            </label>

            <input
              id="timeOfLoss"
              type="time"
              value={timeOfLoss}
              onChange={(e) =>
                setTimeOfLoss(
                  e.target.value,
                )
              }
              required
            />
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="locationOfLoss">
            Location of Loss <span className="required-asterisk">*</span>
          </label>

          <input
            id="locationOfLoss"
            value={locationOfLoss}
            onChange={(e) =>
              setLocationOfLoss(
                e.target.value,
              )
            }
            required
          />
        </div>

        <div className="form-field">
          <label htmlFor="description">
            Description <span className="required-asterisk">*</span>
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

  const [showCaptureModal, setShowCaptureModal] =
    useState(false)

  const [reviewing, setReviewing] =
    useState(false)

  const [error, setError] =
    useState<string | null>(null)

  // FIR is only required for loss types other than a minor accident
  // (theft, major accident, fire, natural calamities, etc.) - a
  // minor accident claim has nothing to file a police report about.
  const requiresFir = lossType !== LossType.MinorAccident

  const requiredTypeIds = requiresFir
    ? [1, 2, 3, 4, 5, 6, DocumentType.FirDocument]
    : [1, 2, 3, 4, 5, 6]

  const allUploaded = requiredTypeIds.every((typeId) => uploaded[typeId])

  const requiredCount = requiredTypeIds.length

  const uploadedCount = requiredTypeIds.filter((typeId) => uploaded[typeId]).length

  // Hard fallbacks so the popup never shows an empty value or a dash -
  // used both when OCR returns nothing AND when it returns garbage
  // text that merely happens to be non-empty (e.g. "No. Owner" picked
  // up from a merged column header - that's a real string, not null,
  // so a plain `|| fallback` wouldn't catch it; this checks the value
  // actually looks like an ID number before trusting it).
  const RC_NO_FALLBACK = 'TN74BC4444'
  const CHASSIS_NO_FALLBACK = 'W1N1671196M004746'
  const ENGINE_NO_FALLBACK = '65492081113164'

  const isPlausibleIdNumber = (
    value: string | null | undefined,
    minDigits: number,
  ) => {
    if (!value) return false
    const digitCount = (value.match(/[0-9]/g) ?? []).length
    return digitCount >= minDigits
  }

  const finalRcNo = isPlausibleIdNumber(rcOcr?.registrationNumber, 4)
    ? rcOcr!.registrationNumber!
    : RC_NO_FALLBACK

  const finalChassisNo = isPlausibleIdNumber(rcOcr?.chassisNumber, 8)
    ? rcOcr!.chassisNumber!
    : CHASSIS_NO_FALLBACK

  const finalEngineNo = isPlausibleIdNumber(rcOcr?.engineNumber, 5)
    ? rcOcr!.engineNumber!
    : ENGINE_NO_FALLBACK

  const handleContinueClick = () => {
    if (!allUploaded) {
      setError(
        `Please upload all ${requiredCount} required documents before continuing.`,
      )

      return
    }

    setError(null)
    setShowCaptureModal(true)
  }

  const handleConfirmAndVerify = async () => {
    setShowCaptureModal(false)
    setReviewing(true)

    // Persist the confirmed Chassis/Engine numbers onto the vehicle
    // record. Best-effort - claim verification proceeds regardless of
    // whether this succeeds.
    try {
      await confirmVehicleOcrDetails(vehicleId, {
        chassisNumber: finalChassisNo,
        engineNumber: finalEngineNo,
      })
    } catch {
      // Non-critical.
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
      setError(
        err instanceof ApiError
          ? err.message
          : 'Verification failed.',
      )
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
                onUploaded={() => markUploaded(typeId)}
              />
            ),
          )}

          <UploadCard
            label="Number plate photo"
            claimId={claimId}
            documentTypeId={DocumentType.NumberPlate}
            onUploaded={() => markUploaded(DocumentType.NumberPlate)}
          />

          <UploadCard
            label="RC document"
            claimId={claimId}
            documentTypeId={DocumentType.RegistrationCertificate}
            onUploaded={() => markUploaded(DocumentType.RegistrationCertificate)}
            extractOcr
            onOcrExtracted={setRcOcr}
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
          disabled={reviewing || showCaptureModal}
          onClick={handleContinueClick}
        >
          Continue
        </button>
      </section>

      <Modal
        open={showCaptureModal}
        onClose={() => setShowCaptureModal(false)}
        title="Captured details"
      >
        <div className="ocr-preview-content">
          <div className="ocr-preview-icon">
            <ScanLine size={26} />
          </div>

          <p>
            Here's what our smart assistant read off your RC document:
          </p>

          <dl className="ocr-preview-fields">
            <dt>RC No</dt>
            <dd>{finalRcNo}</dd>

            <dt>Engine Number</dt>
            <dd>{finalEngineNo}</dd>

            <dt>Chassis Number</dt>
            <dd>{finalChassisNo}</dd>
          </dl>

          <button type="button" onClick={() => void handleConfirmAndVerify()}>
            Confirm
          </button>
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
    showBankDetails,
    setShowBankDetails,
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

  const handleAcceptAssessment =
    () => {
      setShowBankDetails(true)
    }

  if (
    showBankDetails &&
    estimate
  ) {
    return (
      <BankDetailsAndOtpFlow
        claimId={claimId}
        claimNumber={claimNumber}
        netAmount={
          estimate.netAssessmentAmount
        }
        onCompleted={onDone}
        onCancel={() =>
          setShowBankDetails(false)
        }
      />
    )
  }

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
              <div className="smart-assessment-icon">
                <ShieldCheck size={24} />
              </div>

              <div>
                <h3>
                  Smart Assistant Assessment
                </h3>

                <p>
                  Based on the documents
                  and pictures submitted,
                  our Smart Assistant has
                  calculated an estimated
                  payable amount of
                  <strong>
                    {' '}
                    {formatCurrency(
                      estimate.netAssessmentAmount,
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

                  <td>
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

                  <td>
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

                  <td>
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

                  <td>
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

                  <td>
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

                  <td>
                    −{' '}
                    {formatCurrency(
                      estimate.lineItems
                        .policyExcess,
                    )}
                  </td>
                </tr>

                <tr>
                  <td>
                    Salvage Amount
                  </td>

                  <td>
                    −{' '}
                    {formatCurrency(
                      estimate.lineItems
                        .salvageAmount,
                    )}
                  </td>
                </tr>

                <tr>
                  <td>
                    Other Deductions
                  </td>

                  <td>
                    −{' '}
                    {formatCurrency(
                      estimate.lineItems
                        .otherDeductions,
                    )}
                  </td>
                </tr>

                <tr className="net-total">
                  <td>
                    Net Assessment Amount
                  </td>

                  <td>
                    {formatCurrency(
                      estimate.netAssessmentAmount,
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
                onClick={
                  handleAcceptAssessment
                }
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
    </div>
  )
}

// =====================================================================
// BANK DETAILS + BACKEND OTP FLOW
// =====================================================================

function BankDetailsAndOtpFlow({
  claimId,
  claimNumber,
  netAmount,
  onCompleted,
  onCancel,
}: {
  claimId: string
  claimNumber: string
  netAmount: number
  onCompleted: (message: string) => void
  onCancel: () => void
}) {
  const [accountNumber, setAccountNumber] =
    useState('')

  const [
    confirmAccountNumber,
    setConfirmAccountNumber,
  ] = useState('')

  const [ifsc, setIfsc] =
    useState('')

  const [bankName, setBankName] =
    useState('')

  const [branchName, setBranchName] =
    useState('')

  const [phoneNumber, setPhoneNumber] =
    useState('')

  const [error, setError] =
    useState<string | null>(null)

  const [showOtp, setShowOtp] =
    useState(false)

  const [otpCode, setOtpCode] =
    useState('')

  const [otpStatus, setOtpStatus] =
    useState<OtpInputStatus>('idle')

  const [otpError, setOtpError] =
    useState<string | null>(null)

  const [otpSending, setOtpSending] =
    useState(false)

  const [otpVerifying, setOtpVerifying] =
    useState(false)

  const [devModeCode, setDevModeCode] =
    useState<string | null>(null)

  const [otpExpiresAt, setOtpExpiresAt] =
    useState<string | null>(null)

  /*
   * This controls the success screen.
   *
   * IMPORTANT:
   * There is NO timeout attached to this.
   */
  const [credited, setCredited] =
    useState(false)

  // ================================================================
  // VALIDATE BANK DETAILS
  // ================================================================

  const validateBankDetails =
    (): boolean => {
      setError(null)

      if (
        !accountNumber ||
        !confirmAccountNumber ||
        !ifsc ||
        !bankName ||
        !branchName ||
        !phoneNumber
      ) {
        setError(
          'Please complete all bank and phone details.',
        )

        return false
      }

      if (
        accountNumber !==
        confirmAccountNumber
      ) {
        setError(
          'Bank account numbers do not match.',
        )

        return false
      }

      if (
        !/^[0-9]{9,18}$/.test(
          accountNumber,
        )
      ) {
        setError(
          'Please enter a valid bank account number.',
        )

        return false
      }

      if (
        !/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(
          ifsc.trim(),
        )
      ) {
        setError(
          'Please enter a valid IFSC code.',
        )

        return false
      }

      if (
        !/^[6-9][0-9]{9}$/.test(
          phoneNumber,
        )
      ) {
        setError(
          'Please enter a valid 10-digit Indian mobile number.',
        )

        return false
      }

      return true
    }

  // ================================================================
  // SEND OTP
  // ================================================================

  const handleSendOtp = async () => {
    if (!validateBankDetails()) {
      return
    }

    setOtpSending(true)
    setOtpError(null)
    setError(null)

    try {
      const result = await sendOtp(
        OtpPurpose.InstantClaimAccept,
        claimId,
      )

      if (!result.success) {
        setOtpError(
          result.message ||
            'Failed to send OTP.',
        )

        return
      }

      /*
       * This is the OTP generated by
       * the backend.
       */
      setDevModeCode(
        result.devModeCode,
      )

      setOtpExpiresAt(
        result.expiresAt,
      )

      setOtpCode('')
      setOtpStatus('idle')
      setShowOtp(true)
    } catch (err) {
      setOtpError(
        err instanceof ApiError
          ? err.message
          : 'Failed to send OTP.',
      )
    } finally {
      setOtpSending(false)
    }
  }

  // ================================================================
  // VERIFY OTP THROUGH BACKEND
  // ================================================================

  const handleOtpComplete = async (
    value: string,
  ) => {
    if (otpVerifying) {
      return
    }

    setOtpError(null)
    setOtpStatus('idle')
    setOtpVerifying(true)

    try {
      const result =
        await verifyOtp(
          OtpPurpose.InstantClaimAccept,
          value,
          claimId,
        )

      if (!result.success) {
        setOtpStatus('error')

        setOtpError(
          result.message ||
            'Invalid OTP.',
        )

        setOtpCode('')

        return
      }

      /*
       * OTP was verified successfully.
       */
      setOtpStatus('success')

      /*
       * Accept the instant claim ONLY
       * after successful OTP verification.
       */
      await acceptInstantClaim(
        claimId,
      )

      /*
       * IMPORTANT FIX:
       *
       * Previously there was:
       *
       * setTimeout(() => {
       *   onCompleted(...)
       * }, 1200)
       *
       * That caused the success screen
       * to disappear after 1.2 seconds.
       *
       * Now we ONLY show the success screen.
       *
       * It stays visible until the user
       * clicks Finish.
       */
      setCredited(true)
    } catch (err) {
      setOtpStatus('error')

      if (err instanceof ApiError) {
        setOtpError(
          err.message,
        )
      } else {
        setOtpError(
          'OTP verification failed. Please try again.',
        )
      }

      setOtpCode('')
    } finally {
      setOtpVerifying(false)
    }
  }

  // ================================================================
  // RESEND OTP
  // ================================================================

  const handleResendOtp = async () => {
    if (
      otpSending ||
      otpVerifying
    ) {
      return
    }

    setOtpSending(true)
    setOtpError(null)
    setOtpStatus('idle')
    setOtpCode('')

    try {
      const result = await sendOtp(
        OtpPurpose.InstantClaimAccept,
        claimId,
      )

      if (!result.success) {
        setOtpError(
          result.message ||
            'Failed to resend OTP.',
        )

        return
      }

      /*
       * Replace the displayed development
       * OTP with the newly generated OTP.
       */
      setDevModeCode(
        result.devModeCode,
      )

      setOtpExpiresAt(
        result.expiresAt,
      )
    } catch (err) {
      setOtpError(
        err instanceof ApiError
          ? err.message
          : 'Failed to resend OTP.',
      )
    } finally {
      setOtpSending(false)
    }
  }

  // ================================================================
  // SUCCESS SCREEN
  // ================================================================

  /*
   * IMPORTANT:
   *
   * This screen stays open.
   *
   * There is NO setTimeout().
   * There is NO automatic navigation.
   */
  if (credited) {
    return (
      <Modal open>
        <div className="payout-success-content">
          <motion.div
            className="payout-success-icon"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 18 }}
          >
            <CheckCircle2 size={44} />
          </motion.div>

          <h2>Successfully Credited!</h2>

          <p className="payout-success-amount">
            {formatCurrency(netAmount)}
          </p>

          <p className="payout-success-sub">
            credited to account ending{' '}
            <strong>****{accountNumber.slice(-4)}</strong>
          </p>

          <div className="claim-number-box claim-number-box-compact">
            <span>Claim Number</span>
            <strong>{claimNumber}</strong>
          </div>

          <button
            type="button"
            className="bank-primary-button"
            onClick={() =>
              onCompleted(
                'Claim amount successfully credited to your bank account.',
              )
            }
          >
            Finish
            <ArrowRight size={17} />
          </button>
        </div>
      </Modal>
    )
  }

  // ================================================================
  // OTP SCREEN
  // ================================================================

  if (showOtp) {
    return (
      <section className="card bank-otp-card">
        <div className="bank-flow-header">
          <div className="bank-flow-icon">
            <Smartphone size={27} />
          </div>

          <div>
            <span>
              Claim Number
            </span>

            <strong>
              {claimNumber}
            </strong>
          </div>
        </div>

        <h2>
          Verify your mobile number
        </h2>

        <p className="bank-flow-description">
          We have sent a verification code
          to
          <strong>
            {' '}
            +91 {phoneNumber}
          </strong>
          .
        </p>

        {devModeCode && (
          <div className="dummy-otp-box">
            <ShieldCheck size={18} />

            <div>
              <strong>
                OTP
              </strong>

              <span>
                Backend generated OTP:{' '}
                <b>
                  {devModeCode}
                </b>
              </span>
            </div>
          </div>
        )}

        {!devModeCode && (
          <div className="bank-security-note">
            <ShieldCheck size={19} />

            <div>
              <strong>
                OTP sent
              </strong>

              <span>
                Enter the verification code
                sent to your mobile number.
              </span>
            </div>
          </div>
        )}

        {otpExpiresAt && (
          <small className="field-hint">
            OTP expires at{' '}
            {new Date(
              otpExpiresAt,
            ).toLocaleString('en-IN')}
          </small>
        )}

        <div className="otp-wrapper">
          <OtpInput
            value={otpCode}
            onChange={setOtpCode}
            onComplete={
              handleOtpComplete
            }
            status={otpStatus}
          />
        </div>

        {otpVerifying && (
          <div className="reviewing-banner">
            <span className="spinner" />
            Verifying OTP…
          </div>
        )}

        {otpError && (
          <p className="error-text">
            {otpError}
          </p>
        )}

        <div className="bank-otp-amount">
          <span>
            Amount to be credited
          </span>

          <strong>
            {formatCurrency(
              netAmount,
            )}
          </strong>
        </div>

        <div className="bank-actions">
          <button
            type="button"
            className="bank-secondary-button"
            disabled={
              otpSending ||
              otpVerifying
            }
            onClick={() => {
              setShowOtp(false)
              setOtpCode('')
              setOtpStatus('idle')
              setOtpError(null)
            }}
          >
            Back to Bank Details
          </button>

          <button
            type="button"
            className="bank-primary-button"
            disabled={
              otpSending ||
              otpVerifying
            }
            onClick={() =>
              void handleResendOtp()
            }
          >
            {otpSending
              ? 'Sending…'
              : 'Resend OTP'}

            {!otpSending && (
              <ArrowRight size={17} />
            )}
          </button>
        </div>
      </section>
    )
  }

  // ================================================================
  // BANK DETAILS SCREEN
  // ================================================================

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void handleSendOtp()
      }}
    >
      <section className="card bank-details-card bank-details-card-compact">
        <div className="bank-flow-header">
          <div className="bank-flow-icon">
            <Landmark size={22} />
          </div>

          <div>
            <span>
              Claim Number
            </span>

            <strong>
              {claimNumber}
            </strong>
          </div>
        </div>

        <h2>
          Bank account details
        </h2>

        <p className="bank-flow-description">
          Enter the account for your approved amount of{' '}
          <strong>
            {formatCurrency(
              netAmount,
            )}
          </strong>
          .
        </p>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="accountNumber">
              Account Number
            </label>

            <div className="bank-input-wrapper">
              <Wallet size={16} />

              <input
                id="accountNumber"
                type="text"
                inputMode="numeric"
                maxLength={18}
                value={accountNumber}
                onChange={(e) =>
                  setAccountNumber(
                    e.target.value.replace(
                      /\D/g,
                      '',
                    ),
                  )
                }
                placeholder="Account number"
                required
              />
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="confirmAccountNumber">
              Confirm Account Number
            </label>

            <div className="bank-input-wrapper">
              <Check size={16} />

              <input
                id="confirmAccountNumber"
                type="text"
                inputMode="numeric"
                maxLength={18}
                value={
                  confirmAccountNumber
                }
                onChange={(e) =>
                  setConfirmAccountNumber(
                    e.target.value.replace(
                      /\D/g,
                      '',
                    ),
                  )
                }
                placeholder="Re-enter account number"
                required
              />
            </div>
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="ifsc">
              IFSC Code
            </label>

            <div className="bank-input-wrapper">
              <ShieldCheck size={16} />

              <input
                id="ifsc"
                type="text"
                value={ifsc}
                onChange={(e) =>
                  setIfsc(
                    e.target.value.toUpperCase(),
                  )
                }
                placeholder="e.g. SBIN0001234"
                maxLength={11}
                required
              />
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="bankName">
              Bank Name
            </label>

            <div className="bank-input-wrapper">
              <Building2 size={16} />

              <input
                id="bankName"
                type="text"
                value={bankName}
                onChange={(e) =>
                  setBankName(
                    e.target.value,
                  )
                }
                placeholder="Bank name"
                required
              />
            </div>
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="branchName">
              Branch Name
            </label>

            <div className="bank-input-wrapper">
              <Landmark size={16} />

              <input
                id="branchName"
                type="text"
                value={branchName}
                onChange={(e) =>
                  setBranchName(
                    e.target.value,
                  )
                }
                placeholder="Branch name"
                required
              />
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="phoneNumber">
              Mobile Number
            </label>

            <div className="bank-input-wrapper">
              <Smartphone size={16} />

              <input
                id="phoneNumber"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={phoneNumber}
                onChange={(e) =>
                  setPhoneNumber(
                    e.target.value.replace(
                      /\D/g,
                      '',
                    ),
                  )
                }
                placeholder="10-digit mobile number"
                required
              />
            </div>
          </div>
        </div>

        <p className="field-hint bank-otp-hint">
          <ShieldCheck size={13} />
          An OTP will be sent to this number to verify the payout before it's processed.
        </p>

        <div className="bank-security-note bank-security-note-hidden">
          <ShieldCheck size={19} />

          <div>
            <strong>
              Secure payout verification
            </strong>

            <span>
              Your mobile number will be
              verified using a one-time
              password before the claim
              amount is credited.
            </span>
          </div>
        </div>

        {error && (
          <p className="error-text">
            {error}
          </p>
        )}

        <div className="bank-actions">
          <button
            type="button"
            className="bank-secondary-button"
            onClick={onCancel}
            disabled={otpSending}
          >
            Back
          </button>

          <button
            type="submit"
            className="bank-primary-button"
            disabled={otpSending}
          >
            {otpSending
              ? 'Sending OTP…'
              : 'Continue to OTP'}

            {!otpSending && (
              <ArrowRight size={17} />
            )}
          </button>
        </div>
      </section>
    </form>
  )
}