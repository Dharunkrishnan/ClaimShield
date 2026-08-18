
import { useEffect, useRef, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { ApiError, sendOtp, verifyOtp } from '../lib/api'
import { OtpPurpose } from '../lib/statuses'
import { OtpInput, type OtpInputStatus } from '../components/OtpInput'
import { RoleId } from '../lib/roles'

export function LoginOtpPage() {
  const { session, loading, roleId, otpVerified, markOtpVerified } = useAuth()
  const { showToast } = useToast()
  const location = useLocation()

  const [code, setCode] = useState('')
  const [status, setStatus] = useState<OtpInputStatus>('idle')
  const [sending, setSending] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [devOtp, setDevOtp] = useState<string | null>(null)
  const sentRef = useRef(false)

  useEffect(() => {
    if (sentRef.current || !session) return

    sentRef.current = true

    sendOtp(OtpPurpose.Login)
      .then((result) => {
        showToast(result.message, 'info')

        // In development mode the backend returns the generated OTP.
        // Display it directly on this verification page for testing.
        if (result.devModeCode) {
          setDevOtp(result.devModeCode)
        }
      })
      .catch((err: unknown) => {
        setError(
          err instanceof ApiError ? err.message : 'Failed to send OTP.',
        )
      })
      .finally(() => setSending(false))
  }, [session, showToast])

  if (loading) {
    return <div className="centered-page">Loading…</div>
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (roleId !== RoleId.Customer || otpVerified) {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from ?? '/'} replace />
  }

  const handleComplete = async (value: string) => {
    setError(null)

    try {
      const result = await verifyOtp(OtpPurpose.Login, value)

      if (!result.success) {
        setStatus('error')
        setError(result.message)
        setCode('')
        return
      }

      setStatus('success')
      showToast('OTP verified successfully.', 'success')

      // Brief pause so the success checkmark animation is actually seen
      // before the redirect away from this screen.
      await new Promise((resolve) => setTimeout(resolve, 600))

      markOtpVerified()
    } catch (err) {
      setStatus('error')
      setError(
        err instanceof ApiError ? err.message : 'Failed to verify OTP.',
      )
      setCode('')
    }
  }

  return (
    <div className="login-page">
      <div className="login-page-pattern" aria-hidden="true" />

      <motion.div
        className="login-blob login-blob-1"
        aria-hidden="true"
        animate={{ x: [0, 36, -18, 0], y: [0, -26, 18, 0] }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      <motion.div
        className="login-blob login-blob-2"
        aria-hidden="true"
        animate={{ x: [0, -44, 26, 0], y: [0, 34, -18, 0] }}
        transition={{
          duration: 27,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      <motion.div
        className="login-card"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.5,
          ease: [0.16, 1, 0.3, 1],
        }}
      >
        <h1>Verify it's you</h1>

        <p className="subtitle">
          {sending
            ? 'Generating a one-time code…'
            : 'Enter the 6-digit code sent to you.'}
        </p>

        {devOtp && (
          <div
            className="dev-otp"
            style={{
              margin: '12px 0 20px',
              padding: '12px 16px',
              borderRadius: '10px',
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: '12px',
                fontWeight: 600,
                marginBottom: '4px',
                opacity: 0.7,
              }}
            >
              Development OTP
            </div>

            <strong
              style={{
                fontSize: '24px',
                letterSpacing: '5px',
              }}
            >
              {devOtp}
            </strong>
          </div>
        )}

        <OtpInput
          value={code}
          onChange={setCode}
          onComplete={handleComplete}
          status={status}
        />

        {error && <p className="error-text">{error}</p>}
      </motion.div>
    </div>
  )
}
