import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { RoleId } from '../lib/roles'
import { supabase } from '../lib/supabaseClient'
import loginIllustration from '../assets/login-illustration-light.svg'

export function LoginPage() {
  const { session, loading, roleId, otpVerified, signIn } = useAuth()
  const { showToast } = useToast()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [shakeKey, setShakeKey] = useState(0)

  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSubmitting, setResetSubmitting] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  if (!loading && session) {
    const from = (location.state as { from?: string } | null)?.from

    if (roleId === RoleId.Customer && !otpVerified) {
      return <Navigate to="/login/otp" state={{ from }} replace />
    }

    return <Navigate to={from ?? '/'} replace />
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    const { error: signInError } = await signIn(email, password)

    setSubmitting(false)

    if (signInError) {
      setError(signInError)
      setShakeKey((k) => k + 1)
    }
  }

  // Uses Supabase Auth's own password-recovery email directly - no
  // dedicated backend endpoint needed for this half. NOTE: there is no
  // "choose a new password" page in this app yet for the emailed link
  // to land on, so the recovery email itself will send successfully,
  // but completing a reset end-to-end needs that follow-up page built
  // separately.
  const handleForgotPassword = async (event: FormEvent) => {
    event.preventDefault()
    setResetSubmitting(true)
    setResetError(null)

    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(resetEmail.trim())

    setResetSubmitting(false)

    if (resetErr) {
      setResetError(resetErr.message)
      return
    }

    showToast('If an account exists for that email, a reset link has been sent.', 'info')
    setShowForgotPassword(false)
    setResetEmail('')
  }

  return (
    <div className="login-page">
      <div className="login-page-left" aria-hidden="true">
        <img src={loginIllustration} alt="" className="login-illustration" />
      </div>

      <div className="login-page-right">
        {showForgotPassword ? (
          <motion.form
            className="login-card"
            onSubmit={handleForgotPassword}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <h1>Reset your password</h1>
            <p className="subtitle">Enter your email and we&apos;ll send you a reset link.</p>

            <label htmlFor="reset-email">Email</label>
            <input
              id="reset-email"
              type="email"
              autoComplete="username"
              value={resetEmail}
              onChange={(event) => setResetEmail(event.target.value)}
              required
            />

            {resetError && <p className="error-text">{resetError}</p>}

            <motion.button
              type="submit"
              disabled={resetSubmitting}
              whileHover={{ scale: resetSubmitting ? 1 : 1.02 }}
              whileTap={{ scale: resetSubmitting ? 1 : 0.98 }}
            >
              {resetSubmitting ? 'Sending…' : 'Send reset link'}
            </motion.button>

            <button
              type="button"
              className="login-link-button"
              onClick={() => {
                setShowForgotPassword(false)
                setResetError(null)
              }}
            >
              Back to sign in
            </button>
          </motion.form>
        ) : (
          <motion.form
            className="login-card"
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <motion.div
              className="login-mark"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.4, ease: 'backOut' }}
            >
              <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M24 4 8 10v12c0 11 7 17.6 16 22 9-4.4 16-11 16-22V10L24 4Z"
                  fill="var(--color-primary)"
                  opacity="0.12"
                />
                <path
                  d="M24 4 8 10v12c0 11 7 17.6 16 22 9-4.4 16-11 16-22V10L24 4Z"
                  stroke="var(--color-primary)"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
                <path
                  d="M17 24.5 21.7 29 31.5 18.5"
                  stroke="var(--color-primary)"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </motion.div>

            <h1>ClaimShield</h1>
            <p className="subtitle">Surveyor / Approver / Repairer portal</p>

            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />

            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />

            <AnimatePresence mode="wait">
              {error && (
                <motion.p
                  key={shakeKey}
                  className="error-text"
                  initial={{ x: 0 }}
                  animate={{ x: [0, -8, 8, -6, 6, -3, 3, 0] }}
                  transition={{ duration: 0.4 }}
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <motion.button
              type="submit"
              disabled={submitting}
              whileHover={{ scale: submitting ? 1 : 1.02 }}
              whileTap={{ scale: submitting ? 1 : 0.98 }}
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </motion.button>

            <button
              type="button"
              className="login-link-button"
              onClick={() => setShowForgotPassword(true)}
            >
              Forgot password?
            </button>
          </motion.form>
        )}
      </div>
    </div>
  )
}