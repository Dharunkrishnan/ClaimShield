import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, getClaim, getMyRepairAssignments } from '../lib/api'
import type { RepairAssignmentResponseDto } from '../lib/types'
import { AssignmentStatusName } from '../lib/statuses'
import { useAuth } from '../context/AuthContext'

interface Row {
  assignment: RepairAssignmentResponseDto
  claimNumber: string
}

export function RepairQueuePage() {
  const { session } = useAuth()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const userId = session?.user.id

    if (!userId) {
      return
    }

    let cancelled = false

    getMyRepairAssignments(userId)
      .then(async (assignments) => {
        const withClaimNumbers = await Promise.all(
          assignments.map(async (assignment) => {
            try {
              const claim = await getClaim(assignment.claimId)
              return { assignment, claimNumber: claim.claimNumber }
            } catch {
              return { assignment, claimNumber: assignment.claimId }
            }
          }),
        )

        if (!cancelled) setRows(withClaimNumbers)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof ApiError ? err.message : 'Failed to load your repair assignments.',
          )
        }
      })

    return () => {
      cancelled = true
    }
  }, [session?.user.id])

  return (
    <div>
      <h1>My Repairs</h1>

      {error && <p className="error-text">{error}</p>}

      {!error && !rows && <p>Loading…</p>}

      {rows && rows.length === 0 && <p>No repair assignments right now.</p>}

      {rows && rows.length > 0 && (
        <div className="table-responsive">
          <table className="queue-table">
            <thead>
              <tr>
                <th>Claim number</th>
                <th>Status</th>
                <th>Expected completion</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ assignment, claimNumber }) => (
                <tr key={assignment.repairAssignmentId}>
                  <td>
                    <Link to={`/repairs/${assignment.repairAssignmentId}`}>
                      {claimNumber}
                    </Link>
                  </td>
                  <td>
                    {AssignmentStatusName[assignment.assignmentStatusId] ??
                      'Unknown'}
                  </td>
                  <td>
                    {assignment.expectedCompletionDate
                      ? new Date(
                          assignment.expectedCompletionDate,
                        ).toLocaleDateString()
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
