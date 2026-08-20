import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Car,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Search,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";

const FAST_TRACK_TAGS = ["Minor dents", "Windshield & glass", "Scratches"];

const TIMELINE_STEPS = [
  { time: "00:00", title: "Photos", detail: "Four guided angles of the damage." },
  { time: "00:06", title: "AI check", detail: "Damage detected and priced." },
  { time: "00:14", title: "Approved", detail: "No surveyor visit needed." },
  { time: "00:28", title: "Settled", detail: "Paid into your account." },
];

const TRUST_STATS = [
  { value: "1.2M", label: "OD claims settled" },
  { value: "28 min", label: "median TAT" },
  { value: "98.4%", label: "approved first pass" },
];

export function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError("");

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);

    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (loginError) {
        setError(loginError.message);
        return;
      }

      navigate("/dashboard", { replace: true });
    } catch (err) {
      console.error("Login error:", err);
      setError("Unable to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        /* =========================================================
           CLAIMSHIELD+ LOGIN — FAST TRACK ORANGE THEME
           ========================================================= */

        * { box-sizing: border-box; }

        html, body, #root { margin: 0; width: 100%; min-height: 100%; }

        :root {
          --cs-primary: #dd4a2f;
          --cs-primary-dark: #b8371f;
          --cs-primary-soft: rgba(221, 74, 47, 0.12);
          --cs-ink: #1a1410;
          --cs-muted: #6b7280;
          --cs-border: #e7e2dc;
        }

        .cs-login-page {
          width: 100%;
          height: 100vh;
          height: 100dvh;
          display: flex;
          overflow: hidden;
          background: #ffffff;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
          color: var(--cs-ink);
        }

        /* =========================================================
           LEFT — FAST TRACK HERO PANEL
           ========================================================= */

        .cs-hero {
          position: relative;
          width: 42%;
          min-width: 340px;
          padding: 26px 34px;
          background: linear-gradient(160deg, var(--cs-primary) 0%, var(--cs-primary-dark) 100%);
          color: #ffffff;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .cs-hero-brand {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .cs-hero-eyebrow {
          margin-top: 10px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.75);
        }

        .cs-hero-headline {
          margin: 8px 0 0;
          font-size: clamp(32px, 3.6vw, 46px);
          line-height: 0.95;
          font-weight: 800;
          letter-spacing: -0.02em;
        }

        .cs-hero-copy {
          margin: 10px 0 0;
          max-width: 34ch;
          font-size: 12.5px;
          line-height: 1.5;
          color: rgba(255, 255, 255, 0.88);
        }

        .cs-hero-rule {
          margin: 16px 0;
          height: 1px;
          background: rgba(255, 255, 255, 0.25);
        }

        /* Two-timelines comparison card */

        .cs-timeline-card {
          background: #ffffff;
          color: var(--cs-ink);
          border-radius: 12px;
          padding: 14px 16px 12px;
          box-shadow: 0 14px 30px rgba(0, 0, 0, 0.16);
        }

        .cs-timeline-eyebrow {
          font-size: 9.5px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--cs-muted);
          margin-bottom: 8px;
        }

        .cs-timeline-row {
          display: grid;
          grid-template-columns: 46px 1fr 50px;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
        }

        .cs-timeline-row:last-child { margin-bottom: 0; }

        .cs-timeline-label {
          font-size: 10.5px;
          font-weight: 700;
          color: var(--cs-muted);
        }

        .cs-timeline-track {
          height: 6px;
          border-radius: 6px;
          background: #eee9e4;
          overflow: hidden;
        }

        .cs-timeline-fill {
          height: 100%;
          border-radius: 6px;
          background: #d8d4cf;
        }

        .cs-timeline-fill.is-fast {
          background: var(--cs-primary);
        }

        .cs-timeline-value {
          font-size: 10.5px;
          font-weight: 800;
          text-align: right;
          color: var(--cs-ink);
        }

        /* Bottom step strip */

        .cs-hero-steps {
          margin-top: auto;
          padding-top: 16px;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
        }

        .cs-hero-step-time {
          font-size: 11px;
          font-weight: 800;
          margin-bottom: 2px;
        }

        .cs-hero-step-title {
          font-size: 11px;
          font-weight: 700;
          margin-bottom: 2px;
        }

        .cs-hero-step-detail {
          font-size: 10px;
          line-height: 1.3;
          color: rgba(255, 255, 255, 0.72);
        }

        /* =========================================================
           RIGHT — LOGIN PANEL
           ========================================================= */

        .cs-form-area {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px 28px;
          overflow-y: auto;
        }

        .cs-login-card {
          width: 100%;
          max-width: 320px;
        }

        .cs-eyebrow {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--cs-muted);
        }

        .cs-login-card h1 {
          margin: 5px 0 4px;
          font-size: 22px;
          font-weight: 800;
          letter-spacing: -0.01em;
        }

        .cs-login-sub {
          margin: 0 0 14px;
          font-size: 12px;
          line-height: 1.45;
          color: var(--cs-muted);
        }

        .cs-form { display: flex; flex-direction: column; gap: 10px; }

        .cs-label {
          display: block;
          margin-bottom: 4px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          color: var(--cs-muted);
        }

        .cs-input-wrapper { position: relative; width: 100%; }

        .cs-input-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #9a9389;
          pointer-events: none;
        }

        .cs-input {
          width: 100%;
          height: 40px;
          padding: 0 12px 0 38px;
          border: 1px solid var(--cs-border);
          border-radius: 9px;
          background: #fafaf9;
          color: var(--cs-ink);
          font-size: 13px;
          outline: none;
          transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
        }

        .cs-input::placeholder { color: #a39c92; }
        .cs-input:hover { border-color: #d8d0c6; }
        .cs-input:focus {
          border-color: var(--cs-primary);
          background: #ffffff;
          box-shadow: 0 0 0 3px var(--cs-primary-soft);
        }
        .cs-input:disabled { background: #f1efec; cursor: not-allowed; }

        .cs-password-input { padding-right: 40px; }

        .cs-password-button {
          position: absolute;
          right: 11px;
          top: 50%;
          transform: translateY(-50%);
          width: 22px;
          height: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          border: 0;
          background: transparent;
          color: #9a9389;
          cursor: pointer;
        }

        .cs-password-button:hover { color: var(--cs-primary); }

        .cs-remember {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 600;
          color: #4a453f;
          cursor: pointer;
        }

        .cs-checkbox {
          width: 14px;
          height: 14px;
          margin: 0;
          accent-color: var(--cs-primary);
          cursor: pointer;
        }

        .cs-error {
          padding: 8px 10px;
          border: 1px solid #f3c6bb;
          border-radius: 9px;
          background: #fdf1ee;
          color: var(--cs-primary-dark);
          font-size: 11px;
          line-height: 1.4;
        }

        .cs-submit {
          width: 100%;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          border: 0;
          border-radius: 9px;
          background: linear-gradient(135deg, var(--cs-primary) 0%, var(--cs-primary-dark) 100%);
          color: #ffffff;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 10px 22px rgba(221, 74, 47, 0.28);
          transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
        }

        .cs-submit:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 13px 26px rgba(221, 74, 47, 0.34);
        }

        .cs-submit:disabled { opacity: 0.7; cursor: not-allowed; }

        .cs-track-button {
          width: 100%;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          border: 1px solid var(--cs-border);
          border-radius: 9px;
          background: #ffffff;
          color: var(--cs-ink);
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: border-color 0.2s ease, background 0.2s ease;
        }

        .cs-track-button:hover { border-color: #d8d0c6; background: #fafaf9; }

        .cs-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255, 255, 255, 0.4);
          border-top-color: #ffffff;
          border-radius: 50%;
          animation: cs-spin 0.8s linear infinite;
        }

        @keyframes cs-spin { to { transform: rotate(360deg); } }

        .cs-fast-track {
          margin-top: 14px;
          padding-top: 12px;
          border-top: 1px solid var(--cs-border);
        }

        .cs-tags {
          margin-top: 8px;
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .cs-tag {
          padding: 4px 9px;
          border-radius: 999px;
          background: var(--cs-primary-soft);
          color: var(--cs-primary-dark);
          font-size: 10px;
          font-weight: 700;
        }

        .cs-stats {
          margin-top: 12px;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
        }

        .cs-stat { text-align: left; }
        .cs-stat + .cs-stat { border-left: 1px solid var(--cs-border); padding-left: 10px; }

        .cs-stat-value {
          font-size: 15px;
          font-weight: 800;
          color: var(--cs-ink);
        }

        .cs-stat-label {
          margin-top: 1px;
          font-size: 9px;
          color: var(--cs-muted);
        }

        .cs-footer {
          margin-top: 12px;
          padding-top: 10px;
          border-top: 1px solid var(--cs-border);
          font-size: 9px;
          color: #a39c92;
        }

        /* =========================================================
           RESPONSIVE
           ========================================================= */

        @media (max-width: 980px) {
          .cs-hero-steps { grid-template-columns: repeat(2, 1fr); row-gap: 14px; }
        }

        @media (max-width: 860px) {
          .cs-login-page { flex-direction: column; height: auto; min-height: 100vh; min-height: 100dvh; overflow-y: auto; }
          .cs-hero { width: 100%; min-width: 0; padding: 28px 22px; }
          .cs-hero-headline { font-size: clamp(36px, 10vw, 50px); }
          .cs-form-area { padding: 28px 20px 36px; overflow-y: visible; }
        }
      `}</style>

      <main className="cs-login-page">
        {/* =====================================================
            LEFT — FAST TRACK HERO
            ===================================================== */}
        <section className="cs-hero">
          <div className="cs-hero-brand">
            <Car size={16} />
            Claims Shield+
          </div>

          <div className="cs-hero-eyebrow">Fast track OD claim settlement</div>

          <motion.h1
            className="cs-hero-headline"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            30
            <br />
            Minutes.
          </motion.h1>

          <p className="cs-hero-copy">
            Not 5&ndash;7 days. Dents, windshield glass and scratches, settled while you wait.
          </p>

          <div className="cs-hero-rule" />

          <motion.div
            className="cs-timeline-card"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4 }}
          >
            <div className="cs-timeline-eyebrow">Same claim, two timelines</div>

            <div className="cs-timeline-row">
              <span className="cs-timeline-label">Industry</span>
              <div className="cs-timeline-track">
                <div className="cs-timeline-fill" style={{ width: "100%" }} />
              </div>
              <span className="cs-timeline-value">5&ndash;7 days</span>
            </div>

            <div className="cs-timeline-row">
              <span className="cs-timeline-label">Shield+</span>
              <div className="cs-timeline-track">
                <div className="cs-timeline-fill is-fast" style={{ width: "8%" }} />
              </div>
              <span className="cs-timeline-value">30 min</span>
            </div>
          </motion.div>

          <div className="cs-hero-steps">
            {TIMELINE_STEPS.map((step) => (
              <div key={step.title}>
                <div className="cs-hero-step-time">{step.time}</div>
                <div className="cs-hero-step-title">{step.title}</div>
                <div className="cs-hero-step-detail">{step.detail}</div>
              </div>
            ))}
          </div>
        </section>

        {/* =====================================================
            RIGHT — LOGIN FORM
            ===================================================== */}
        <section className="cs-form-area">
          <motion.div
            className="cs-login-card"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <div className="cs-eyebrow">Customer login</div>
            <h1>Welcome back.</h1>
            <p className="cs-login-sub">
              Policyholders only. Third-party claimants use this form.
            </p>

            <form onSubmit={handleLogin} className="cs-form">
              <div>
                <label htmlFor="email" className="cs-label">
                  Email address
                </label>
                <div className="cs-input-wrapper">
                  <Mail size={17} className="cs-input-icon" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    disabled={loading}
                    className="cs-input"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="cs-label">
                  Password
                </label>
                <div className="cs-input-wrapper">
                  <LockKeyhole size={17} className="cs-input-icon" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter password"
                    disabled={loading}
                    className="cs-input cs-password-input"
                  />
                  <button
                    type="button"
                    className="cs-password-button"
                    onClick={() => setShowPassword((value) => !value)}
                    disabled={loading}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <label className="cs-remember">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                  className="cs-checkbox"
                />
                Keep me signed in on this device
              </label>

              {error && <div className="cs-error">{error}</div>}

              <button type="submit" disabled={loading} className="cs-submit">
                {loading ? (
                  <>
                    <span className="cs-spinner" />
                    Signing in&hellip;
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              <button
                type="button"
                className="cs-track-button"
                onClick={() => navigate("/track-claim")}
              >
                <Search size={15} />
                Track a claim without signing in
              </button>
            </form>

            <div className="cs-fast-track">
              <div className="cs-eyebrow">Eligible on fast track</div>
              <div className="cs-tags">
                {FAST_TRACK_TAGS.map((tag) => (
                  <span key={tag} className="cs-tag">
                    {tag}
                  </span>
                ))}
              </div>

              <div className="cs-stats">
                {TRUST_STATS.map((stat) => (
                  <div key={stat.label} className="cs-stat">
                    <div className="cs-stat-value">{stat.value}</div>
                    <div className="cs-stat-label">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="cs-footer">IRDAI Reg. 158 &middot; 256-bit encrypted</div>
          </motion.div>
        </section>
      </main>
    </>
  );
}

export default LoginPage;