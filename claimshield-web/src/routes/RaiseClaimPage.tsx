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
  Mic,
  CheckCircle2,
  FileText,
  HelpCircle,
  ClipboardCheck,
  Wallet,
  Car,
  Landmark,
  Smartphone,
  Building2,
  ShieldCheck,
  ArrowRight,
  Check,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react'

import {
  acceptInstantClaim,
  ApiError,
  declineInstantClaim,
  generateEstimate,
  getMyClaimScore,
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
  CustomerClaimScoreDto,
  InstantClaimPartsSelection,
  PolicyResponseDto,
  VehicleResponseDto,
} from '../lib/types'

import {
  LossType,
  LossTypeName,
  OtpPurpose,
  VehicleLocationName,
} from '../lib/statuses'

import { WizardShell } from '../components/WizardShell'
import { Modal } from '../components/Modal'
import {
  OtpInput,
  type OtpInputStatus,
} from '../components/OtpInput'
import { UploadCard } from '../components/UploadCard'
import {
  Skeleton,
  SkeletonBlock,
} from '../components/Skeleton'
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
}

function formatCurrency(amount: number) {
  return `₹ ${amount.toLocaleString('en-IN')}`
}

export function RaiseClaimPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [step, setStep] = useState(1)

  const [claimId, setClaimId] =
    useState<string | null>(null)

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

  const [confirmMessage, setConfirmMessage] =
    useState('')

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
    message: string,
  ) => {
    setClaimId(id)
    setClaimNumber(number)
    setConfirmMessage(message)
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

        {step === 2 && claimId && (
          <Step2
            claimId={claimId}
            claimNumber={claimNumber!}
            onVerified={() => setStep(3)}
            onRouted={handleRouted}
          />
        )}

        {step === 3 && claimId && (
          <Step3
            claimId={claimId}
            claimNumber={claimNumber!}
            onDone={(message) => {
              showToast(message, 'success')
              navigate(`/my-claims/${claimId}`)
            }}
            onRouted={handleRouted}
          />
        )}
      </WizardShell>

      <Modal
        open={showConfirmModal}
        title="Claim registered!"
      >
        <div className="claim-created-content">
          <div className="claim-success-icon">
            <CheckCircle2 size={34} />
          </div>

          <p>{confirmMessage}</p>

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
  ) => void
}) {
  const { showToast } = useToast()

  const [policyId, setPolicyId] = useState('')
  const [vehicleId, setVehicleId] = useState('')

  const [
    vehicleLocationAtLoss,
    setVehicleLocationAtLoss,
  ] = useState(0)

  const [lossType, setLossType] = useState(0)

  const [dateOfLoss, setDateOfLoss] =
    useState('')

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

  const [listening, setListening] =
    useState(false)

  const [voiceUnsupported, setVoiceUnsupported] =
    useState(false)

  const [submitting, setSubmitting] =
    useState(false)

  const [error, setError] =
    useState<string | null>(null)

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

  const today = new Date()
    .toISOString()
    .slice(0, 10)

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
      !locationOfLoss ||
      description.length < 10
    ) {
      setError(
        'Please complete all required fields.',
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
            dateOfLoss,
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

      onDone(
        result.claimId,
        result.claimNumber,
        result.message,
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
      <section className="card card-tint-blue">
        <h2>Your details</h2>

        {loading ? (
          <SkeletonBlock lines={3} />
        ) : policies.length === 0 ? (
          <p className="error-text">
            No policy is on file for your account.
            Please contact support.
          </p>
        ) : (
          <dl className="fact-grid fact-grid-form">
            <dt>
              <FileText size={14} />
              Policy
            </dt>

            <dd>
              <label
                htmlFor="policy"
                className="visually-hidden"
              >
                Policy
              </label>

              <select
                id="policy"
                className="fact-grid-select"
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
            </dd>

            <dt>
              <Car size={14} />
              Vehicle
            </dt>

            <dd>
              {selectedVehicle?.registrationNumber ??
                '—'}
            </dd>

            <dt>
              <Wallet size={14} />
              Coverage
            </dt>

            <dd>
              {selectedPolicy
                ? formatCurrency(
                    selectedPolicy.coverageAmount,
                  )
                : '—'}
            </dd>
          </dl>
        )}
      </section>

      <section className="card card-tint-blue">
        <h2>Incident details</h2>

        <div className="form-field">
          <label htmlFor="vehicleLocation">
            Vehicle location right now
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
          <label>Type of Loss</label>

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
              Date of Loss
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
            <label htmlFor="locationOfLoss">
              Location of Loss
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
        </div>

        <div className="form-field">
          <label htmlFor="description">
            Description
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

        {error && (
          <p className="error-text">
            {error}
          </p>
        )}

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
  onVerified,
  onRouted,
}: {
  claimId: string
  claimNumber: string
  onVerified: () => void
  onRouted: (message: string) => void
}) {
  const [uploaded, setUploaded] =
    useState<Record<number, boolean>>({})

  const [
    vehicleParkedSafely,
    setVehicleParkedSafely,
  ] = useState<boolean | null>(null)

  const [
    deathOccurred,
    setDeathOccurred,
  ] = useState<boolean | null>(null)

  const [reviewing, setReviewing] =
    useState(false)

  const [error, setError] =
    useState<string | null>(null)

  const allUploaded =
    uploaded[1] &&
    uploaded[2] &&
    uploaded[3] &&
    uploaded[4] &&
    uploaded[5] &&
    uploaded[6]

  const handleVerify = async () => {
    if (
      vehicleParkedSafely == null ||
      deathOccurred == null
    ) {
      setError(
        'Please answer both questions.',
      )

      return
    }

    if (!allUploaded) {
      setError(
        'Please upload all 6 documents before verifying.',
      )

      return
    }

    setError(null)
    setReviewing(true)

    try {
      const result =
        await raiseClaimStep2(
          claimId,
          {
            vehicleParkedSafely,
            deathOccurred,
          },
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

  const slots: [number, string][] = [
    [1, 'Vehicle photo — Front'],
    [2, 'Vehicle photo — Left'],
    [3, 'Vehicle photo — Back'],
    [4, 'Vehicle photo — Right'],
    [5, 'Number plate photo'],
    [6, 'RC document'],
  ]

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
        </h2>

        <div className="upload-grid">
          {slots.map(
            ([typeId, label]) => (
              <UploadCard
                key={typeId}
                label={label}
                claimId={claimId}
                documentTypeId={typeId}
                onUploaded={() =>
                  setUploaded(
                    (u) => ({
                      ...u,
                      [typeId]:
                        true,
                    }),
                  )
                }
              />
            ),
          )}
        </div>
      </section>

      <section className="card card-tint-blue">
        <h2>
          <HelpCircle
            size={17}
            style={{
              verticalAlign: '-3px',
              marginRight: '0.4rem',
            }}
          />

          A couple of quick questions
        </h2>

        <label>
          Is the vehicle currently parked
          in a safe location?
        </label>

        <div className="radio-pill-group">
          <label className="radio-pill">
            <input
              type="radio"
              name="parked"
              checked={
                vehicleParkedSafely ===
                true
              }
              onChange={() =>
                setVehicleParkedSafely(
                  true,
                )
              }
            />

            Yes
          </label>

          <label className="radio-pill">
            <input
              type="radio"
              name="parked"
              checked={
                vehicleParkedSafely ===
                false
              }
              onChange={() =>
                setVehicleParkedSafely(
                  false,
                )
              }
            />

            No
          </label>
        </div>

        <label>
          Did any death occur in this
          incident?
        </label>

        <div className="radio-pill-group">
          <label className="radio-pill">
            <input
              type="radio"
              name="death"
              checked={
                deathOccurred ===
                true
              }
              onChange={() =>
                setDeathOccurred(
                  true,
                )
              }
            />

            Yes
          </label>

          <label className="radio-pill">
            <input
              type="radio"
              name="death"
              checked={
                deathOccurred ===
                false
              }
              onChange={() =>
                setDeathOccurred(
                  false,
                )
              }
            />

            No
          </label>
        </div>

        {error && (
          <p className="error-text">
            {error}
          </p>
        )}

        {reviewing ? (
          <div className="reviewing-banner">
            <span className="spinner" />
            Reviewing…
          </div>
        ) : (
          <button
            type="button"
            onClick={() =>
              void handleVerify()
            }
          >
            Verify
          </button>
        )}
      </section>
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
  const [score, setScore] =
    useState<CustomerClaimScoreDto | null>(
      null,
    )

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

    getMyClaimScore(claimId)
      .then((s) => {
        if (!cancelled) {
          setScore(s)
        }
      })
      .catch(() => {
        // Non-critical.
      })

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

      <section className="card card-tint-blue">
        <h2>
          <ClipboardCheck
            size={17}
            style={{
              verticalAlign: '-3px',
              marginRight: '0.4rem',
            }}
          />

          {claimNumber} — Review
        </h2>

        {score ? (
          <dl className="fact-grid">
            <dt>
              Readiness Score
            </dt>

            <dd>
              <span
                className={`band-badge band-${score.compositeBandName.toLowerCase()}`}
              >
                {
                  score.compositeBandName
                }
              </span>{' '}
              ({score.compositeScore})
            </dd>
          </dl>
        ) : (
          <Skeleton
            width="8rem"
            height="1.5rem"
          />
        )}
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
                  distributed to your bank
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

  const [saving, setSaving] =
    useState(false)

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
      <section className="card payout-success-card">
        <div className="payout-success-icon">
          <CheckCircle2 size={54} />
        </div>

        <h2>
          Successfully Credited!
        </h2>

        <p>
          Your claim amount of{' '}
          <strong>
            {formatCurrency(
              netAmount,
            )}
          </strong>{' '}
          has been successfully
          processed.
        </p>

        <div className="payout-success-details">
          <div>
            <span>
              Claim Number
            </span>

            <strong>
              {claimNumber}
            </strong>
          </div>

          <div>
            <span>
              Amount
            </span>

            <strong>
              {formatCurrency(
                netAmount,
              )}
            </strong>
          </div>

          <div>
            <span>
              Bank Account
            </span>

            <strong>
              ****
              {accountNumber.slice(
                -4,
              )}
            </strong>
          </div>
        </div>

        <div className="success-note">
          <Check size={16} />

          Payment confirmation has been
          recorded for this claim.
        </div>

        {/* ==========================================================
            FINISH BUTTON
            ========================================================== */}

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
      </section>
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
                Demo OTP
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
      <section className="card bank-details-card">
        <div className="bank-flow-header">
          <div className="bank-flow-icon">
            <Landmark size={27} />
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
          Enter the bank account where you
          want the approved claim amount of{' '}
          <strong>
            {formatCurrency(
              netAmount,
            )}
          </strong>{' '}
          to be credited.
        </p>

        <div className="form-field">
          <label htmlFor="accountNumber">
            Account Number
          </label>

          <div className="bank-input-wrapper">
            <Wallet size={18} />

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
              placeholder="Enter bank account number"
              required
            />
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="confirmAccountNumber">
            Confirm Account Number
          </label>

          <div className="bank-input-wrapper">
            <Check size={18} />

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

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="ifsc">
              IFSC Code
            </label>

            <div className="bank-input-wrapper">
              <ShieldCheck size={18} />

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
              <Building2 size={18} />

              <input
                id="bankName"
                type="text"
                value={bankName}
                onChange={(e) =>
                  setBankName(
                    e.target.value,
                  )
                }
                placeholder="Enter bank name"
                required
              />
            </div>
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="branchName">
            Branch Name
          </label>

          <div className="bank-input-wrapper">
            <Landmark size={18} />

            <input
              id="branchName"
              type="text"
              value={branchName}
              onChange={(e) =>
                setBranchName(
                  e.target.value,
                )
              }
              placeholder="Enter branch name"
              required
            />
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="phoneNumber">
            Mobile Number
          </label>

          <div className="bank-input-wrapper">
            <Smartphone size={18} />

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

          <small className="field-hint">
            An OTP will be sent to this
            number before the payout is
            processed.
          </small>
        </div>

        <div className="bank-security-note">
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