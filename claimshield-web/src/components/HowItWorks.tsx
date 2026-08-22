import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Play } from 'lucide-react'
import step1 from '../assets/illustrations/step1-report-claim.svg'
import step2 from '../assets/illustrations/step2-verify-instantly.svg'
import step3 from '../assets/illustrations/step3-get-paid.svg'
import { Modal } from './Modal'

const STEPS = [
  {
    image: step1,
    title: 'Report your claim',
    description: 'Add the incident details and a few photos - it takes a few minutes.',
  },
  {
    image: step2,
    title: 'We verify instantly',
    description:
      'For minor accidents, we check your documents and vehicle details automatically, right away.',
  },
  {
    image: step3,
    title: 'Get paid',
    description:
      'Claims that qualify move straight to payment. Everything else goes to a surveyor for a full assessment.',
  },
]

export function HowItWorks() {
  const [showVideo, setShowVideo] = useState(false)
  const [videoError, setVideoError] = useState(false)
  const [showHint, setShowHint] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setShowHint(false), 8000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <section className="card how-it-works">
      <div className="how-it-works-header">
        <h2>Every Minute Matters. See How We Move You Forward.</h2>

        <div className="how-it-works-play-wrap">
          {showHint && (
            <span className="how-it-works-play-hint">
              👀 Watch how it works
            </span>
          )}

          <button
            type="button"
            className={`how-it-works-play-button${showHint ? ' is-blinking' : ''}`}
            onClick={() => {
              setVideoError(false)
              setShowVideo(true)
              setShowHint(false)
            }}
            aria-label="Watch how ClaimShield works"
          >
            <Play size={14} fill="currentColor" />
            Watch video
          </button>
        </div>
      </div>

      <div className="how-it-works-grid">
        {STEPS.map((step, index) => (
          <motion.div
            key={step.title}
            className="how-it-works-step"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: index * 0.12, ease: 'easeOut' }}
          >
            <img src={step.image} alt="" className="how-it-works-illustration" />
            <h3>{step.title}</h3>
            <p>{step.description}</p>
          </motion.div>
        ))}
      </div>

      <Modal
        open={showVideo}
        onClose={() => setShowVideo(false)}
        bare
      >
        {videoError ? (
          <div className="how-it-works-video-error">
            <p>The video couldn't be loaded.</p>
          </div>
        ) : (
          <video
            className="how-it-works-video"
            controls
            onError={() => setVideoError(true)}
          >
            <source src="/customer-journey.mp4" type="video/mp4" />
          </video>
        )}
      </Modal>
    </section>
  )
}