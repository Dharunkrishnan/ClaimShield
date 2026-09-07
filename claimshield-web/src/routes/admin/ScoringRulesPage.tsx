import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  ApiError,
  createScoringRule,
  getScoringRules,
  getScoringThresholds,
  toggleScoringRule,
  updateScoringRule,
  updateScoringThresholds,
} from '../../lib/api'
import type { ScoringRuleResponseDto } from '../../lib/types'
import { ScoringSeverity } from '../../lib/types'

const STAGES = [
  { stage: 1, label: 'Stage 1 — FNOL (claim registration)' },
  { stage: 2, label: 'Stage 2 — Survey report' },
]

const CONDITION_FIELDS: Record<number, string[]> = {
  1: [
    'IntimationDelayDays',
    'EstimatedLossAmount',
    'PriorClaimsCount',
    'IsFraudSuspected',
    'PolicyCoverageRatio',

    // FNOL scoring rules
    'PolicyActiveOnLossDate',
    'DaysFromPolicyStart',
    'FirRequiredButMissing',
    'ClaimFrequency',
    'IsPermittedDriver',
    'IsUsageAreaConsistent',
  ],

  2: [
    'IntimationDelayDays',
    'EstimatedLossAmount',
    'PriorClaimsCount',
    'IsFraudSuspected',
    'PolicyCoverageRatio',
    'EstimatedRepairCost',
    'TotalLoss',
    'DocumentCount',
    'RepairToLossRatio',

    // Survey scoring rules
    'RepairCostToIdvRatio',
    'SurveyorFlaggedSuspicious',
    'PreExistingDamageSuspected',
  ],
}

const OPERATORS = ['>', '>=', '<', '<=', '=', '!=']

const SEVERITY_LABEL: Record<number, string> = {
  [ScoringSeverity.Hard]: 'Hard (forces Red)',
  [ScoringSeverity.Soft]: 'Soft (adds points)',
}

