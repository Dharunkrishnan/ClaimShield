import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Eye } from 'lucide-react'
import { ApiError, getDocumentDownloadUrl, uploadClaimDocumentWithProgress } from '../lib/api'
import type { ClaimDocumentResponseDto } from '../lib/types'

export function UploadCard({
  label,
  claimId,
  documentTypeId,
  onUploaded,
  existingDocument,
}: {
  label: string
  claimId: string
  documentTypeId: number
  onUploaded: (doc: ClaimDocumentResponseDto) => void
  // Lets the parent tell this card "a document already exists for
  // this slot" (matched by documentTypeId, from whatever document
  // list the parent already fetches for the claim) - without this,
  // every field/status here starts blank on every mount, so
  // navigating away and back (or a plain page refresh) makes an
  // already-uploaded document invisible: no filename, no "done"
  // state, and therefore no View button either, even though the file
  // genuinely still exists on the server.
  existingDocument?: ClaimDocumentResponseDto | null
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(
    existingDocument?.originalFileName ?? null,
  )
  const [uploadedDoc, setUploadedDoc] = useState<ClaimDocumentResponseDto | null>(
    existingDocument ?? null,
  )
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>(
    existingDocument ? 'done' : 'idle',
  )
  const [error, setError] = useState<string | null>(null)
  const [viewLoading, setViewLoading] = useState(false)

  // existingDocument can arrive after this card's first render (the
  // parent fetches the claim's document list asynchronously, so it's
  // very often still empty on mount) - sync state once it actually
  // shows up, rather than only reading it at the moment of the very
  // first render via the useState initializers above.
  useEffect(() => {
    if (existingDocument && status !== 'uploading') {
      setFileName(existingDocument.originalFileName)
      setUploadedDoc(existingDocument)
      setStatus('done')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingDocument?.claimDocumentId])

  const handleSelect = async (file: File) => {
    setFileName(file.name)
    setUploadedDoc(null)
    setStatus('uploading')
    setProgress(0)
    setError(null)

    try {
      const doc = await uploadClaimDocumentWithProgress(
        claimId,
        documentTypeId,
        file,
        setProgress,
      )
      setStatus('done')
      setUploadedDoc(doc)
      onUploaded(doc)
    } catch (err) {
      setStatus('error')
      setError(err instanceof ApiError ? err.message : 'Upload failed.')
    }
  }

  const handleView = async (event: React.MouseEvent) => {
    // Don't let this bubble up to the card's own onClick, which opens
    // the file picker for re-uploading - viewing and replacing are
    // two different actions sharing the same card.
    event.stopPropagation()
    if (!uploadedDoc || viewLoading) return

    setViewLoading(true)
    try {
      const { url } = await getDocumentDownloadUrl(uploadedDoc.claimDocumentId)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      setError('Could not open the file. Try again.')
    } finally {
      setViewLoading(false)
    }
  }

  return (
    <div
      className={`upload-card upload-card-${status}`}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleSelect(file)
        }}
      />

      <span className="upload-card-label">{label}</span>

      {!fileName && <span className="upload-card-hint">Tap to upload</span>}

      {fileName && (
        <motion.div
          className="upload-card-file"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 24 }}
        >
          <span className="upload-card-filename">{fileName}</span>

          {status === 'uploading' && (
            <div className="upload-card-progress-track">
              <motion.div
                className="upload-card-progress-fill"
                animate={{ width: `${progress}%` }}
                transition={{ ease: 'easeOut', duration: 0.2 }}
              />
            </div>
          )}

          {status === 'done' && (
            <motion.div
              className="upload-card-done-row"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 20 }}
            >
              <span className="upload-card-done-label">✓ Uploaded</span>
              {uploadedDoc && (
                <button
                  type="button"
                  className="upload-card-view-link"
                  onClick={(e) => void handleView(e)}
                  disabled={viewLoading}
                >
                  <Eye size={13} /> {viewLoading ? 'Opening…' : 'View'}
                </button>
              )}
            </motion.div>
          )}

          {status === 'error' && <span className="error-text">{error}</span>}
        </motion.div>
      )}
    </div>
  )
}