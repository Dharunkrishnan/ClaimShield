import { Fragment } from 'react'
import { motion } from 'framer-motion'
import {
  Search,
  Gavel,
  Wrench,
  Wallet,
  ShieldCheck,
  Archive,
  Check,
  X,
} from 'lucide-react'
import {
  ClaimStatus,
  PaymentStatus,
  RepairAuthorizationStatus,
} from '../lib/statuses'
import type { PaymentResponseDto } from '../lib/types'

// ================================================================
// CLAIM LIFECYCLE STAGES
// ================================================================

const STAGES = [
  { label: 'Inspection', Icon: Search },
  { label: 'Decision Support Risk', Icon: Gavel },
  { label: 'Repair Authorization', Icon: Wrench },
  { label: 'Liability', Icon: Wallet },
  { label: 'Approval', Icon: ShieldCheck },
  { label: 'Closure', Icon: Archive },
] as const

// ================================================================
// ROUTE PATHS
// ================================================================

export const STAGE_PATHS = [
  'inspection',
  'decision-support-risk',
  'repair-authorization',
  'liability',
  'approval',
  'closure',
] as const

type StageState =
  | 'complete'
  | 'active'
  | 'upcoming'
  | 'rejected'

// ================================================================
// GET CURRENT STAGE INDEX
// ================================================================

function getStageIndex(
  statusId: number | null,
  hasPendingOrProcessingPayment: boolean,
  repairAuthorizationStatusId?: number | null,
  liabilitySubmitted?: boolean,
): number {
  switch (statusId) {
    // ------------------------------------------------------------
    // INSPECTION
    // ------------------------------------------------------------

    case ClaimStatus.Submitted:
    case ClaimStatus.UnderReview:
    case ClaimStatus.SurveyAssigned:
      return 0

    // ------------------------------------------------------------
    // DECISION SUPPORT RISK
    // ------------------------------------------------------------

    case ClaimStatus.SurveyCompleted:
      return 1

    // ------------------------------------------------------------
    // REPAIR AUTHORIZATION / LIABILITY
    // ------------------------------------------------------------

    case ClaimStatus.RepairAssigned:
    case ClaimStatus.RepairInProgress:
      if (
        repairAuthorizationStatusId ===
        RepairAuthorizationStatus.Authorized
      ) {
        return liabilitySubmitted || hasPendingOrProcessingPayment
          ? 4
          : 3
      }

      return 2

    // ------------------------------------------------------------
    // APPROVAL
    // ------------------------------------------------------------

    case ClaimStatus.Approved:
      return liabilitySubmitted || hasPendingOrProcessingPayment
        ? 4
        : 3

    // ------------------------------------------------------------
    // CLOSURE
    // ------------------------------------------------------------

    case ClaimStatus.Settled:
      return 5

    default:
      return 0
  }
}

// ================================================================
// GET STATE FOR EVERY STAGE
// ================================================================

function getStageStates(
  statusId: number | null,
  hasPendingOrProcessingPayment: boolean,
  repairAuthorizationStatusId?: number | null,
  liabilitySubmitted?: boolean,
): StageState[] {
  // Closed claim means every stage is complete.
  if (statusId === ClaimStatus.Closed) {
    return STAGES.map(() => 'complete')
  }

  // Rejected claim:
  // Inspection is complete,
  // Decision Support Risk is rejected,
  // everything after that is upcoming.
  if (statusId === ClaimStatus.Rejected) {
    return STAGES.map((_, index) =>
      index < 1
        ? 'complete'
        : index === 1
          ? 'rejected'
          : 'upcoming',
    )
  }

  const currentIndex = getStageIndex(
    statusId,
    hasPendingOrProcessingPayment,
    repairAuthorizationStatusId,
    liabilitySubmitted,
  )

  return STAGES.map((_, index) => {
    if (index < currentIndex) {
      return 'complete'
    }

    if (index === currentIndex) {
      return 'active'
    }

    return 'upcoming'
  })
}

// ================================================================
// PUBLIC HELPER
// ================================================================

export function getReachableStageIndex(
  statusId: number | null,
  payments: PaymentResponseDto[],
  repairAuthorizationStatusId?: number | null,
  liabilitySubmitted?: boolean,
): number {
  const hasPendingOrProcessingPayment = payments.some(
    (payment) =>
      payment.paymentStatusId === PaymentStatus.Pending ||
      payment.paymentStatusId === PaymentStatus.Processing,
  )

  const states = getStageStates(
    statusId,
    hasPendingOrProcessingPayment,
    repairAuthorizationStatusId,
    liabilitySubmitted,
  )

  for (let i = states.length - 1; i >= 0; i--) {
    if (states[i] !== 'upcoming') {
      return i
    }
  }

  return 0
}

// ================================================================
// LIFECYCLE STEPPER
// ================================================================

