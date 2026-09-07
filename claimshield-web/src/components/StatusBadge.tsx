import {
  FileClock,
  Search,
  UserCheck,
  ClipboardCheck,
  Wrench,
  Hammer,
  CheckCircle2,
  XCircle,
  BadgeCheck,
  Archive,
  PauseCircle,
  Circle,
} from 'lucide-react'
import { ClaimStatus, ClaimStatusName } from '../lib/statuses'

const STATUS_ICON: Record<number, typeof Circle> = {
  [ClaimStatus.Submitted]: FileClock,
  [ClaimStatus.UnderReview]: Search,
  [ClaimStatus.SurveyAssigned]: UserCheck,
  [ClaimStatus.SurveyCompleted]: ClipboardCheck,
  [ClaimStatus.RepairAssigned]: Wrench,
  [ClaimStatus.RepairInProgress]: Hammer,
  [ClaimStatus.Approved]: CheckCircle2,
  [ClaimStatus.Rejected]: XCircle,
  [ClaimStatus.Settled]: BadgeCheck,
  [ClaimStatus.Closed]: Archive,
  [ClaimStatus.OnHold]: PauseCircle,
}

const STATUS_TONE: Record<number, string> = {
  [ClaimStatus.Submitted]: 'blue',
  [ClaimStatus.UnderReview]: 'blue',
  [ClaimStatus.SurveyAssigned]: 'amber',
  [ClaimStatus.SurveyCompleted]: 'amber',
  [ClaimStatus.RepairAssigned]: 'amber',
  [ClaimStatus.RepairInProgress]: 'amber',
  [ClaimStatus.Approved]: 'green',
  [ClaimStatus.Rejected]: 'red',
  [ClaimStatus.Settled]: 'green',
  [ClaimStatus.Closed]: 'neutral',
  [ClaimStatus.OnHold]: 'amber',
}

export function getClaimStatusTone(statusId: number | null | undefined): string {
  return STATUS_TONE[statusId ?? 0] ?? 'neutral'
}

export function ClaimStatusBadge({ statusId }: { statusId: number | null | undefined }) {
  const id = statusId ?? 0
  const Icon = STATUS_ICON[id] ?? Circle
  const tone = getClaimStatusTone(id)
  const label = ClaimStatusName[id] ?? 'Unknown'

  return (
    <span className={`badge badge-icon badge-${tone}`}>
      <Icon size={13} strokeWidth={2.4} />
      {label}
    </span>
  )
}

export function ActiveBadge({ active }: { active: boolean }) {
  const Icon = active ? CheckCircle2 : XCircle
  return (
    <span className={`badge badge-icon ${active ? 'badge-green' : 'badge-neutral'}`}>
      <Icon size={13} strokeWidth={2.4} />
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}
