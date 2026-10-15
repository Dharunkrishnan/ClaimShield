import { useState, useRef, useEffect, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { RoleId } from '../lib/roles'
import { supabase } from '../lib/supabaseClient'
import './LoginPage.css'

/* ─── Inline SVG icon primitives ────────────────────────────────── */

function IconMail() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="3" />
      <path d="M2 7l10 7 10-7" />
    </svg>
  )
}

function IconLock() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function IconEye({ visible }: { visible: boolean }) {
  return visible ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12C3.5 6.5 9.5 3 12 3s8.5 3.5 11 9c-2.5 5.5-8.5 9-11 9S3.5 17.5 1 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-2.5 0-8.5-3.5-11-9a18.45 18.45 0 0 1 5.06-6.06M9.9 4.24A9.12 9.12 0 0 1 12 4c2.5 0 8.5 3.5 11 9a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

function IconArrowLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  )
}

function IconShieldTick({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-label="ClaimShield+ logo"
    >
      <defs>
        <linearGradient id="lp-shield-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2563c7" />
          <stop offset="100%" stopColor="#123b5d" />
        </linearGradient>
      </defs>
      <path
        d="M24 3 L41 9.5 V22 C41 32.5 34 40.5 24 45 C14 40.5 7 32.5 7 22 V9.5 Z"
        fill="url(#lp-shield-grad)"
        stroke="#123b5d"
        strokeWidth="1"
      />
      <path
        d="M15.5 23.5 L21 29 L33 16"
        fill="none"
        stroke="#ffffff"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/* The same shield but white/glowing for the dark left panel center */
function IconShieldTickDark({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-label="ClaimShield+ logo"
    >
      <defs>
        <linearGradient id="lp-shield-dark-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3ba5ff" />
          <stop offset="100%" stopColor="#0565ec" />
        </linearGradient>
      </defs>
      <path
        d="M24 3 L41 9.5 V22 C41 32.5 34 40.5 24 45 C14 40.5 7 32.5 7 22 V9.5 Z"
        fill="url(#lp-shield-dark-grad)"
        stroke="rgba(59,165,255,0.3)"
        strokeWidth="1"
      />
      <path
        d="M15.5 23.5 L21 29 L33 16"
        fill="none"
        stroke="#ffffff"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/* ─── Claim security animation ───────────────────────────────────── */

function ClaimSecurityVis() {
  return (
    <div className="lp-vis" role="presentation" aria-hidden="true">
      {/* Concentric rings */}
      <div className="lp-rings">
        <div className="lp-ring lp-ring-1">
          <div className="lp-orbit-dot lp-orbit-dot-1" />
          <div className="lp-orbit-dot lp-orbit-dot-2" />
          <div className="lp-orbit-dot lp-orbit-dot-3" />
        </div>
        <div className="lp-ring lp-ring-2" />
        <div className="lp-ring lp-ring-3" />
      </div>

      {/* Data nodes */}
      <div className="lp-nodes">
        <div className="lp-node lp-node-a" />
        <div className="lp-node lp-node-b" />
        <div className="lp-node lp-node-c" />
      </div>

      {/* AI scanner */}
      <div className="lp-scanner-wrap">
        <div className="lp-scanner" />
      </div>

      {/* Center logo */}
      <div className="lp-center-logo-wrap">
        <div className="lp-center-halo" />
        <IconShieldTickDark className="lp-center-logo" />
      </div>
    </div>
  )
}

/* ─── Status cards ───────────────────────────────────────────────── */

function StatusCards() {
  return (
    <div className="lp-status-cards" role="presentation" aria-hidden="true">
      <div className="lp-status-card lp-status-card-1">
        <div className="lp-status-title">
          <span className="lp-status-dot" />
          Claim received
        </div>
        <div className="lp-status-sub">Secure intake complete</div>
      </div>
      <div className="lp-status-card lp-status-card-2">
        <div className="lp-status-title">
          <span className="lp-status-dot" />
          AI risk analysis
        </div>
        <div className="lp-status-sub">Evaluating claim signals</div>
      </div>
      <div className="lp-status-card lp-status-card-3">
        <div className="lp-status-title">
          <span className="lp-status-dot green" />
          Verification complete
        </div>
        <div className="lp-status-sub">Claim integrity confirmed</div>
      </div>
    </div>
  )
}

/* Spokes linking each status card to the central shield.
   Coordinates are % of the (square) scene box. */
function StatusConnectors() {
  return (
    <svg
      className="lp-connectors"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      role="presentation"
      aria-hidden="true"
    >
      <g className="lp-connector lp-connector-1">
        <line x1="24" y1="19" x2="37.8" y2="35.5" />
        <circle cx="37.8" cy="35.5" r="0.9" />
      </g>
      <g className="lp-connector lp-connector-2">
        <line x1="72" y1="37" x2="66.3" y2="40.4" />
        <circle cx="66.3" cy="40.4" r="0.9" />
      </g>
      <g className="lp-connector lp-connector-3">
        <line x1="26" y1="75" x2="36.9" y2="63.7" />
        <circle cx="36.9" cy="63.7" r="0.9" />
      </g>
    </svg>
  )
}

/* ─── Left panel ─────────────────────────────────────────────────── */

function LeftPanel() {
  return (
    <aside className="lp-left">
      <div className="lp-grid" aria-hidden="true" />
      <div className="lp-noise" aria-hidden="true" />

      {/* Brand header */}
      <header className="lp-brand">
        <IconShieldTick className="lp-brand-logo" />
        <div className="lp-brand-text">
          <span className="lp-brand-name">
            Claim<span>Shield+</span>
          </span>
          <span className="lp-brand-tagline">Smarter Claims. Safer Roads.</span>
        </div>
      </header>

      {/* Hero stage: copy upper-left, visualization lower-right */}
      <div className="lp-stage">
        <div className="lp-copy">
          <div className="lp-eyebrow">
            <div className="lp-eyebrow-line" aria-hidden="true" />
            <span className="lp-eyebrow-text">AI-Powered Claim Intelligence</span>
          </div>

          <h1 className="lp-headline">
            Claims handled<br />
            with confidence<br />
            <span className="lp-headline-accent">and intelligence.</span>
          </h1>

          <p className="lp-description">
            Intelligent claim assessment, automated validation
            and secure decision support built to make insurance
            processing faster, safer and more transparent.
          </p>
        </div>

        {/* Central animated visualization with surrounding status flow */}
        <div className="lp-scene">
          <ClaimSecurityVis />
          <StatusConnectors />
          <StatusCards />

          {/* Verified badge */}
          <div className="lp-verified" aria-hidden="true">
            <span className="lp-verified-dot">
              <svg viewBox="0 0 12 12" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2.5 6.2 5 8.5 9.5 3.5" />
              </svg>
            </span>
            Verified &amp; Protected
          </div>
        </div>
      </div>

      {/* Bottom trust items */}
      <footer className="lp-trust">
        {['Secure processing', 'AI-assisted assessment', 'Protected data'].map((item) => (
          <div key={item} className="lp-trust-item">
            <span className="lp-trust-dot" aria-hidden="true" />
            {item}
          </div>
        ))}
      </footer>
    </aside>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   Main LoginPage component
   ═══════════════════════════════════════════════════════════════════ */

export function LoginPage() {
  const { session, loading, roleId, otpVerified, signIn } = useAuth()
  const { showToast } = useToast()
  const location = useLocation()

  /* Form state */
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [showPw, setShowPw]         = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [shakeKey, setShakeKey]     = useState(0)

  /* Forgot-password state */
  const [showForgot, setShowForgot]       = useState(false)
  const [resetEmail, setResetEmail]       = useState('')
  const [resetBusy, setResetBusy]         = useState(false)
  const [resetError, setResetError]       = useState<string | null>(null)

  /* Focus first field when panel switches */
  const emailRef      = useRef<HTMLInputElement>(null)
  const resetEmailRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (showForgot) resetEmailRef.current?.focus()
    else emailRef.current?.focus()
  }, [showForgot])

  /* ── Auth redirects ── */
  if (!loading && session) {
    const from = (location.state as { from?: string } | null)?.from
    if (roleId === RoleId.Customer && !otpVerified)
      return <Navigate to="/login/otp" state={{ from }} replace />
    return <Navigate to={from ?? '/'} replace />
  }

  /* ── Sign in ── */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const { error: signInError } = await signIn(email, password)

    setSubmitting(false)
    if (signInError) {
      setError(signInError)
      setShakeKey((k) => k + 1)
    }
  }

  /* ── Forgot password ──
     Uses Supabase's own recovery email — no dedicated backend endpoint.
     NOTE: A "reset password" landing page must be built separately for
     the emailed link to complete end-to-end.                          */
  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault()
    setResetBusy(true)
    setResetError(null)

    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(resetEmail.trim())

    setResetBusy(false)
    if (resetErr) {
      setResetError(resetErr.message)
      return
    }

    showToast('If an account exists for that email, a reset link has been sent.', 'info')
    setShowForgot(false)
    setResetEmail('')
  }

  /* ══════════════════════════════════════════════════════════════════
     Render
     ══════════════════════════════════════════════════════════════════ */
  return (
    <div className="lp-page">
      <LeftPanel />

      <main className="lp-right">
        <AnimatePresence mode="wait">
          {/* ── Forgot-password panel ── */}
          {showForgot ? (
            <motion.div
              key="forgot"
              className="lp-form-panel"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="lp-reset-header">
                <h2>Reset your password</h2>
                <p>Enter your email and we&apos;ll send you a secure reset link.</p>
              </div>

              <form onSubmit={handleForgotPassword} noValidate>
                <div className="lp-field">
                  <label htmlFor="reset-email" className="lp-label">Email address</label>
                  <div className="lp-input-wrap">
                    <span className="lp-input-icon"><IconMail /></span>
                    <input
                      id="reset-email"
                      ref={resetEmailRef}
                      type="email"
                      autoComplete="email"
                      className="lp-input"
                      placeholder="Enter your email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {resetError && (
                  <div className="lp-error" role="alert">{resetError}</div>
                )}

                <button
                  type="submit"
                  className="lp-submit"
                  disabled={resetBusy}
                >
                  {resetBusy && <span className="lp-spinner" aria-hidden="true" />}
                  {resetBusy ? 'Sending…' : 'Send reset link'}
                </button>

                <button
                  type="button"
                  className="lp-back-btn"
                  onClick={() => { setShowForgot(false); setResetError(null) }}
                >
                  <IconArrowLeft /> Back to sign in
                </button>
              </form>
            </motion.div>
          ) : (
            /* ── Login panel ── */
            <motion.div
              key="login"
              className="lp-form-panel"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Secure access pill */}
              <div className="lp-access-pill" aria-label="Secure access portal">
                <span className="lp-access-dot" aria-hidden="true" />
                Secure Access
              </div>

              {/* Header */}
              <h1 className="lp-form-title">
                Welcome to{' '}
                <span className="lp-form-title-accent">ClaimShield+</span>
              </h1>
              <p className="lp-form-desc">
                Sign in to securely manage claims, review assessments
                and continue your ClaimShield+ workflow.
              </p>

              <form onSubmit={handleSubmit} noValidate>
                {/* Email */}
                <div className="lp-field">
                  <label htmlFor="email" className="lp-label">Email address</label>
                  <div className="lp-input-wrap">
                    <span className="lp-input-icon"><IconMail /></span>
                    <input
                      id="email"
                      ref={emailRef}
                      type="email"
                      autoComplete="username"
                      className="lp-input"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="lp-field">
                  <label htmlFor="password" className="lp-label">Password</label>
                  <div className="lp-input-wrap">
                    <span className="lp-input-icon"><IconLock /></span>
                    <input
                      id="password"
                      type={showPw ? 'text' : 'password'}
                      autoComplete="current-password"
                      className="lp-input"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="lp-eye-btn"
                      onClick={() => setShowPw((v) => !v)}
                      aria-label={showPw ? 'Hide password' : 'Show password'}
                    >
                      <IconEye visible={showPw} />
                    </button>
                  </div>
                </div>

                {/* Options row */}
                <div className="lp-options">
                  <label className="lp-remember">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <span className="lp-remember-label">Remember me</span>
                  </label>
                  <button
                    type="button"
                    className="lp-forgot"
                    onClick={() => { setShowForgot(true); setError(null) }}
                  >
                    Forgot password?
                  </button>
                </div>

                {/* Error */}
                <AnimatePresence mode="wait">
                  {error && (
                    <motion.div
                      key={shakeKey}
                      className="lp-error"
                      role="alert"
                      initial={{ x: 0, opacity: 0 }}
                      animate={{ x: [0, -8, 8, -6, 6, -3, 3, 0], opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.4 }}
                    >
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Submit */}
                <button
                  type="submit"
                  className="lp-submit"
                  disabled={submitting}
                >
                  {submitting && <span className="lp-spinner" aria-hidden="true" />}
                  {submitting ? 'Signing in…' : 'Sign in securely'}
                </button>
              </form>

              {/* Create account — swap href for a real route when signup is implemented */}
              <p className="lp-create">
                New to ClaimShield+?{' '}
                <a href="#" className="lp-create-link">
                  Create account
                </a>
              </p>

              {/* Security note */}
              <div className="lp-security-note">
                <IconShieldTick className="lp-security-logo" />
                Protected authentication session
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}