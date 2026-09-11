import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Camera,
  X,
  RotateCw,
  Check,
  AlertCircle,
  RefreshCw,
  Maximize2,
  FolderOpen,
} from 'lucide-react'

interface LiveCameraModalProps {
  isOpen: boolean
  onClose: () => void
  onCapture: (file: File) => void
  label: string
}

export function LiveCameraModal({
  isOpen,
  onClose,
  onCapture,
  label,
}: LiveCameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
  const [capturedPreviewUrl, setCapturedPreviewUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [flashEffect, setFlashEffect] = useState(false)

  // Stop camera tracks cleanly
  const stopTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [])

  // Start the video stream with optimal constraints and fallbacks
  const startCamera = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    stopTracks()

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError(
        'Camera API is not supported in this browser. Please use standard file upload.',
      )
      setIsLoading(false)
      return
    }

    try {
      // 1. Try with selected device or preferred facing mode
      let constraints: MediaStreamConstraints = selectedDeviceId
        ? { video: { deviceId: { exact: selectedDeviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } } }
        : { video: { facingMode: facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } } }

      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints)
      } catch (firstErr) {
        console.warn('Initial camera constraint failed, trying generic video constraints:', firstErr)
        // Fallback for laptops where 'environment' is unavailable or resolution is constrained
        constraints = { video: true }
        stream = await navigator.mediaDevices.getUserMedia(constraints)
      }

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }

      // Enumerate camera devices for multi-camera switching
      try {
        const allDevices = await navigator.mediaDevices.enumerateDevices()
        const videoDevices = allDevices.filter((d) => d.kind === 'videoinput')
        setDevices(videoDevices)
      } catch {
        // Enumerate is best-effort
      }

      setIsLoading(false)
    } catch (err: unknown) {
      console.error('Camera access error:', err)
      const message =
        err instanceof Error
          ? err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
            ? 'Camera permission was denied. Please allow camera access in your browser settings to capture photos.'
            : err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError'
              ? 'No camera was found on your device. Please connect a webcam or upload a file.'
              : `Unable to access camera: ${err.message}`
          : 'Unable to start camera stream.'
      setError(message)
      setIsLoading(false)
    }
  }, [facingMode, selectedDeviceId, stopTracks])

  // Initialize camera when modal opens
  useEffect(() => {
    if (isOpen) {
      setCapturedBlob(null)
      setCapturedPreviewUrl(null)
      void startCamera()
    } else {
      stopTracks()
      if (capturedPreviewUrl) {
        URL.revokeObjectURL(capturedPreviewUrl)
        setCapturedPreviewUrl(null)
      }
    }

    return () => {
      stopTracks()
    }
  }, [isOpen, startCamera, stopTracks])

  // Handle capture click
  const handleSnap = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const width = video.videoWidth || 1280
    const height = video.videoHeight || 720

    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Draw frame to canvas
    ctx.drawImage(video, 0, 0, width, height)

    // Flash visual animation
    setFlashEffect(true)
    setTimeout(() => setFlashEffect(false), 180)

    canvas.toBlob(
      (blob) => {
        if (!blob) return
        setCapturedBlob(blob)
        const url = URL.createObjectURL(blob)
        setCapturedPreviewUrl(url)
        stopTracks()
      },
      'image/jpeg',
      0.92,
    )
  }

  // Handle Retake
  const handleRetake = () => {
    if (capturedPreviewUrl) {
      URL.revokeObjectURL(capturedPreviewUrl)
      setCapturedPreviewUrl(null)
    }
    setCapturedBlob(null)
    void startCamera()
  }

  // Handle Confirm
  const handleConfirm = () => {
    if (!capturedBlob) return

    const timestamp = Date.now()
    const cleanLabel = label.toLowerCase().replace(/[^a-z0-9]/g, '_')
    const fileName = `live_cam_${cleanLabel}_${timestamp}.jpg`
    const file = new File([capturedBlob], fileName, { type: 'image/jpeg' })

    onCapture(file)
    onClose()
  }

  // Toggle Camera Facing Mode (Front vs Back) or Switch Device
  const handleToggleCamera = () => {
    if (devices.length > 1) {
      const currentIndex = devices.findIndex((d) => d.deviceId === selectedDeviceId)
      const nextIndex = (currentIndex + 1) % devices.length
      setSelectedDeviceId(devices[nextIndex].deviceId)
    } else {
      setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="live-cam-overlay" role="dialog" aria-modal="true">
        <motion.div
          className="live-cam-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => {
            stopTracks()
            onClose()
          }}
        />

        <motion.div
          className="live-cam-container"
          initial={{ scale: 0.92, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 16 }}
          transition={{ type: 'spring', stiffness: 350, damping: 26 }}
        >
          {/* Header */}
          <div className="live-cam-header">
            <div className="live-cam-header-info">
              <span className="live-cam-badge">
                <Camera size={13} />
                <span>Live Viewfinder</span>
              </span>
              <h3 className="live-cam-title">{label}</h3>
            </div>

            <button
              type="button"
              className="live-cam-close-btn"
              onClick={() => {
                stopTracks()
                onClose()
              }}
              title="Close camera"
            >
              <X size={18} />
            </button>
          </div>

          {/* Viewfinder Body */}
          <div className="live-cam-viewfinder-wrap">
            {/* Shutter Flash Animation */}
            {flashEffect && <div className="live-cam-flash" />}

            {/* Error View */}
            {error && (
              <div className="live-cam-error-state">
                <AlertCircle size={38} className="live-cam-error-icon" />
                <h4>Camera Access Required</h4>
                <p>{error}</p>
                <div className="live-cam-error-actions">
                  <button
                    type="button"
                    className="live-cam-btn live-cam-btn-retry"
                    onClick={() => void startCamera()}
                  >
                    <RefreshCw size={14} /> Retry Camera
                  </button>
                  <button
                    type="button"
                    className="live-cam-btn live-cam-btn-file"
                    onClick={() => {
                      stopTracks()
                      onClose()
                    }}
                  >
                    <FolderOpen size={14} /> Upload from Files
                  </button>
                </div>
              </div>
            )}

            {/* Live Video Feed */}
            {!error && !capturedPreviewUrl && (
              <div className="live-cam-feed-container">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="live-cam-video"
                />

                {isLoading && (
                  <div className="live-cam-loading-overlay">
                    <RefreshCw size={26} className="live-cam-spin" />
                    <span>Connecting to laptop / device camera…</span>
                  </div>
                )}

                {/* Framing Guidelines Overlay */}
                <div className="live-cam-framing-box">
                  <span className="frame-corner corner-tl" />
                  <span className="frame-corner corner-tr" />
                  <span className="frame-corner corner-bl" />
                  <span className="frame-corner corner-br" />
                  <div className="frame-center-crosshair">
                    <Maximize2 size={22} />
                  </div>
                </div>

                <div className="live-cam-guidance-pill">
                  Align {label.toLowerCase()} inside the frame and capture
                </div>
              </div>
            )}

            {/* Captured Photo Preview */}
            {!error && capturedPreviewUrl && (
              <div className="live-cam-preview-container">
                <img
                  src={capturedPreviewUrl}
                  alt="Captured vehicle photo"
                  className="live-cam-preview-img"
                />
                <div className="live-cam-preview-badge">
                  <Check size={13} /> Photo Captured
                </div>
              </div>
            )}

            {/* Hidden Canvas for High-Resolution Snapshot */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>

          {/* Controls Bar */}
          <div className="live-cam-controls">
            {!error && !capturedPreviewUrl && (
              <>
                <button
                  type="button"
                  className="live-cam-switch-btn"
                  onClick={handleToggleCamera}
                  title="Switch camera / flip"
                >
                  <RotateCw size={18} />
                  <span>Flip Cam</span>
                </button>

                <button
                  type="button"
                  className="live-cam-shutter-btn"
                  onClick={handleSnap}
                  disabled={isLoading}
                  title="Snap photo"
                >
                  <span className="live-cam-shutter-outer">
                    <span className="live-cam-shutter-inner" />
                  </span>
                </button>

                <div className="live-cam-controls-spacer" />
              </>
            )}

            {!error && capturedPreviewUrl && (
              <div className="live-cam-review-actions">
                <button
                  type="button"
                  className="live-cam-btn live-cam-btn-retake"
                  onClick={handleRetake}
                >
                  <RefreshCw size={15} /> Retake
                </button>

                <button
                  type="button"
                  className="live-cam-btn live-cam-btn-use"
                  onClick={handleConfirm}
                >
                  <Check size={16} /> Use This Photo
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