export function ScoringRulesPage() {
  const [rules, setRules] = useState<ScoringRuleResponseDto[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadRules = useCallback(async () => {
    setLoading(true)
    setLoadError(null)

    try {
      setRules(await getScoringRules())
    } catch (err) {
      setLoadError(
        err instanceof ApiError ? err.message : 'Failed to load scoring rules.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRules()
  }, [loadRules])

  return (
    <div>
      <h1>Scoring Rules</h1>
      <p>
        Rules drive the two-stage risk engine. Every edit creates a new
        version - past claim scoring explanations never change. No rule is
        active until you add it here; nothing is pre-seeded.
      </p>

      <ThresholdsPanel />

      {loadError && <p className="error-text">{loadError}</p>}

      {STAGES.map(({ stage, label }) => (
        <StageSection
          key={stage}
          stage={stage}
          label={label}
          rules={rules.filter((r) => r.stage === stage)}
          loading={loading}
          onChanged={loadRules}
        />
      ))}
    </div>
  )
}

function ThresholdsPanel() {
  const [amberMin, setAmberMin] = useState('')
  const [redMin, setRedMin] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    getScoringThresholds()
      .then((threshold) => {
        if (cancelled) return
        setAmberMin(threshold?.amberMin?.toString() ?? '')
        setRedMin(threshold?.redMin?.toString() ?? '')
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Failed to load thresholds.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)

    try {
      await updateScoringThresholds(Number(amberMin), Number(redMin))
      setMessage('Saved.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save thresholds.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="card">
      <h2>Band thresholds</h2>
      <p>
        A claim's composite score bands Green below Amber Min, Amber up to
        Red Min, and Red at or above Red Min. Until these are configured,
        every claim fails safe to Red.
      </p>

      {loading ? (
        <p>Loading…</p>
      ) : (
        <form onSubmit={handleSubmit}>
          <label htmlFor="amberMin">Amber Min</label>
          <input
            id="amberMin"
            type="number"
            required
            value={amberMin}
            onChange={(e) => setAmberMin(e.target.value)}
          />

          <label htmlFor="redMin">Red Min</label>
          <input
            id="redMin"
            type="number"
            required
            value={redMin}
            onChange={(e) => setRedMin(e.target.value)}
          />

          {error && <p className="error-text">{error}</p>}
          {message && <p className="success-text">{message}</p>}

          <button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </form>
      )}
    </section>
  )
}

function StageSection({
  stage,
  label,
  rules,
  loading,
  onChanged,
}: {
  stage: number
  label: string
  rules: ScoringRuleResponseDto[]
  loading: boolean
  onChanged: () => void
}) {
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)

  const handleToggle = async (ruleId: string) => {
    try {
      await toggleScoringRule(ruleId)
      onChanged()
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to toggle rule.')
    }
  }

  return (
    <section className="card">
      <h2>{label}</h2>

      {loading && <p>Loading…</p>}

      {!loading && rules.length === 0 && <p>No rules configured for this stage yet.</p>}

      {!loading && rules.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Rule ID</th>
              <th>Category</th>
              <th>Condition</th>
              <th>Severity</th>
              <th>Points</th>
              <th>Version</th>
              <th>Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.ruleId}>
                <td>{rule.ruleId}</td>
                <td>{rule.category}</td>
                <td>
                  {rule.conditionField} {rule.conditionOperator} {rule.conditionThreshold}
                </td>
                <td>{SEVERITY_LABEL[rule.severity] ?? 'Unknown'}</td>
                <td>{rule.severity === ScoringSeverity.Hard ? '—' : rule.points}</td>
                <td>v{rule.version}</td>
                <td>{rule.isActive ? 'Yes' : 'No'}</td>
                <td>
                  <button type="button" onClick={() => void handleToggle(rule.ruleId)}>
                    {rule.isActive ? 'Deactivate' : 'Activate'}
                  </button>{' '}
                  <button type="button" onClick={() => setEditingRuleId(rule.ruleId)}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {rules
        .filter((r) => r.ruleId === editingRuleId)
        .map((rule) => (
          <RuleForm
            key={rule.ruleId}
            stage={stage}
            existing={rule}
            onDone={() => {
              setEditingRuleId(null)
              onChanged()
            }}
            onCancel={() => setEditingRuleId(null)}
          />
        ))}

      {!showNewForm && (
        <button type="button" onClick={() => setShowNewForm(true)}>
          + New Rule
        </button>
      )}

      {showNewForm && (
        <RuleForm
          stage={stage}
          onDone={() => {
            setShowNewForm(false)
            onChanged()
          }}
          onCancel={() => setShowNewForm(false)}
        />
      )}
    </section>
  )
}

function RuleForm({
  stage,
  existing,
  onDone,
  onCancel,
}: {
  stage: number
  existing?: ScoringRuleResponseDto
  onDone: () => void
  onCancel: () => void
}) {
  const [category, setCategory] = useState(existing?.category ?? '')
  const [conditionField, setConditionField] = useState(
    existing?.conditionField ?? CONDITION_FIELDS[stage][0],
  )
  const [conditionOperator, setConditionOperator] = useState(
    existing?.conditionOperator ?? OPERATORS[0],
  )
  const [conditionThreshold, setConditionThreshold] = useState(
    existing?.conditionThreshold ?? '',
  )
  const [severity, setSeverity] = useState(existing?.severity ?? ScoringSeverity.Soft)
  const [points, setPoints] = useState(existing?.points?.toString() ?? '0')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)

    const payload = {
      category,
      conditionField,
      conditionOperator,
      conditionThreshold,
      severity,
      points: severity === ScoringSeverity.Hard ? 0 : Number(points),
    }

    try {
      if (existing) {
        await updateScoringRule(existing.ruleId, payload)
      } else {
        await createScoringRule({ stage, ...payload })
      }
      onDone()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save rule.')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <h3>{existing ? `Edit ${existing.ruleId}` : 'New rule'}</h3>

      <label htmlFor="category">Category (business label)</label>
      <input
        id="category"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        required
        placeholder="e.g. Timing, Documentation, Fraud History"
      />

      <label htmlFor="conditionField">Field</label>
      <select
        id="conditionField"
        value={conditionField}
        onChange={(e) => setConditionField(e.target.value)}
      >
        {CONDITION_FIELDS[stage].map((field) => (
          <option key={field} value={field}>
            {field}
          </option>
        ))}
      </select>

      <label htmlFor="conditionOperator">Operator</label>
      <select
        id="conditionOperator"
        value={conditionOperator}
        onChange={(e) => setConditionOperator(e.target.value)}
      >
        {OPERATORS.map((op) => (
          <option key={op} value={op}>
            {op}
          </option>
        ))}
      </select>

      <label htmlFor="conditionThreshold">Threshold</label>
      <input
        id="conditionThreshold"
        value={conditionThreshold}
        onChange={(e) => setConditionThreshold(e.target.value)}
        required
        placeholder="numeric value"
      />

      <label htmlFor="severity">Severity</label>
      <select
        id="severity"
        value={severity}
        onChange={(e) => setSeverity(Number(e.target.value))}
      >
        <option value={ScoringSeverity.Soft}>{SEVERITY_LABEL[ScoringSeverity.Soft]}</option>
        <option value={ScoringSeverity.Hard}>{SEVERITY_LABEL[ScoringSeverity.Hard]}</option>
      </select>

      {severity !== ScoringSeverity.Hard && (
        <>
          <label htmlFor="points">Points</label>
          <input
            id="points"
            type="number"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
          />
        </>
      )}

      {error && <p className="error-text">{error}</p>}

      <button type="submit" disabled={saving}>
        {saving ? 'Saving…' : 'Save'}
      </button>{' '}
      <button type="button" onClick={onCancel} disabled={saving}>
        Cancel
      </button>
    </form>
  )
}