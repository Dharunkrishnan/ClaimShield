import type { ReactNode } from 'react'
import { ClipboardList, Search, Gavel, Wrench, PauseCircle, CheckCircle2, XCircle } from 'lucide-react'
import type { ClaimsHandlerClaimListItem } from './api'

// Shared between the Dashboard's KPI tiles and the Claims page's filter
// pills - both read from this same list/config so the numbers always
// match, driven by Claim.StatusId via the backend's CategoryFor(),
// never invented on the frontend. Pulled into its own module when
// Claims/Reports/Track Claim were split out of the Dashboard into
// their own pages, so nothing needs to duplicate this list.
export const CATEGORY_TABS: Array<{
  key: string
  label: string
  icon: ReactNode
  tone: 'amber' | 'blue' | 'teal' | 'red'
}> = [
    { key: 'All', label: 'All Claims', icon: <ClipboardList size={20} strokeWidth={2.2} />, tone: 'blue' },
    { key: 'PendingAction', label: 'Survey Pending', icon: <Search size={20} strokeWidth={2.2} />, tone: 'amber' },
    { key: 'UnderReview', label: 'Under Review', icon: <Gavel size={20} strokeWidth={2.2} />, tone: 'blue' },
    { key: 'InProgress', label: 'Repair Authorization Pending', icon: <Wrench size={20} strokeWidth={2.2} />, tone: 'teal' },
    { key: 'Completed', label: 'Under Process', icon: <CheckCircle2 size={20} strokeWidth={2.2} />, tone: 'teal' },
    { key: 'OnHold', label: 'On Hold', icon: <PauseCircle size={20} strokeWidth={2.2} />, tone: 'amber' },
    { key: 'Rejected', label: 'Denied Claims', icon: <XCircle size={20} strokeWidth={2.2} />, tone: 'red' },
  ]

export function computeCategoryCounts(
  claims: ClaimsHandlerClaimListItem[] | null,
): Record<string, number> {
  const counts: Record<string, number> = {
    All: claims?.length ?? 0,
    PendingAction: 0,
    UnderReview: 0,
    InProgress: 0,
    Completed: 0,
    OnHold: 0,
    Rejected: 0,
  }
  for (const item of claims ?? []) {
    counts[item.category] = (counts[item.category] ?? 0) + 1
  }
  return counts
}