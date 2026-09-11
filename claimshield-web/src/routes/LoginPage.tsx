import { useEffect, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Car,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";

// 4 stages for the top stepper (Raise claim -> Smart survey -> Review & approve -> Get paid)
const STEPPER_STAGES = [
  { label: "Raise claim", stepLabel: "Step 1" },
  { label: "Smart survey", stepLabel: "Step 2" },
  { label: "Review & approve", stepLabel: "Step 3" },
  { label: "Get paid", stepLabel: "Step 4" },
];

// 4 tiles at the bottom
const JOURNEY_TILES = [
  { step: "STEP 1", title: "Snap the damage", detail: "Four guided angles at the scene." },
  { step: "STEP 2", title: "Damage Assessment", detail: "Dent, glass or scratch priced in seconds." },
  { step: "STEP 3", title: "Approval", detail: "Straight-through, no surveyor visit." },
  { step: "STEP 4", title: "Settled", detail: "Paid to your bank inside 30 minutes." },
];

export function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [mode, setMode] = useState<"login" | "forgot" | "forgot-sent">("login");
  const [resetEmail, setResetEmail] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  // Mobile 2-step view state: 'splash' for promotion screen, 'login' for focused login sheet
  const [mobileView, setMobileView] = useState<"splash" | "login">("splash");

  // Cycles the stepper AND the tile grid together through all 4 stages
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((i) => (i + 1) % STEPPER_STAGES.length);
    }, 2200);

    return () => clearInterval(interval);
  }, []);

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

  const handleForgotPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setResetError("");

    if (!resetEmail.trim()) {
      setResetError("Please enter your email address.");
      return;
    }

    setResetLoading(true);

    try {
      await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: `${window.location.origin}/login`,
      });

      setMode("forgot-sent");
    } catch (err) {
      console.error("Password reset error:", err);
      setResetError("Unable to send reset instructions right now. Please try again.");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <>
      <style>{`
        /* =========================================================
           CLAIMSHIELD+ LOGIN - Desktop Split Screen & Mobile Flow
           ========================================================= */

        * { box-sizing: border-box; }

        html, body, #root { margin: 0; width: 100%; min-height: 100%; }

        :root {
          --cs-navy: #123B4A;
          --cs-brand-green: #008284;
          --cs-timeline-green: #2E9B62;
          --cs-gold: #D99A18;
          --cs-gold-soft: rgba(217, 154, 24, 0.35);
          --cs-teal-1: #123B4A;
          --cs-teal-2: #005758;
          --cs-teal-3: #008284;
          --cs-teal-4: #66b3b5;
          --cs-teal-5: #E8F6F5;
          --cs-navy-line: rgba(255, 255, 255, 0.1);
          --cs-ink: #1a1410;
          --cs-muted: #6b7280;
          --cs-border: #e7e2dc;
        }

        .cs-login-page {
          width: 100%;
          height: 100vh;
          height: 100dvh;
          display: flex;
          align-items: stretch;
          background: var(--cs-teal-1);
          overflow: hidden;
          position: relative;
        }

        .cs-login-page::before {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.5;
          z-index: 0;
          background-image:
            repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.035) 0px, rgba(255, 255, 255, 0.035) 1px, transparent 1px, transparent 34px),
            repeating-linear-gradient(-45deg, rgba(255, 255, 255, 0.035) 0px, rgba(255, 255, 255, 0.035) 1px, transparent 1px, transparent 34px);
        }

        .cs-login-page > * {
          position: relative;
          z-index: 1;
        }

        /* =====================================================
           LEFT - dark console (Desktop)
           ===================================================== */

        .cs-console {
          flex: 0 0 60%;
          min-width: 0;
          display: flex;
          flex-direction: column;
          padding: 24px 36px 26px;
          color: #ffffff;
          position: relative;
          overflow: hidden;
        }

        .cs-console::after {
          content: '';
          position: absolute;
          top: -20%;
          right: -10%;
          width: 60%;
          height: 60%;
          pointer-events: none;
          background: radial-gradient(circle, rgba(212, 175, 55, 0.12) 0%, transparent 70%);
        }

        .cs-console > * {
          position: relative;
          z-index: 1;
        }

        .cs-console-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 12px;
          margin-bottom: 16px;
          position: relative;
        }

        .cs-console-header::after {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 1px;
          background: linear-gradient(90deg, var(--cs-gold-soft) 0%, rgba(255, 255, 255, 0.08) 40%, transparent 100%);
        }

        .cs-console-brand {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 15px;
          font-weight: 800;
        }

        .cs-console-brand svg { color: var(--cs-brand-green); }

        .cs-console-brand-logo {
          width: 20px;
          height: 20px;
          object-fit: contain;
        }

        .cs-console-eyebrow {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--cs-gold);
          margin-bottom: 4px;
        }

        .cs-console-headline {
          font-size: clamp(36px, 4.4vw, 52px);
          font-weight: 800;
          line-height: 1;
          margin: 6px 0 6px;
          text-shadow: 0 4px 24px rgba(0, 0, 0, 0.25);
          letter-spacing: -0.01em;
        }

        .cs-console-sub {
          font-size: 16px;
          color: rgba(255, 255, 255, 0.85);
        }

        .cs-console-sub b { color: rgba(255, 255, 255, 0.9); }

        /* Stepper */

        .cs-stepper { margin-top: 50px; margin-bottom: 16px; }

        .cs-stepper-labels {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          margin-bottom: 8px;
        }

        .cs-stepper-labels span {
          font-size: 12px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.78);
          transition: color 0.4s ease;
        }

        .cs-stepper-labels span.is-active { color: var(--cs-timeline-green); }

        .cs-stepper-track {
          position: relative;
          height: 6px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.12);
          margin-bottom: 6px;
        }

        .cs-stepper-fill {
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          border-radius: 999px;
          background: var(--cs-timeline-green);
          box-shadow: 0 0 12px rgba(46, 155, 98, 0.55);
        }

        .cs-stepper-marker {
          position: absolute;
          top: 50%;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: var(--cs-navy);
          border: 2px solid var(--cs-timeline-green);
          box-shadow: 0 0 14px rgba(46, 155, 98, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          transform: translate(-50%, -50%);
        }

        .cs-stepper-marker svg { width: 11px; height: 11px; color: var(--cs-timeline-green); }

        .cs-stepper-times {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
        }

        .cs-stepper-times span {
          font-size: 11px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.72);
          transition: color 0.4s ease;
        }

        .cs-stepper-times span.is-active { color: var(--cs-timeline-green); }

        /* Tiles */

        .cs-tile-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin-top: auto;
        }

        .cs-tile {
          padding: 10px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
          transition: all 0.5s ease;
          text-align: left !important;
        }

        .cs-tile.is-done {
          background: rgba(0, 128, 128, 0.18);
          border-color: rgba(102, 179, 179, 0.5);
        }

        .cs-tile.is-active {
          background: linear-gradient(135deg, var(--cs-teal-3) 0%, var(--cs-teal-2) 100%);
          border-color: var(--cs-gold-soft);
          transform: translateY(-3px);
          box-shadow: 0 14px 28px rgba(0, 87, 88, 0.45), 0 0 0 1px var(--cs-gold-soft);
        }

        .cs-tile-tag {
          display: block;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.05em;
          color: rgba(255, 255, 255, 0.8);
          margin-bottom: 6px;
          text-align: left !important;
        }

        .cs-tile.is-active .cs-tile-tag { color: rgba(255, 255, 255, 0.85); }

        .cs-tile-title {
          display: block;
          font-size: 13px;
          font-weight: 700;
          margin-bottom: 3px;
          text-align: left !important;
        }

        .cs-tile-detail {
          display: block;
          font-size: 11px;
          line-height: 1.35;
          color: rgba(255, 255, 255, 0.82);
          text-align: left !important;
        }

        .cs-tile.is-active .cs-tile-detail { color: rgba(255, 255, 255, 0.9); }

        .cs-splash-action {
          display: none;
        }

        /* =====================================================
           RIGHT - login form (Desktop)
           ===================================================== */

        .cs-form-area {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px;
        }

        .cs-mobile-login-top {
          display: none;
        }

        .cs-login-card {
          width: 100%;
          max-width: 380px;
          background: #fdfcfb;
          border-radius: 16px;
          padding: 26px;
          position: relative;
          box-shadow:
            0 30px 70px rgba(18, 59, 74, 0.35),
            0 8px 24px rgba(18, 59, 74, 0.18),
            inset 0 1px 0 rgba(255, 255, 255, 0.6);
        }

        .cs-login-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 16px;
          right: 16px;
          height: 3px;
          border-radius: 0 0 3px 3px;
          background: linear-gradient(90deg, var(--cs-gold) 0%, #f4e5b8 50%, var(--cs-gold) 100%);
        }

        .cs-form-bordered-box {
          border: none;
          background: transparent;
          padding: 0;
          box-shadow: none;
        }

        .cs-form-bordered-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }

        .cs-form-bordered-title {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 22px;
          font-weight: 800;
          color: var(--cs-ink);
          margin: 0;
        }

        .cs-secure-ssl-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          font-weight: 700;
          color: var(--cs-brand-green);
          background: rgba(0, 130, 132, 0.08);
          border: 1px solid rgba(0, 130, 132, 0.2);
          padding: 3px 8px;
          border-radius: 999px;
        }

        .cs-input-icon-pill {
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--cs-muted);
          flex-shrink: 0;
        }

        .cs-mobile-trust-footer {
          display: none;
        }

        .cs-eyebrow {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--cs-muted);
          margin-bottom: 6px;
        }

        .cs-login-card h1 {
          margin: 0 0 16px;
          font-size: 24px;
          color: var(--cs-ink);
        }

        .cs-login-sub {
          margin: 0 0 16px;
          font-size: 13px;
          color: var(--cs-muted);
          line-height: 1.4;
        }

        .cs-alert {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 12px 14px;
          border-radius: 10px;
          background: #fdecea;
          border: 1px solid #e0554a;
          margin-bottom: 16px;
          font-size: 12.5px;
          line-height: 1.4;
          color: #b3261e;
        }

        .cs-alert svg { flex-shrink: 0; margin-top: 1px; color: #d64540; }

        .cs-form { display: flex; flex-direction: column; gap: 14px; }

        .cs-label {
          display: block;
          font-size: 10.5px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--cs-muted);
          margin-bottom: 6px;
        }

        .cs-input-wrapper {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 12px;
          border: 1px solid var(--cs-border);
          border-radius: 10px;
          background: #ffffff;
        }

        .cs-input-wrapper:focus-within {
          border-color: #c7d2dd;
          box-shadow: none;
        }

        .cs-input-wrapper.cs-input-error {
          border-color: #e0554a;
          box-shadow: none;
        }

        .cs-input-icon { flex-shrink: 0; color: var(--cs-muted); }

        .cs-input {
          flex: 1;
          border: none;
          background: transparent;
          padding: 11px 0;
          font-size: 14px;
          color: var(--cs-ink);
          min-width: 0;
        }

        .cs-input:focus { outline: none; }

        .cs-input:-webkit-autofill,
        .cs-input:-webkit-autofill:hover,
        .cs-input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px #ffffff inset;
          -webkit-text-fill-color: var(--cs-ink);
        }

        .cs-password-button {
          flex-shrink: 0;
          background: transparent;
          border: none;
          padding: 4px;
          color: var(--cs-muted);
          cursor: pointer;
        }

        .cs-password-button:hover:not(:disabled) {
          background: transparent;
          box-shadow: none;
          color: var(--cs-teal-4);
        }

        .cs-field-error {
          margin: 4px 0 0;
          font-size: 11.5px;
          font-weight: 600;
          color: #b3261e;
        }

        .cs-remember-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .cs-remember {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          color: #4a453f;
          cursor: pointer;
        }

        .cs-checkbox {
          width: 15px;
          height: 15px;
          accent-color: var(--cs-brand-green);
        }

        .cs-forgot-link {
          margin: 0;
          padding: 0;
          background: transparent;
          border: none;
          font-size: 12px;
          font-weight: 700;
          color: var(--cs-teal-2);
          text-decoration: underline;
          flex-shrink: 0;
          cursor: pointer;
        }

        .cs-forgot-link:hover { color: var(--cs-teal-4); }

        .cs-error {
          font-size: 12px;
          font-weight: 600;
          color: #b3261e;
        }

        .cs-submit {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 13px;
          border: none;
          border-radius: 10px;
          background: linear-gradient(135deg, var(--cs-teal-3) 0%, var(--cs-teal-2) 100%);
          color: #ffffff;
          font-size: 14.5px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 10px 24px rgba(0, 130, 132, 0.35);
        }

        .cs-submit:hover:not(:disabled) {
          background: linear-gradient(135deg, var(--cs-teal-3) 0%, var(--cs-teal-2) 100%);
          box-shadow: 0 14px 30px rgba(0, 130, 132, 0.45);
          filter: brightness(1.06);
        }
        .cs-submit:disabled { opacity: 0.7; cursor: not-allowed; }

        .cs-spinner {
          width: 15px;
          height: 15px;
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.4);
          border-top-color: #ffffff;
          animation: cs-spin 0.7s linear infinite;
        }

        @keyframes cs-spin { to { transform: rotate(360deg); } }

        .cs-track-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px;
          border-radius: 10px;
          background: transparent;
          border: 1px solid var(--cs-border);
          color: var(--cs-ink);
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }

        .cs-track-button:hover:not(:disabled) {
          background: #f7faff;
          box-shadow: none;
          border-color: var(--cs-teal-4);
        }

        .cs-forgot-sent {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 10px;
        }

        .cs-forgot-sent-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: rgba(46, 155, 98, 0.1);
          color: var(--cs-brand-green);
          margin-bottom: 4px;
        }

        .cs-forgot-sent .cs-submit { margin-top: 8px; width: 100%; }

        /* =================================================================
           MOBILE RESOLUTION (<= 980px): 2-Step Splash & Dedicated Login Sheet
           ================================================================= */

        @media (max-width: 980px) {
          .cs-login-page {
            flex-direction: column;
            width: 100%;
            min-height: 100vh;
            min-height: 100dvh;
            height: auto;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
            background: var(--cs-teal-1);
          }

          /* --- Step 1: Mobile Splash Screen --- */
          .mobile-view-splash .cs-console {
            display: flex !important;
            flex-direction: column !important;
            min-height: 100vh !important;
            min-height: 100dvh !important;
            height: auto !important;
            padding: 16px 16px 85px !important; /* space for fixed continue button */
            justify-content: flex-start !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
            -webkit-overflow-scrolling: touch;
            position: relative !important;
          }

          .mobile-view-splash .cs-form-area {
            display: none !important;
          }

          .mobile-view-splash .cs-console-header {
            display: flex !important;
            padding-bottom: 6px !important;
            margin-bottom: 4px !important;
          }

          .mobile-view-splash .cs-console-brand {
            font-size: 14px !important;
            gap: 7px !important;
          }

          .mobile-view-splash .cs-console-brand-logo {
            width: 20px !important;
            height: 20px !important;
          }

          .mobile-view-splash .cs-console-eyebrow {
            font-size: 10.5px !important;
            display: block !important;
            margin-bottom: 2px !important;
            color: var(--cs-gold) !important;
          }

          .mobile-view-splash .cs-console-headline {
            font-size: 32px !important;
            display: block !important;
            margin: 2px 0 2px !important;
            line-height: 1 !important;
          }

          .mobile-view-splash .cs-console-sub {
            display: block !important;
            font-size: 12px !important;
            line-height: 1.3 !important;
            color: rgba(255, 255, 255, 0.85) !important;
            margin: 0 0 6px !important;
          }

          .mobile-view-splash .cs-stepper {
            margin: 6px 0 8px !important;
          }

          .mobile-view-splash .cs-stepper-labels span {
            font-size: 9.5px !important;
          }

          .mobile-view-splash .cs-stepper-track {
            height: 5px !important;
            margin-bottom: 4px !important;
          }

          .mobile-view-splash .cs-stepper-marker {
            width: 16px !important;
            height: 16px !important;
          }

          .mobile-view-splash .cs-stepper-marker svg {
            width: 9px !important;
            height: 9px !important;
          }

          .mobile-view-splash .cs-stepper-times span {
            font-size: 9px !important;
          }

          .mobile-view-splash .cs-tile-grid {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 6px !important;
            margin: 6px 0 12px !important;
          }

          .mobile-view-splash .cs-tile {
            padding: 7px 8px !important;
            border-radius: 8px !important;
            text-align: left !important;
          }

          .mobile-view-splash .cs-tile-tag {
            font-size: 7.5px !important;
            margin-bottom: 2px !important;
            text-align: left !important;
          }

          .mobile-view-splash .cs-tile-title {
            font-size: 10.5px !important;
            font-weight: 700 !important;
            margin-bottom: 1px !important;
            white-space: normal !important;
            text-align: left !important;
          }

          .mobile-view-splash .cs-tile-detail {
            display: block !important;
            font-size: 9px !important;
            line-height: 1.25 !important;
            text-align: left !important;
          }

          .mobile-view-splash .cs-splash-action {
            display: flex !important;
            position: fixed !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            width: 100% !important;
            padding: 10px 16px max(12px, env(safe-area-inset-bottom, 12px)) !important;
            background: linear-gradient(180deg, rgba(18, 59, 74, 0) 0%, rgba(18, 59, 74, 0.95) 28%, #123B4A 100%) !important;
            backdrop-filter: blur(8px) !important;
            -webkit-backdrop-filter: blur(8px) !important;
            z-index: 100 !important;
            box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.35) !important;
            margin: 0 !important;
            pointer-events: auto !important;
          }

          .cs-splash-continue-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            width: 100%;
            height: 48px;
            padding: 12px 20px;
            border-radius: 999px;
            background: linear-gradient(135deg, var(--cs-teal-3) 0%, var(--cs-teal-2) 100%);
            color: #ffffff;
            font-size: 15px;
            font-weight: 700;
            border: 1.5px solid var(--cs-gold-soft);
            box-shadow: 0 8px 24px rgba(0, 130, 132, 0.5), 0 2px 6px rgba(0, 0, 0, 0.2);
            cursor: pointer;
            transition: all 0.2s ease;
            position: relative;
            overflow: hidden;
            z-index: 101;
            pointer-events: auto;
          }

          .cs-splash-continue-btn:hover {
            filter: brightness(1.08);
            transform: translateY(-1px);
          }

          .cs-splash-continue-btn:active {
            transform: scale(0.98);
          }

          /* --- Step 2: Dedicated Mobile Login Screen --- */
          .mobile-view-login .cs-console {
            display: none !important;
          }

          .mobile-view-login .cs-form-area {
            display: flex !important;
            flex-direction: column !important;
            height: 100vh;
            height: 100dvh;
            padding: 0 !important;
            background: linear-gradient(175deg, #0d2c37 0%, #123B4A 45%, #004d4f 100%) !important;
            justify-content: flex-start !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
            position: relative !important;
          }

          .mobile-view-login .cs-form-area::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 320px;
            background: radial-gradient(circle at 80% 25%, rgba(0, 212, 214, 0.18) 0%, transparent 65%),
                        radial-gradient(circle at 20% 60%, rgba(217, 154, 24, 0.12) 0%, transparent 55%);
            pointer-events: none;
            z-index: 0;
          }

          .mobile-view-login .cs-mobile-login-top {
            display: flex !important;
            flex-direction: column !important;
            padding: 20px 20px 16px !important;
            color: #ffffff !important;
            position: relative !important;
            z-index: 1 !important;
            flex-shrink: 0 !important;
          }

          .cs-mobile-back-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.18);
            border-radius: 999px;
            padding: 6px 14px;
            color: #ffffff;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            align-self: flex-start;
            margin-bottom: 16px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            transition: all 0.2s ease;
          }

          .cs-mobile-back-btn:hover {
            background: rgba(255, 255, 255, 0.2);
            transform: translateY(-1px);
          }

          .cs-mobile-greeting-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 14px;
            width: 100%;
          }

          .cs-mobile-hero-badge {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 3px 10px;
            border-radius: 999px;
            background: rgba(217, 154, 24, 0.18);
            border: 1px solid rgba(217, 154, 24, 0.4);
            color: #fce38a;
            font-size: 10.5px;
            font-weight: 700;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            margin-bottom: 6px;
          }

          .cs-mobile-greeting-title {
            font-size: 29px;
            font-weight: 800;
            margin: 0 0 4px;
            color: #ffffff;
            letter-spacing: -0.02em;
            text-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
          }

          .cs-mobile-greeting-sub {
            font-size: 13px;
            color: rgba(255, 255, 255, 0.85);
            margin: 0;
            line-height: 1.35;
          }

          /* Motor illustration emblem with glowing animation */
          .cs-mobile-motor-container {
            position: relative;
            width: 78px;
            height: 78px;
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .cs-mobile-motor-ring {
            position: absolute;
            inset: -4px;
            border-radius: 50%;
            border: 2px dashed rgba(102, 179, 181, 0.35);
            animation: cs-spin-slow 18s linear infinite;
          }

          .cs-mobile-motor-pulse {
            position: absolute;
            inset: 0;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(0, 212, 214, 0.35) 0%, transparent 70%);
            animation: cs-pulse 2.5s ease-in-out infinite;
          }

          .cs-mobile-motor-badge {
            position: relative;
            width: 70px;
            height: 70px;
            border-radius: 50%;
            background: linear-gradient(135deg, rgba(0, 130, 132, 0.6) 0%, rgba(18, 59, 74, 0.85) 100%);
            border: 2px solid rgba(102, 179, 181, 0.6);
            box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35), inset 0 2px 6px rgba(255, 255, 255, 0.2);
            display: flex;
            align-items: center;
            justify-content: center;
            animation: cs-car-float 3s ease-in-out infinite alternate;
          }

          .cs-mobile-motor-badge svg {
            color: #a5f3fc;
            filter: drop-shadow(0 3px 10px rgba(0, 212, 214, 0.8));
          }

          @keyframes cs-car-float {
            0% { transform: translateY(0px); }
            100% { transform: translateY(-4px); }
          }

          @keyframes cs-spin-slow {
            to { transform: rotate(360deg); }
          }

          @keyframes cs-pulse {
            0%, 100% { transform: scale(0.95); opacity: 0.5; }
            50% { transform: scale(1.15); opacity: 0.85; }
          }

          /* --- Modern Animated Login Card Sheet --- */
          .mobile-view-login .cs-login-card {
            flex: 1 !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: flex-start !important;
            width: 100% !important;
            max-width: 100% !important;
            background: #ffffff !important;
            border-radius: 30px 30px 0 0 !important;
            padding: 24px 20px 28px !important;
            box-shadow: 0 -16px 45px rgba(8, 28, 40, 0.45) !important;
            margin: 8px 0 0 !important;
            position: relative !important;
            z-index: 2 !important;
            overflow: hidden !important;
          }

          /* Animated glowing top border on the card */
          .mobile-view-login .cs-login-card::before {
            content: '' !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            height: 4px !important;
            border-radius: 30px 30px 0 0 !important;
            background: linear-gradient(90deg, #008284, #D99A18, #2E9B62, #008284) !important;
            background-size: 200% 100% !important;
            animation: cs-border-glow 4s linear infinite !important;
          }

          @keyframes cs-border-glow {
            0% { background-position: 0% 50%; }
            100% { background-position: 200% 50%; }
          }

          .mobile-view-login .cs-eyebrow {
            display: none !important;
          }

          /* Form Frame Box with Border & Subtle Shadow */
          .cs-form-bordered-box {
            border: 1.5px solid rgba(0, 130, 132, 0.22);
            border-radius: 20px;
            background: linear-gradient(180deg, #ffffff 0%, #f7faf9 100%);
            padding: 18px 16px 16px;
            box-shadow:
              0 12px 28px rgba(18, 59, 74, 0.07),
              0 2px 6px rgba(0, 0, 0, 0.02),
              inset 0 1px 0 rgba(255, 255, 255, 0.9);
            position: relative;
            margin-bottom: 16px;
          }

          .cs-form-bordered-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 14px;
            padding-bottom: 10px;
            border-bottom: 1px solid rgba(0, 130, 132, 0.1);
          }

          .cs-form-bordered-title {
            font-size: 19px;
            font-weight: 800;
            color: var(--cs-teal-1);
            letter-spacing: -0.01em;
            margin: 0;
            display: flex;
            align-items: center;
            gap: 6px;
          }

          .cs-secure-ssl-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 11px;
            font-weight: 700;
            color: var(--cs-brand-green);
            background: rgba(0, 130, 132, 0.08);
            border: 1px solid rgba(0, 130, 132, 0.2);
            padding: 3px 8px;
            border-radius: 999px;
          }

          .mobile-view-login .cs-form {
            gap: 12px !important;
          }

          .mobile-view-login .cs-label {
            display: block !important;
            font-size: 11px !important;
            font-weight: 700 !important;
            letter-spacing: 0.04em !important;
            text-transform: uppercase !important;
            color: #4b5563 !important;
            margin-bottom: 5px !important;
          }

          .mobile-view-login .cs-input-wrapper {
            height: 48px !important;
            border-radius: 999px !important;
            background: #ffffff !important;
            border: 1.5px solid #d9e2ec !important;
            padding: 0 6px 0 6px !important;
            gap: 8px !important;
            transition: all 0.25s ease !important;
            box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.03) !important;
          }

          .mobile-view-login .cs-input-wrapper:focus-within {
            border-color: var(--cs-teal-3) !important;
            background: #ffffff !important;
            box-shadow: 0 0 0 3.5px rgba(0, 130, 132, 0.18), 0 4px 12px rgba(0, 130, 132, 0.08) !important;
            transform: translateY(-1px);
          }

          .cs-input-icon-pill {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: rgba(0, 130, 132, 0.08);
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--cs-brand-green);
            flex-shrink: 0;
            transition: background 0.2s ease, color 0.2s ease;
          }

          .mobile-view-login .cs-input-wrapper:focus-within .cs-input-icon-pill {
            background: var(--cs-brand-green);
            color: #ffffff;
          }

          .mobile-view-login .cs-input {
            font-size: 14.5px !important;
            padding: 8px 4px !important;
            color: var(--cs-ink) !important;
            font-weight: 500 !important;
          }

          .mobile-view-login .cs-remember-row {
            display: flex !important;
            align-items: center !important;
            justify-content: flex-end !important;
            margin: 2px 0 2px !important;
          }

          .mobile-view-login .cs-remember {
            display: none !important;
          }

          .mobile-view-login .cs-forgot-link {
            font-size: 12.5px !important;
            font-weight: 700 !important;
            color: var(--cs-teal-3) !important;
            text-decoration: none !important;
            transition: color 0.2s ease;
          }

          .mobile-view-login .cs-forgot-link:hover {
            color: var(--cs-teal-2) !important;
            text-decoration: underline !important;
          }

          /* Shimmering Animated Login Button */
          .mobile-view-login .cs-submit {
            position: relative !important;
            overflow: hidden !important;
            height: 50px !important;
            border-radius: 999px !important;
            font-size: 15.5px !important;
            font-weight: 700 !important;
            letter-spacing: 0.02em !important;
            background: linear-gradient(135deg, var(--cs-teal-3) 0%, var(--cs-teal-2) 100%) !important;
            box-shadow: 0 10px 26px rgba(0, 130, 132, 0.4) !important;
            margin-top: 6px !important;
            width: 100% !important;
            border: 1px solid rgba(255, 255, 255, 0.25) !important;
            transition: all 0.25s ease !important;
          }

          .mobile-view-login .cs-submit::after {
            content: '';
            position: absolute;
            top: -50%;
            left: -60%;
            width: 40%;
            height: 200%;
            background: linear-gradient(
              to right,
              rgba(255, 255, 255, 0) 0%,
              rgba(255, 255, 255, 0.35) 50%,
              rgba(255, 255, 255, 0) 100%
            );
            transform: rotate(25deg);
            animation: cs-shimmer 3.2s infinite ease-in-out;
          }

          @keyframes cs-shimmer {
            0% { left: -60%; }
            40%, 100% { left: 140%; }
          }

          .mobile-view-login .cs-submit:active {
            transform: scale(0.98);
            box-shadow: 0 4px 14px rgba(0, 130, 132, 0.3) !important;
          }

          .mobile-view-login .cs-alert {
            padding: 10px 12px !important;
            border-radius: 12px !important;
            margin-bottom: 12px !important;
            font-size: 12.5px !important;
          }

          /* Bottom Trust Badges */
          .cs-mobile-trust-footer {
            display: flex;
            align-items: center;
            justify-content: space-around;
            padding: 10px 6px;
            background: #f8fafc;
            border: 1px solid #edf2f7;
            border-radius: 14px;
            margin-top: auto;
          }

          .cs-trust-pill {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            font-size: 10.5px;
            font-weight: 700;
            color: #64748b;
          }

          .cs-trust-pill svg {
            color: var(--cs-brand-green);
          }
        }
      `}</style>

      <main className={`cs-login-page mobile-view-${mobileView}`}>
        {/* =====================================================
            LEFT / SPLASH - Settlement Promotion Console
            ===================================================== */}
        <section className="cs-console">
          <div className="cs-console-header">
            <span className="cs-console-brand">
              <img src="/claimshield-logo-green.png" alt="" className="cs-console-brand-logo" />
              CLAIMSHIELD+
            </span>
          </div>

          <div className="cs-console-eyebrow">Fast track OD settlement</div>
          <h1 className="cs-console-headline">30 min</h1>
          <p className="cs-console-sub">
            Not 5-7 days · Dents, windshield glass and scratches, settled while you wait
          </p>

          <div className="cs-stepper">
            <div className="cs-stepper-labels">
              {STEPPER_STAGES.map((stage, i) => (
                <span key={stage.label} className={i === activeStep ? "is-active" : ""}>
                  {stage.label}
                </span>
              ))}
            </div>

            <div className="cs-stepper-track">
              <motion.div
                className="cs-stepper-fill"
                animate={{ width: `${(activeStep / (STEPPER_STAGES.length - 1)) * 100}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
              <motion.div
                className="cs-stepper-marker"
                animate={{ left: `${(activeStep / (STEPPER_STAGES.length - 1)) * 100}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              >
                <Car />
              </motion.div>
            </div>

            <div className="cs-stepper-times">
              {STEPPER_STAGES.map((stage, i) => (
                <span key={stage.stepLabel} className={i === activeStep ? "is-active" : ""}>
                  {stage.stepLabel}
                </span>
              ))}
            </div>
          </div>

          <div className="cs-tile-grid">
            {JOURNEY_TILES.map((tile, i) => {
              const isDone = i < activeStep;
              const isActive = i === activeStep;

              return (
                <div
                  key={tile.title}
                  className={`cs-tile${isDone ? " is-done" : ""}${isActive ? " is-active" : ""}`}
                >
                  <span className="cs-tile-tag">{tile.step}</span>
                  <span className="cs-tile-title">{tile.title}</span>
                  <span className="cs-tile-detail">{tile.detail}</span>
                </div>
              );
            })}
          </div>

          {/* Mobile Splash "Continue" Action Button */}
          <div className="cs-splash-action">
            <button
              type="button"
              className="cs-splash-continue-btn"
              onClick={() => setMobileView("login")}
            >
              <span>Continue to Sign In</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </section>

        {/* =====================================================
            RIGHT / LOGIN SCREEN - Login Form Sheet
            ===================================================== */}
        <section className="cs-form-area">
          {/* Mobile Greeting Bar with Motor Illustration */}
          <div className="cs-mobile-login-top">
            <button
              type="button"
              className="cs-mobile-back-btn"
              onClick={() => setMobileView("splash")}
            >
              <ArrowLeft size={15} />
              <span>Back to highlights</span>
            </button>

            <div className="cs-mobile-greeting-row">
              <div className="cs-mobile-greeting-text">
                <span className="cs-mobile-hero-badge">
                  <Sparkles size={11} /> Motor OD Fast-Track
                </span>
                <h2 className="cs-mobile-greeting-title">Welcome Back!</h2>
                <p className="cs-mobile-greeting-sub">Sign in to your ClaimShield+ portal</p>
              </div>

              <div className="cs-mobile-motor-container">
                <div className="cs-mobile-motor-ring" />
                <div className="cs-mobile-motor-pulse" />
                <div className="cs-mobile-motor-badge">
                  <Car size={34} />
                </div>
              </div>
            </div>
          </div>

          <motion.div
            className="cs-login-card"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            {mode === "forgot-sent" ? (
              <div className="cs-forgot-sent">
                <div className="cs-forgot-sent-icon">
                  <Mail size={24} />
                </div>
                <h1>Check your email</h1>
                <p className="cs-login-sub">
                  If an account exists for <strong>{resetEmail}</strong>, we've sent
                  password reset instructions to your registered email.
                </p>
                <button type="button" className="cs-submit" onClick={() => setMode("login")}>
                  Back to sign in
                  <ArrowRight size={16} />
                </button>
              </div>
            ) : mode === "forgot" ? (
              <div className="cs-form-bordered-box">
                <div className="cs-form-bordered-header">
                  <h3 className="cs-form-bordered-title">
                    <LockKeyhole size={18} /> Reset Password
                  </h3>
                  <span className="cs-secure-ssl-badge">
                    <ShieldCheck size={13} /> Secure Verification
                  </span>
                </div>
                <p className="cs-login-sub">
                  Enter your registered email and we'll send you instructions to reset it.
                </p>

                <form onSubmit={handleForgotPassword} className="cs-form">
                  <div>
                    <label htmlFor="resetEmail" className="cs-label">Email address</label>
                    <div className="cs-input-wrapper">
                      <span className="cs-input-icon-pill">
                        <Mail size={16} />
                      </span>
                      <input
                        id="resetEmail"
                        type="email"
                        autoComplete="email"
                        value={resetEmail}
                        onChange={(event) => setResetEmail(event.target.value)}
                        placeholder="Email"
                        disabled={resetLoading}
                        className="cs-input"
                      />
                    </div>
                  </div>

                  {resetError && <div className="cs-error">{resetError}</div>}

                  <button type="submit" disabled={resetLoading} className="cs-submit">
                    {resetLoading ? (
                      <>
                        <span className="cs-spinner" />
                        Sending&hellip;
                      </>
                    ) : (
                      <>
                        Send reset instructions
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>

                  <button type="button" className="cs-track-button" onClick={() => setMode("login")}>
                    Back to sign in
                  </button>
                </form>
              </div>
            ) : (
              <>
                <div className="cs-form-bordered-box">
                  <div className="cs-form-bordered-header">
                    <h3 className="cs-form-bordered-title">
                      <LockKeyhole size={18} /> Sign In
                    </h3>

                  </div>

                  {error && (
                    <div className="cs-alert">
                      <AlertCircle size={16} />
                      <span>
                        <strong>{error}</strong>
                      </span>
                    </div>
                  )}

                  <form onSubmit={handleLogin} className="cs-form">
                    <div>
                      <label htmlFor="email" className="cs-label">Email address</label>
                      <div className="cs-input-wrapper">
                        <span className="cs-input-icon-pill">
                          <Mail size={16} />
                        </span>
                        <input
                          id="email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          placeholder="Email"
                          disabled={loading}
                          className="cs-input"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="password" className="cs-label">Password</label>
                      <div className={`cs-input-wrapper${error ? " cs-input-error" : ""}`}>
                        <span className="cs-input-icon-pill">
                          <LockKeyhole size={16} />
                        </span>
                        <input
                          id="password"
                          name="password"
                          type={showPassword ? "text" : "password"}
                          autoComplete="current-password"
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          placeholder="Password"
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
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {error && <p className="cs-field-error">Incorrect password</p>}
                    </div>

                    <div className="cs-remember-row">
                      <label className="cs-remember">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(event) => setRememberMe(event.target.checked)}
                          className="cs-checkbox"
                        />
                        Keep me signed in
                      </label>

                      <button
                        type="button"
                        className="cs-forgot-link"
                        onClick={() => {
                          setResetEmail(email);
                          setResetError("");
                          setMode("forgot");
                        }}
                      >
                        Forgot Password
                      </button>
                    </div>

                    <button type="submit" disabled={loading} className="cs-submit">
                      {loading ? (
                        <>
                          <span className="cs-spinner" />
                          Signing in&hellip;
                        </>
                      ) : (
                        <>
                          Login
                          <ArrowRight size={16} />
                        </>
                      )}
                    </button>
                  </form>
                </div>

                <div className="cs-mobile-trust-footer">
                  <span className="cs-trust-pill">
                    <ShieldCheck size={13} /> IRDAI Regulated
                  </span>
                  <span className="cs-trust-pill">
                    <Zap size={13} /> 30-Min Fast Track
                  </span>
                  <span className="cs-trust-pill">
                    <CheckCircle2 size={13} /> Verified Portal
                  </span>
                </div>
              </>
            )}
          </motion.div>
        </section>
      </main>
    </>
  );
}

export default LoginPage;