import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, FileSpreadsheet, FolderOpen } from 'lucide-react'
import {
  ApiError,
  downloadClaimsReportCsv,
  fetchClaimsReportRows,
  getClaimsHandlerAllClaims,
} from '../lib/api'
import type { ClaimsHandlerClaimListItem } from '../lib/api'
import { SkeletonBlock } from '../components/Skeleton'

const REPORT_PREVIEW_LIMIT = 8

// Reports used to live partway down the Claims Handler Dashboard,
// reached by scrolling (or a ?view=reports query param that auto-
// scrolled to it). Pulled into its own page, same as Track Claim and
// Claims - the sidebar's "Reports" link goes straight here now.
export function ReportsPage() {
  const navigate = useNavigate()

  const [claims, setClaims] = useState<ClaimsHandlerClaimListItem[] | null>(null)

  const [reportStatus, setReportStatus] = useState<string>('all')
  const [reportDownloading, setReportDownloading] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)

  const [previewHeaders, setPreviewHeaders] = useState<string[]>([])
  const [previewRows, setPreviewRows] = useState<string[][]>([])
  const [previewLoading, setPreviewLoading] = useState(true)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const handleDownloadReport = async () => {
    setReportDownloading(true)
    setReportError(null)
    try {
      await downloadClaimsReportCsv(reportStatus)
    } catch (err) {
      setReportError(err instanceof ApiError ? err.message : 'Failed to download report.')
    } finally {
      setReportDownloading(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    getClaimsHandlerAllClaims()
      .then((claimsData) => {
        if (!cancelled) setClaims(claimsData)
      })
      .catch(() => {
        // Non-fatal here - only used to make report rows clickable
        // through to the matching claim's detail page. If it fails,
        // rows just aren't clickable; the report itself still loads.
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setPreviewLoading(true)
    setPreviewError(null)

    fetchClaimsReportRows(reportStatus)
      .then(({ headers, rows }) => {
        if (cancelled) return
        setPreviewHeaders(headers)
        setPreviewRows(rows)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setPreviewError(err instanceof ApiError ? err.message : 'Failed to load report preview.')
        }
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [reportStatus])

  return (
    <div>
      <h1>Reports</h1>
      <p className="subtitle">Export claim-level reporting data, or preview it here first.</p>

      <section className="card">
        <div className="handler-queue-header">
          <h2>
            <FileSpreadsheet size={17} style={{ verticalAlign: '-3px', marginRight: '0.4rem' }} />
            Reports
          </h2>
          <div className="handler-queue-controls">
            <select
              value={reportStatus}
              onChange={(e) => setReportStatus(e.target.value)}
              className="handler-report-filter"
            >
              <option value="all">All claims</option>
              <option value="registered">Registered only</option>
              <option value="paid">Paid only</option>
              <option value="outstanding">Outstanding only</option>
            </select>
            <button type="button" onClick={() => void handleDownloadReport()} disabled={reportDownloading}>
              <Download size={14} style={{ verticalAlign: '-2px', marginRight: '0.3rem' }} />
              {reportDownloading ? 'Preparing…' : 'Export CSV'}
            </button>
          </div>
        </div>
        <p>Claim number, status, payment status, registered date, total TAT, and SLA status for your claims.</p>
        {reportError && <p className="error-text">{reportError}</p>}
        {previewError && <p className="error-text">{previewError}</p>}
        {previewLoading && <SkeletonBlock lines={3} />}
        {!previewLoading && !previewError && previewRows.length === 0 && (
          <div className="empty-state">
            <span className="empty-state-icon">
              <FolderOpen size={20} />
            </span>
            <span className="empty-state-title">No claims to report</span>
            <p>No claims match this report filter yet — try a different status.</p>
          </div>
        )}
        {!previewLoading && !previewError && previewRows.length > 0 && (
          <div className="queue-table-wrap reports-table-wrap">
            <table className="queue-table">
              <thead>
                <tr>
                  {previewHeaders.map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.slice(0, REPORT_PREVIEW_LIMIT).map((row, i) => {
                  // Column 0 is always Claim Number (see
                  // ClaimReportService.BuildReportRows) - match it back
                  // against the claims list loaded on this page to
                  // find the claimId to navigate to.
                  const matchedClaim = claims?.find((c) => c.claimNumber === row[0])

                  return (
                    <tr
                      key={i}
                      className={matchedClaim ? 'clickable-row' : undefined}
                      onClick={
                        matchedClaim
                          ? () => navigate(`/claims/${matchedClaim.claimId}`)
                          : undefined
                      }
                    >
                      {row.map((cell, j) => (
                        <td key={j}>{cell}</td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {previewRows.length > REPORT_PREVIEW_LIMIT && (
              <p className="subtitle" style={{ marginTop: '0.6rem' }}>
                Showing {REPORT_PREVIEW_LIMIT} of {previewRows.length} rows — use Export CSV for the full report.
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  )
}