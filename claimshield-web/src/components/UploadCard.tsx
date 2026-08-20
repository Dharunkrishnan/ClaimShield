import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { FileText, Check } from 'lucide-react'
import { ApiError, getDocumentOcrPreview, uploadClaimDocumentWithProgress } from '../lib/api'
import type { ClaimDocumentResponseDto, OcrExtractionResult } from '../lib/types'

export function UploadCard({
  label,
  claimId,
  documentTypeId,
  onUploaded,
  extractOcr = false,
  onOcrExtracted,
}: {
  label: string
  claimId: string
  documentTypeId: number
  onUploaded: (doc: ClaimDocumentResponseDto) => void
  /** When true, runs OCR on the upload and reports the result via onOcrExtracted. */
  extractOcr?: boolean
  /** Called once OCR finishes (or fails, with null) - the parent owns any popup UI. */
  onOcrExtracted?: (result: OcrExtractionResult | null) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isImage, setIsImage] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  // Revoke the object URL when the component unmounts or the file changes,
  // so we don't leak memory across a long wizard session.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const handleSelect = async (file: File) => {
    setFileName(file.name)
    setStatus('uploading')
    setProgress(0)
    setError(null)

    const fileIsImage = file.type.startsWith('image/')
    setIsImage(fileIsImage)
    setPreviewUrl(fileIsImage ? URL.createObjectURL(file) : null)

    try {
      const doc = await uploadClaimDocumentWithProgress(
        claimId,
        documentTypeId,
        file,
        setProgress,
      )
      setStatus('done')
      onUploaded(doc)

      if (extractOcr) {
        try {
          const result = await getDocumentOcrPreview(doc.claimDocumentId)
          onOcrExtracted?.(result)
        } catch {
          // OCR preview is best-effort - the upload itself already
          // succeeded, so we just report "nothing extracted" rather
          // than fail the upload.
          onOcrExtracted?.(null)
        }
      }
    } catch (err) {
      setStatus('error')
      setError(err instanceof ApiError ? err.message : 'Upload failed.')
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
          <div className="upload-card-thumb-wrap">
            {isImage && previewUrl ? (
              <img src={previewUrl} alt={label} className="upload-card-thumb" />
            ) : (
              <span className="upload-card-thumb-fallback">
                <FileText size={22} />
              </span>
            )}

            {status === 'done' && (
              <motion.span
                className="upload-card-thumb-check"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 20 }}
              >
                <Check size={13} />
              </motion.span>
            )}
          </div>

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

          {status === 'error' && <span className="error-text">{error}</span>}
        </motion.div>
      )}
    </div>
  )
}