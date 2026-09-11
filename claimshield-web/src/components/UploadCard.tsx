import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { FileText, Check, Camera, Upload, AlertCircle, RefreshCw, ScanLine, Loader2 } from 'lucide-react'
import { ApiError, getDocumentOcrPreview, uploadClaimDocumentWithProgress } from '../lib/api'
import type { ClaimDocumentResponseDto, OcrExtractionResult } from '../lib/types'
import { LiveCameraModal } from './LiveCameraModal'

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
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [fileName, setFileName] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isImage, setIsImage] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrResult, setOcrResult] = useState<OcrExtractionResult | null>(null)
  const [extractedValue, setExtractedValue] = useState<string | null>(null)
  const [showLiveCam, setShowLiveCam] = useState(false)

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
    setExtractedValue(null)
    setOcrResult(null)

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
        setOcrLoading(true)
        try {
          const result = await getDocumentOcrPreview(doc.claimDocumentId)
          setOcrResult(result)
          if (result?.registrationNumber) {
            setExtractedValue(result.registrationNumber)
          } else if (result?.chassisNumber) {
            setExtractedValue(`Chassis: ${result.chassisNumber}`)
          }
          onOcrExtracted?.(result)
        } catch {
          // OCR preview is best-effort - the upload itself already
          // succeeded, so we just report "nothing extracted" rather
          // than fail the upload.
          onOcrExtracted?.(null)
        } finally {
          setOcrLoading(false)
        }
      }
    } catch (err) {
      setStatus('error')
      setError(err instanceof ApiError ? err.message : 'Upload failed.')
    }
  }

  return (
    <>
      <div
        className={`upload-card upload-card-${status} ${isDragging ? 'upload-card-dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setIsDragging(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setIsDragging(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setIsDragging(false)
          const file = e.dataTransfer.files?.[0]
          if (file) void handleSelect(file)
        }}
      >
        {/* Standard File Picker input (opens gallery / file manager / PDFs) */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleSelect(file)
            e.target.value = ''
          }}
        />

        <div className="upload-card-header">
          <span className="upload-card-label">{label}</span>
        </div>

        {status === 'idle' && !fileName && (
          <div className="upload-card-idle-body">
            <div className="upload-card-icon-bubble">
              <Camera size={18} className="upload-icon-cam" />
            </div>
            <span className="upload-card-subhint">Live photo or browse</span>
            <div className="upload-card-actions">
              <button
                type="button"
                className="upload-action-btn upload-action-camera"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowLiveCam(true)
                }}
                title="Click live picture with camera / webcam"
              >
                <Camera size={13} />
                <span>Camera</span>
              </button>

              <button
                type="button"
                className="upload-action-btn upload-action-browse"
                onClick={(e) => {
                  e.stopPropagation()
                  fileInputRef.current?.click()
                }}
                title="Upload existing photo or file"
              >
                <Upload size={13} />
                <span>Upload</span>
              </button>
            </div>
          </div>
        )}

        {fileName && (
          <motion.div
            className="upload-card-file"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
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
                  <Check size={12} />
                </motion.span>
              )}
            </div>

            <span className="upload-card-filename" title={fileName}>{fileName}</span>

            {ocrLoading && (
              <div className="upload-card-ocr-status upload-card-ocr-scanning">
                <Loader2 size={11} className="upload-ocr-spinner" />
                <span>Scanning document / plate…</span>
              </div>
            )}

            {!ocrLoading && ocrResult && (
              <div className="upload-card-ocr-details">
                {documentTypeId === 2 || label.toLowerCase().includes('rc') ? (
                  <motion.div
                    className="upload-rc-badge-box"
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                  >
                    {ocrResult.registrationNumber && (
                      <div className="upload-rc-badge-row">
                        <span className="upload-rc-badge-lbl">RC No:</span>
                        <strong className="font-mono">{ocrResult.registrationNumber}</strong>
                      </div>
                    )}
                    {ocrResult.engineNumber && (
                      <div className="upload-rc-badge-row">
                        <span className="upload-rc-badge-lbl">Engine:</span>
                        <strong className="font-mono">{ocrResult.engineNumber}</strong>
                      </div>
                    )}
                    {ocrResult.chassisNumber && (
                      <div className="upload-rc-badge-row">
                        <span className="upload-rc-badge-lbl">Chassis:</span>
                        <strong className="font-mono">{ocrResult.chassisNumber}</strong>
                      </div>
                    )}
                    {!ocrResult.registrationNumber && !ocrResult.engineNumber && !ocrResult.chassisNumber && (
                      <span className="upload-rc-badge-none">No vehicle details detected</span>
                    )}
                  </motion.div>
                ) : (
                  ocrResult.registrationNumber ? (
                    <motion.div
                      className="upload-card-ocr-status upload-card-ocr-matched"
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                    >
                      <ScanLine size={11} />
                      <span>Plate: <strong>{ocrResult.registrationNumber}</strong></span>
                    </motion.div>
                  ) : (
                    <div className="upload-card-ocr-status upload-card-ocr-neutral">
                      <span>Plate not detected in photo</span>
                    </div>
                  )
                )}
              </div>
            )}

            {!ocrLoading && !ocrResult && extractedValue && (
              <motion.div
                className="upload-card-ocr-status upload-card-ocr-matched"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
              >
                <ScanLine size={11} />
                <span>Detected: <strong>{extractedValue}</strong></span>
              </motion.div>
            )}

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
              <div className="upload-card-retake-actions">
                <button
                  type="button"
                  className="upload-mini-btn upload-mini-camera"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowLiveCam(true)
                  }}
                  title="Retake live photo with camera"
                >
                  <Camera size={11} />
                  <span>Retake</span>
                </button>
                <button
                  type="button"
                  className="upload-mini-btn upload-mini-browse"
                  onClick={(e) => {
                    e.stopPropagation()
                    fileInputRef.current?.click()
                  }}
                  title="Choose another file"
                >
                  <Upload size={11} />
                  <span>Change</span>
                </button>
              </div>
            )}

            {status === 'error' && (
              <div className="upload-card-error-box">
                <span className="error-text">
                  <AlertCircle size={12} /> {error}
                </span>
                <div className="upload-card-retake-actions">
                  <button
                    type="button"
                    className="upload-mini-btn upload-mini-camera"
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowLiveCam(true)
                    }}
                  >
                    <RefreshCw size={11} />
                    <span>Retry Cam</span>
                  </button>
                  <button
                    type="button"
                    className="upload-mini-btn upload-mini-browse"
                    onClick={(e) => {
                      e.stopPropagation()
                      fileInputRef.current?.click()
                    }}
                  >
                    <Upload size={11} />
                    <span>Retry File</span>
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Live Camera Viewfinder Modal for Laptop / Mobile */}
      <LiveCameraModal
        isOpen={showLiveCam}
        onClose={() => setShowLiveCam(false)}
        onCapture={(file) => void handleSelect(file)}
        label={label}
      />
    </>
  )
}