export function ClaimLifecycleStepper({
  statusId,
  payments,
  repairAuthorizationStatusId,
  liabilitySubmitted,
  onStepClick,
}: {
  statusId: number | null
  payments: PaymentResponseDto[]
  repairAuthorizationStatusId?: number | null
  liabilitySubmitted?: boolean
  onStepClick?: (index: number) => void
}) {
  // --------------------------------------------------------------
  // PAYMENT CHECK
  // --------------------------------------------------------------

  const hasPendingOrProcessingPayment = payments.some(
    (payment) =>
      payment.paymentStatusId === PaymentStatus.Pending ||
      payment.paymentStatusId === PaymentStatus.Processing,
  )

  // --------------------------------------------------------------
  // GET STATES
  // --------------------------------------------------------------

  const states = getStageStates(
    statusId,
    hasPendingOrProcessingPayment,
    repairAuthorizationStatusId,
    liabilitySubmitted,
  )

  // --------------------------------------------------------------
  // DETERMINE ACTIVE / REJECTED POSITION
  // --------------------------------------------------------------

  const activeOrRejectedIndex = states.findIndex(
    (state) =>
      state === 'active' ||
      state === 'rejected',
  )

  const lastCompleteIndex = states.lastIndexOf(
    'complete',
  )

  const effectiveIndex =
    activeOrRejectedIndex >= 0
      ? activeOrRejectedIndex
      : lastCompleteIndex

  // --------------------------------------------------------------
  // PROGRESS BAR
  // --------------------------------------------------------------

  const fillPercent =
    STAGES.length > 1
      ? (
          Math.max(effectiveIndex, 0) /
          (STAGES.length - 1)
        ) * 100
      : 0

  // ==============================================================
  // RENDER
  // ==============================================================

  return (
    <div className="lifecycle-stepper">

      {/* ========================================================
          PROGRESS TRACK
          ======================================================== */}

      <div
        className="lifecycle-stepper-track"
        aria-hidden="true"
      >
        <motion.div
          className="lifecycle-stepper-fill"
          initial={false}
          animate={{
            width: `${fillPercent}%`,
          }}
          transition={{
            type: 'spring',
            stiffness: 200,
            damping: 30,
          }}
        />
      </div>

      {/* ========================================================
          SIX LIFECYCLE STAGES
          ======================================================== */}

      <div className="lifecycle-stepper-steps">

        {STAGES.map((stage, index) => {
          const state = states[index]

          const Icon = stage.Icon

          // A stage can only be opened if the claim has
          // actually reached that stage.
          const isReachable =
            state !== 'upcoming'

          const isClickable =
            Boolean(
              onStepClick &&
              isReachable,
            )

          // ------------------------------------------------------
          // STEP
          // ------------------------------------------------------

          return (
            <Fragment key={stage.label}>

              <button
                type="button"
                className={[
                  'lifecycle-stepper-step',
                  `lifecycle-stepper-step-${state}`,
                ].join(' ')}
                onClick={() => {
                  if (isClickable) {
                    onStepClick?.(index)
                  }
                }}
                disabled={!isClickable}
                title={
                  !isReachable
                    ? 'This stage has not been reached yet.'
                    : undefined
                }
                aria-current={
                  state === 'active'
                    ? 'step'
                    : undefined
                }
              >

                {/* ==================================================
                    STAGE CIRCLE
                    ================================================== */}

                <motion.span
                  className="lifecycle-stepper-dot"
                  animate={{
                    scale:
                      state === 'active'
                        ? 1.08
                        : 1,
                  }}
                  transition={{
                    type: 'spring',
                    stiffness: 300,
                    damping: 20,
                  }}
                >

                  {/* ----------------------------------------------
                      COMPLETED
                      Green tick
                     ---------------------------------------------- */}

                  {state === 'complete' && (
                    <Check
                      size={17}
                      strokeWidth={3.2}
                      aria-hidden="true"
                    />
                  )}

                  {/* ----------------------------------------------
                      REJECTED
                     ---------------------------------------------- */}

                  {state === 'rejected' && (
                    <X
                      size={17}
                      strokeWidth={3.2}
                      aria-hidden="true"
                    />
                  )}

                  {/* ----------------------------------------------
                      ACTIVE
                      ---------------------------------------------- */}

                  {state === 'active' && (
                    <Icon
                      size={17}
                      strokeWidth={2.5}
                      aria-hidden="true"
                    />
                  )}

                  {/* ----------------------------------------------
                      UPCOMING
                      ---------------------------------------------- */}

                  {state === 'upcoming' && (
                    <Icon
                      size={17}
                      strokeWidth={2.3}
                      aria-hidden="true"
                    />
                  )}

                </motion.span>

                {/* ==================================================
                    STAGE LABEL
                    ================================================== */}

                <span className="lifecycle-stepper-label">
                  {stage.label}
                </span>

              </button>

              {/* ====================================================
                  ARROW BETWEEN STAGES
                  ==================================================== */}

              {index < STAGES.length - 1 && (
                <span
                  className={[
                    'lifecycle-stepper-arrow',
                    state === 'complete'
                      ? 'complete'
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-hidden="true"
                >
                  ›
                </span>
              )}

            </Fragment>
          )
        })}

      </div>
    </div>
  )
}