import { useEffect, useRef, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { ApiError, sendOtp, verifyOtp } from '../lib/api'
import { OtpPurpose } from '../lib/statuses'
import { OtpInput, type OtpInputStatus } from '../components/OtpInput'
import { RoleId } from '../lib/roles'
import loginIllustration from '../assets/login-illustration-light.svg'

export function LoginOtpPage() {
  const { session, loading, roleId, otpVerified, markOtpVerified } = useAuth()
  const { showToast } = useToast()
  const location = useLocation()

  const [code, setCode] = useState('')
  const [status, setStatus] = useState<OtpInputStatus>('idle')
  const [sending, setSending] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const sentRef = useRef(false)

  useEffect(() => {
    if (sentRef.current || !session) return
    sentRef.current = true

    sendOtp(OtpPurpose.Login)
      .then((result) => {
        showToast(result.message, 'info')
        if (result.devModeCode) {
          showToast(`Dev OTP: ${result.devModeCode}`, 'info')
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : 'Failed to send OTP.')
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
      setError(err instanceof ApiError ? err.message : 'Failed to verify OTP.')
      setCode('')
    }
  }

  return (
    <div className="login-page">
      <div className="login-page-left" aria-hidden="true">
        <img src={loginIllustration} alt="" className="login-illustration" />
      </div>

      <div className="login-page-right">
        <motion.div
          className="login-card"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <h1>Verify it's you</h1>
          <p className="subtitle">
            {sending ? 'Sending a one-time code…' : 'Enter the 6-digit code sent to you.'}
          </p>
          <OtpInput value={code} onChange={setCode} onComplete={handleComplete} status={status} />
          {error && <p className="error-text">{error}</p>}
        </motion.div>
      </div>
    </div>
  )
}