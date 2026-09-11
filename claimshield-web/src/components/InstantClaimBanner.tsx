import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Zap, FileText, ShieldCheck, Wallet, ArrowRight } from 'lucide-react'

const MINI_STEPS = [
  { Icon: FileText, label: 'Report' },
  { Icon: ShieldCheck, label: 'Verify' },
  { Icon: Wallet, label: 'Instant payout' },
]

export function InstantClaimBanner() {
  return (
    <motion.section
      className="instant-claim-banner"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <div className="instant-claim-banner-main">
        <div className="instant-claim-banner-icon-wrap">
          <motion.div
            className="instant-claim-banner-icon"
            animate={{ scale: [1, 1.08, 1], opacity: [0.92, 1, 0.92] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Zap size={14} fill="currentColor" />
          </motion.div>
        </div>

        <div className="instant-claim-banner-body">
          <span className="instant-claim-banner-tag">Instant Payout</span>
          <h2>Minor accident? Get paid in under 30 minutes</h2>
          <p>
            Fast-track settlement for minor damages without surveyor delays.
          </p>
        </div>
      </div>

      <div className="instant-claim-banner-footer">
        <div className="instant-claim-banner-steps">
          {MINI_STEPS.map(({ Icon, label }, index) => (
            <span key={label} className="instant-claim-banner-step">
              <Icon size={10} />
              {label}
              {index < MINI_STEPS.length - 1 && <span className="instant-claim-step-arrow" aria-hidden="true">→</span>}
            </span>
          ))}
        </div>

        <Link to="/my-claims/new" className="instant-claim-banner-cta">
          Check eligibility
          <ArrowRight size={11} />
        </Link>
      </div>
    </motion.section>
  )
}
