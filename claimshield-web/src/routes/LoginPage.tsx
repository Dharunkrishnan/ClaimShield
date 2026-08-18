
import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Globe,
  Headphones,
  LockKeyhole,
  Mail,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";

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
      const { error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (loginError) {
        setError(loginError.message);
        return;
      }

      // Login successful → go to dashboard
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
           CLAIMSHIELD LOGIN
           ========================================================= */

        * {
          box-sizing: border-box;
        }

        html,
        body,
        #root {
          margin: 0;
          width: 100%;
          min-height: 100%;
        }

        .claim-login-page {
          width: 100%;
          height: 100vh;
          height: 100dvh;
          min-height: 620px;

          display: flex;

          overflow: hidden;

          background: #f5f7fb;

          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        /* =========================================================
           LEFT IMAGE
           ========================================================= */

        .claim-login-visual {
          position: relative;

          width: 58%;
          height: 100%;

          display: flex;
          align-items: center;
          justify-content: center;

          overflow: hidden;

          background: #031432;
        }

        /*
         * IMPORTANT:
         *
         * contain = show the COMPLETE login image.
         *
         * Your previous code used "cover", which is why the
         * left side of your artwork was getting cut off.
         */

        .claim-login-image {
          display: block;

          width: 100%;
          height: 100%;

          object-fit: contain;
          object-position: center center;

          user-select: none;
          pointer-events: none;
        }

        .claim-login-image-overlay {
          position: absolute;
          inset: 0;

          pointer-events: none;

          background:
            linear-gradient(
              90deg,
              rgba(1, 12, 35, 0.02),
              rgba(1, 12, 35, 0.03)
            );
        }

        /* =========================================================
           IMAGE GLOW
           ========================================================= */

        .claim-glow-one {
          position: absolute;

          width: 220px;
          height: 220px;

          left: 45%;
          top: 20%;

          border-radius: 50%;

          background: rgba(0, 153, 255, 0.10);

          filter: blur(70px);

          pointer-events: none;
        }

        .claim-glow-two {
          position: absolute;

          width: 180px;
          height: 180px;

          left: 65%;
          bottom: 12%;

          border-radius: 50%;

          background: rgba(0, 100, 255, 0.08);

          filter: blur(65px);

          pointer-events: none;
        }

        /* =========================================================
           RIGHT LOGIN AREA
           ========================================================= */

        .claim-login-form-area {
          position: relative;

          width: 42%;
          height: 100%;

          display: flex;
          flex-direction: column;

          align-items: center;

          overflow-y: auto;

          padding: 78px 34px 30px;

          background:
            radial-gradient(
              circle at 15% 10%,
              rgba(37, 99, 235, 0.06),
              transparent 35%
            ),
            #031432;
        }

        /* =========================================================
           TOP ACTIONS
           ========================================================= */

        .claim-top-actions {
          position: absolute;

          top: 22px;
          right: 28px;

          display: flex;
          align-items: center;

          gap: 8px;

          z-index: 20;
        }

        .claim-action-button {
          height: 38px;

          padding: 0 13px;

          display: inline-flex;
          align-items: center;
          justify-content: center;

          gap: 7px;

          border: 1px solid #dce2ec;
          border-radius: 10px;

          background: rgba(255, 255, 255, 0.95);

          color: #26324d;

          font-size: 12px;
          font-weight: 600;

          cursor: pointer;

          box-shadow:
            0 4px 12px rgba(15, 23, 42, 0.05);

          transition:
            background 0.2s ease,
            border-color 0.2s ease,
            color 0.2s ease;
        }

        .claim-action-button:hover {
          background: #ffffff;
          border-color: #b9c6db;
          color: #2563eb;
        }

        /* =========================================================
           LOGIN CARD
           ========================================================= */
.claim-login-card {
  width: 360px;
  max-width: calc(100vw - 40px);

  max-height: calc(100vh - 80px);

  margin-right: 40px;
  margin-bottom: 25px;

  padding: 22px 24px 18px;

  border-radius: 16px;

  background: rgba(4, 24, 61, 0.45);

  border: 1px solid rgba(255, 255, 255, 0.22);

  box-shadow:
    0 18px 40px rgba(0, 0, 0, 0.28);

  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);

  overflow-y: auto;
}

        /* =========================================================
           LOGIN HEADER
           ========================================================= */

        .claim-login-heading {
          text-align: center;
          color: #ffffff;

          margin-bottom: 27px;
        }

        .claim-login-heading h1 {
          margin: 0;

          color: #cdd0d9;

          font-size: clamp(26px, 2vw, 32px);

          line-height: 1.15;

          font-weight: 800;

          letter-spacing: -0.8px;
        }

        .claim-login-heading p {
          margin: 9px 0 0;

          color: #68738a;

          font-size: 13px;

          line-height: 1.5;
        }

        .claim-login-heading strong {
          color: #2563eb;
        }

        .claim-heading-line {
          width: 48px;
          height: 3px;

          margin: 14px auto 0;

          border-radius: 20px;

          background: #2563eb;
        }

        /* =========================================================
           FORM
           ========================================================= */

        .claim-form {
          width: 100%;

          display: flex;
          flex-direction: column;

          gap: 16px;
        }

        .claim-field {
          width: 100%;
        }

        .claim-label {
          display: block;

          margin-bottom: 7px;

          color: #cdd0d9;

          font-size: 12px;

          font-weight: 700;
        }

        .claim-input-wrapper {
          position: relative;

          width: 100%;
        }

        .claim-input-icon {
          position: absolute;

          left: 14px;
          top: 50%;

          transform: translateY(-50%);

          color: #71809a;

          pointer-events: none;
        }

        .claim-input {
          width: 100%;
          height: 48px;

          padding: 0 13px 0 43px;

          border: 1px solid #d7deea;
          border-radius: 11px;

          background: #ffffff;

          color: #cdd0d9;

          font-size: 13px;

          outline: none;

          transition:
            border-color 0.2s ease,
            box-shadow 0.2s ease,
            background 0.2s ease;
        }

        .claim-input::placeholder {
          color: #9ba5b8;
        }

        .claim-input:hover {
          border-color: #c1cada;
        }

        .claim-input:focus {
          border-color: #2563eb;

          box-shadow:
            0 0 0 3px rgba(37, 99, 235, 0.09);
        }

        .claim-input:disabled {
          background: #f5f7fa;
          cursor: not-allowed;
        }

        .claim-password-input {
          padding-right: 45px;
        }

        .claim-password-button {
          position: absolute;

          right: 13px;
          top: 50%;

          transform: translateY(-50%);

          width: 28px;
          height: 28px;

          display: flex;
          align-items: center;
          justify-content: center;

          padding: 0;

          border: 0;

          background: transparent;

          color: #71809a;

          cursor: pointer;
        }

        .claim-password-button:hover {
          color: #2563eb;
        }

        /* =========================================================
           OPTIONS
           ========================================================= */

        .claim-options {
          display: flex;

          align-items: center;
          justify-content: space-between;

          gap: 10px;

          margin-top: 1px;
        }

        .claim-remember {
          display: inline-flex;

          align-items: center;

          gap: 7px;

          color: #4a566f;

          font-size: 12px;

          font-weight: 600;

          cursor: pointer;
        }

        .claim-checkbox {
          width: 16px;
          height: 16px;

          margin: 0;

          accent-color: #2563eb;

          cursor: pointer;
        }

        .claim-forgot {
          padding: 0;

          border: 0;

          background: transparent;

          color: #2563eb;

          font-size: 12px;

          font-weight: 700;

          cursor: pointer;
        }

        .claim-forgot:hover {
          text-decoration: underline;
        }

        /* =========================================================
           ERROR
           ========================================================= */

        .claim-error {
          padding: 10px 12px;

          border: 1px solid #fecaca;
          border-radius: 9px;

          background: #fff5f5;

          color: #b42318;

          font-size: 12px;

          line-height: 1.4;
        }

        /* =========================================================
           SUBMIT BUTTON
           ========================================================= */

        .claim-submit {
          position: relative;

          width: 100%;
          height: 49px;

          display: flex;
          align-items: center;
          justify-content: center;

          padding: 0 18px;

          border: 0;
          border-radius: 11px;

          background:
            linear-gradient(
              135deg,
              #1559e8 0%,
              #1769f5 55%,
              #287eff 100%
            );

          color: #ffffff;

          font-size: 14px;

          font-weight: 700;

          cursor: pointer;

          box-shadow:
            0 10px 24px rgba(37, 99, 235, 0.22);

          overflow: hidden;

          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease,
            filter 0.2s ease;
        }

        .claim-submit:hover:not(:disabled) {
          transform: translateY(-1px);

          box-shadow:
            0 13px 28px rgba(37, 99, 235, 0.29);

          filter: brightness(1.02);
        }

        .claim-submit:active:not(:disabled) {
          transform: translateY(0);
        }

        .claim-submit:disabled {
          opacity: 0.7;

          cursor: not-allowed;
        }

        .claim-submit-content {
          display: flex;
          align-items: center;
          justify-content: center;

          gap: 8px;
        }

        /* =========================================================
           SPINNER
           ========================================================= */

        .claim-spinner {
          width: 16px;
          height: 16px;

          border: 2px solid rgba(255, 255, 255, 0.35);

          border-top-color: #ffffff;

          border-radius: 50%;

          animation: claim-spin 0.8s linear infinite;
        }

        @keyframes claim-spin {
          to {
            transform: rotate(360deg);
          }
        }

        /* =========================================================
           TRUST
           ========================================================= */

        .claim-trust {
          width: 100%;

          display: grid;

          grid-template-columns: repeat(3, 1fr);

          margin-top: 19px;
          padding-top: 15px;

          border-top: 1px solid #edf0f5;
        }

        .claim-trust-item {
          display: flex;

          flex-direction: column;

          align-items: center;
          justify-content: center;

          gap: 4px;

          color: #69748b;

          font-size: 10px;

          font-weight: 600;

          text-align: center;
        }

        .claim-trust-item + .claim-trust-item {
          border-left: 1px solid #edf0f5;
        }

        /* =========================================================
           REGISTER
           ========================================================= */

        .claim-register {
          margin-top: 17px;

          text-align: center;

          color: #68738a;

          font-size: 12px;
        }

        .claim-register button {
          padding: 0;

          border: 0;

          background: transparent;

          color: #2563eb;

          font-size: inherit;

          font-weight: 700;

          cursor: pointer;
        }

        .claim-register button:hover {
          text-decoration: underline;
        }

        /* =========================================================
           SECURITY
           ========================================================= */

        .claim-security {
          display: flex;

          align-items: center;
          justify-content: center;

          gap: 5px;

          margin-top: 13px;

          color: #8993a6;

          font-size: 9px;
        }

        /* =========================================================
           TABLET
           ========================================================= */

        @media (max-width: 1050px) {
          .claim-login-visual {
            width: 55%;
          }

          .claim-login-form-area {
            width: 45%;

            padding-left: 22px;
            padding-right: 22px;
          }

          .claim-login-card {
            padding: 30px 27px 24px;
          }

          .claim-top-actions {
            right: 18px;
          }
        }

        /* =========================================================
           MOBILE
           ========================================================= */

        @media (max-width: 760px) {
          .claim-login-page {
            height: auto;
            min-height: 100vh;
            min-height: 100dvh;

            flex-direction: column;

            overflow-y: auto;
          }

          .claim-login-visual {
            width: 100%;

            height: 280px;
            min-height: 280px;
          }

          .claim-login-form-area {
            width: 100%;

            height: auto;
            min-height: calc(100vh - 280px);

            padding: 70px 18px 25px;

            overflow: visible;
          }

          .claim-login-card {
            width: 100%;

            margin: 0;

            padding: 24px 16px 22px;

            border-radius: 18px;
          }

          .claim-top-actions {
            top: 18px;
            right: 18px;
          }
        }

        /* =========================================================
           SMALL MOBILE
           ========================================================= */

        @media (max-width: 480px) {
          .claim-login-visual {
            height: 230px;
            min-height: 230px;
          }

          .claim-login-form-area {
            min-height: calc(100vh - 230px);

            padding: 65px 12px 20px;
          }

          .claim-login-card {
            padding: 25px 18px 20px;
          }

          .claim-login-heading h1 {
            font-size: 25px;
          }

          .claim-action-button {
            height: 34px;

            padding: 0 9px;

            font-size: 11px;
          }

          .claim-input {
            height: 46px;
          }

          .claim-submit {
            height: 47px;
          }
        }

        /* =========================================================
           VERY SMALL SCREEN
           ========================================================= */

        @media (max-width: 360px) {
          .claim-action-button:first-child {
            display: none;
          }

          .claim-top-actions {
            right: 12px;
          }

          .claim-login-form-area {
            padding-left: 9px;
            padding-right: 9px;
          }
        }
      `}</style>

      {/* =========================================================
          MAIN LOGIN PAGE
          ========================================================= */}

      <main className="claim-login-page">

        {/* =======================================================
            LEFT IMAGE
            ======================================================= */}

        <section className="claim-login-visual">

          <img
            src="/login-bg.png"
            alt="ClaimShield+ motor claims"
            className="claim-login-image"
          />

          <div
            className="claim-login-image-overlay"
            aria-hidden="true"
          />

          <motion.div
            className="claim-glow-one"
            animate={{
              scale: [1, 1.18, 1],
              opacity: [0.3, 0.55, 0.3],
            }}
            transition={{
              duration: 5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          <motion.div
            className="claim-glow-two"
            animate={{
              y: [-12, 12, -12],
              opacity: [0.25, 0.5, 0.25],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

        </section>

        {/* =======================================================
            RIGHT LOGIN AREA
            ======================================================= */}

        <section className="claim-login-form-area">

          {/* TOP ACTIONS */}

          <div className="claim-top-actions">

            <button
              type="button"
              className="claim-action-button"
            >
              <Headphones size={15} />
              Need Help?
            </button>

            <button
              type="button"
              className="claim-action-button"
            >
              <Globe size={15} />
              English
            </button>

          </div>

          {/* =====================================================
              LOGIN CARD
              ===================================================== */}

          <motion.div
            className="claim-login-card"
            initial={{
              opacity: 0,
              x: 25,
              scale: 0.98,
            }}
            animate={{
              opacity: 1,
              x: 0,
              scale: 1,
            }}
            transition={{
              duration: 0.5,
              ease: "easeOut",
            }}
          >

            {/* HEADER */}

            <div className="claim-login-heading">

              <motion.h1
                initial={{
                  opacity: 0,
                  y: 8,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  delay: 0.12,
                  duration: 0.35,
                }}
              >
                Welcome Back!
                
              </motion.h1>

              <motion.p
                initial={{
                  opacity: 0,
                  y: 5,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  delay: 0.18,
                  duration: 0.35,
                }}
              >
                Sign in to continue to{" "}
                <strong>ClaimShield+</strong>
              </motion.p>

              <div className="claim-heading-line" />

            </div>

            {/* ===================================================
                LOGIN FORM
                =================================================== */}

            <form
              onSubmit={handleLogin}
              className="claim-form"
            >

              {/* EMAIL */}

              <motion.div
                className="claim-field"
                initial={{
                  opacity: 0,
                  y: 8,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  delay: 0.22,
                }}
              >

                <label
                  htmlFor="email"
                  className="claim-label"
                >
                  Email Address
                </label>

                <div className="claim-input-wrapper">

                  <Mail
                    size={18}
                    className="claim-input-icon"
                  />

                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) =>
                      setEmail(event.target.value)
                    }
                    placeholder="Enter your email address"
                    disabled={loading}
                    className="claim-input"
                  />

                </div>

              </motion.div>

              {/* PASSWORD */}

              <motion.div
                className="claim-field"
                initial={{
                  opacity: 0,
                  y: 8,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  delay: 0.28,
                }}
              >

                <label
                  htmlFor="password"
                  className="claim-label"
                >
                  Password
                </label>

                <div className="claim-input-wrapper">

                  <LockKeyhole
                    size={18}
                    className="claim-input-icon"
                  />

                  <input
                    id="password"
                    name="password"
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                    placeholder="Enter your password"
                    disabled={loading}
                    className="claim-input claim-password-input"
                  />

                  <button
                    type="button"
                    className="claim-password-button"
                    onClick={() =>
                      setShowPassword(
                        (value) => !value
                      )
                    }
                    disabled={loading}
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>

                </div>

              </motion.div>

              {/* OPTIONS */}

              <motion.div
                className="claim-options"
                initial={{
                  opacity: 0,
                }}
                animate={{
                  opacity: 1,
                }}
                transition={{
                  delay: 0.34,
                }}
              >

                <label className="claim-remember">

                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) =>
                      setRememberMe(
                        event.target.checked
                      )
                    }
                    className="claim-checkbox"
                  />

                  Remember Me

                </label>

                <button
                  type="button"
                  className="claim-forgot"
                  
                >
                  Forgot Password?
                </button>

              </motion.div>

              {/* ERROR */}

              {error && (
                <motion.div
                  className="claim-error"
                  initial={{
                    opacity: 0,
                    y: -5,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                >
                  {error}
                </motion.div>
              )}

              {/* LOGIN BUTTON */}

              <motion.button
                type="submit"
                disabled={loading}
                className="claim-submit"
                initial={{
                  opacity: 0,
                  y: 8,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  delay: 0.39,
                }}
                whileTap={
                  !loading
                    ? { scale: 0.985 }
                    : undefined
                }
              >

                <span className="claim-submit-content">

                  {loading ? (
                    <>
                      <span className="claim-spinner" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight size={17} />
                    </>
                  )}

                </span>

              </motion.button>

            </form>



            {/* ===================================================
                REGISTER
                =================================================== */}



            {/* SECURITY */}



          </motion.div>

        </section>

      </main>
    </>
  );
}

export default LoginPage;