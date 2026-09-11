import { Fragment, useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ApiError,
  createRepairAssignment,
  createSurveyAssignment,
  getAllClaims,
  getAllUsers,
} from '../../lib/api'
import type { ClaimResponseDto, UserResponseDto } from '../../lib/types'
import { ClaimStatusName, InspectionMode, InspectionModeName } from '../../lib/statuses'
import { RoleId } from '../../lib/roles'

export function AdminClaimsPage() {
  const [claims, setClaims] = useState<ClaimResponseDto[] | null>(null)
  const [users, setUsers] = useState<UserResponseDto[]>([])
  const [error, setError] = useState<string | null>(null)
  const [expandedClaimId, setExpandedClaimId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [claimData, userData] = await Promise.all([getAllClaims(), getAllUsers()])
      setClaims(claimData)
      setUsers(userData)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load claims.')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const surveyors = users.filter((u) => u.roleId === RoleId.Surveyor)
  const repairers = users.filter((u) => u.roleId === RoleId.Repairer)

  return (
    <div>
      <h1>All Claims</h1>

      {error && <p className="error-text">{error}</p>}
      {!error && !claims && <p>Loading…</p>}
      {claims && claims.length === 0 && <p>No claims yet.</p>}

      {claims && claims.length > 0 && (
        <div className="table-responsive">
          <table className="queue-table">
            <thead>
              <tr>
                <th>Claim number</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {claims.map((claim) => (
                <Fragment key={claim.claimId}>
                  <tr>
                    <td>
                      <Link to={`/claims/${claim.claimId}`}>{claim.claimNumber}</Link>
                    </td>
                    <td>{ClaimStatusName[claim.statusId ?? 0] ?? 'Unknown'}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedClaimId(
                            expandedClaimId === claim.claimId ? null : claim.claimId,
                          )
                        }
                      >
                        {expandedClaimId === claim.claimId ? 'Close' : 'Assign'}
                      </button>
                    </td>
                  </tr>
                  {expandedClaimId === claim.claimId && (
                    <tr>
                      <td colSpan={3}>
                        <AssignPanel
                          claimId={claim.claimId}
                          surveyors={surveyors}
                          repairers={repairers}
                          onDone={() => void load()}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function AssignPanel({
  claimId,
  surveyors,
  repairers,
  onDone,
}: {
  claimId: string
  surveyors: UserResponseDto[]
  repairers: UserResponseDto[]
  onDone: () => void
}) {
  const [surveyorId, setSurveyorId] = useState(surveyors[0]?.userId ?? '')
  const [inspectionMode, setInspectionMode] = useState<number>(InspectionMode.Physical)
  const [repairerId, setRepairerId] = useState(repairers[0]?.userId ?? '')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const assignSurveyor = async () => {
    setError(null)
    try {
      await createSurveyAssignment(claimId, surveyorId, inspectionMode)
      setMessage('Surveyor assigned.')
      onDone()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to assign surveyor.')
    }
  }

  const assignRepairer = async () => {
    setError(null)
    try {
      await createRepairAssignment(claimId, repairerId)
      setMessage('Repairer assigned.')
      onDone()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to assign repairer.')
    }
  }

  return (
    <div className="card">
      {message && <p className="success-text">{message}</p>}
      {error && <p className="error-text">{error}</p>}

      <h3>Assign a Surveyor</h3>
      {surveyors.length === 0 ? (
        <p>No Surveyor accounts exist yet.</p>
      ) : (
        <>
          <select value={surveyorId} onChange={(e) => setSurveyorId(e.target.value)}>
            {surveyors.map((s) => (
              <option key={s.userId} value={s.userId}>
                {s.firstName} {s.lastName ?? ''}
              </option>
            ))}
          </select>
          <select
            value={inspectionMode}
            onChange={(e) => setInspectionMode(Number(e.target.value))}
          >
            {Object.entries(InspectionModeName).map(([value, name]) => (
              <option key={value} value={value}>
                {name}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => void assignSurveyor()}>
            Assign Surveyor
          </button>
        </>
      )}

      <h3>Assign a Repairer</h3>
      {repairers.length === 0 ? (
        <p>No Repairer accounts exist yet.</p>
      ) : (
        <>
          <select value={repairerId} onChange={(e) => setRepairerId(e.target.value)}>
            {repairers.map((r) => (
              <option key={r.userId} value={r.userId}>
                {r.firstName} {r.lastName ?? ''}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => void assignRepairer()}>
            Assign Repairer
          </button>
        </>
      )}
    </div>
  )
}
