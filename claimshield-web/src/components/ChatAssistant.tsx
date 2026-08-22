import { useEffect, useRef, useState, type FormEvent, type ComponentType } from 'react'
import { useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Send,
  Mic,
  Volume2,
  VolumeX,
  Bot,
  Sparkles,
  User,
  ClipboardList,
  ChevronDown,
  Gauge,
  Eye,
  Wrench,
} from 'lucide-react'
import { ApiError, getMyClaims, getMyCustomerProfile, sendAiChatMessage } from '../lib/api'
import type { ClaimResponseDto } from '../lib/types'
import { useAuth } from '../context/AuthContext'
import { MovoAvatar } from './MovoAvatar'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
}

interface QuickPrompt {
  label: string
  text: string
  icon: ComponentType<{ size?: number }>
}

const QUICK_PROMPTS: QuickPrompt[] = [
  { label: 'Claim status', text: 'What is the status of my claim?', icon: Gauge },
  { label: 'My Surveyor', text: 'Who is my surveyor?', icon: Eye },
  { label: 'My Repairer', text: 'Who is repairing my vehicle?', icon: Wrench },
]

function getSpeechRecognitionCtor() {
  return (
    (window as unknown as { SpeechRecognition?: new () => SpeechRecognition })
      .SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognition })
      .webkitSpeechRecognition ??
    null
  )
}

const SPEECH_INPUT_SUPPORTED = typeof window !== 'undefined' && !!getSpeechRecognitionCtor()
const SPEECH_OUTPUT_SUPPORTED = typeof window !== 'undefined' && 'speechSynthesis' in window

export function ChatAssistant() {
  const { displayName } = useAuth()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [showGreeting, setShowGreeting] = useState(false)
  const [claims, setClaims] = useState<ClaimResponseDto[]>([])
  const [claimId, setClaimId] = useState('')
  const [claimsLoaded, setClaimsLoaded] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [listening, setListening] = useState(false)
  const [muted, setMuted] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const loadedClaimsRef = useRef(false)
  const prevPathRef = useRef(location.pathname)

  const firstName = displayName?.trim().split(' ')[0] || 'there'

  // Highlight the assistant with a one-time welcome bubble shortly after
  // sign-in, then settle back to its normal, unobtrusive icon state.
  useEffect(() => {
    const showTimer = setTimeout(() => setShowGreeting(true), 700)
    const hideTimer = setTimeout(() => setShowGreeting(false), 7500)
    return () => {
      clearTimeout(showTimer)
      clearTimeout(hideTimer)
    }
  }, [])

  const handleBubbleClick = () => {
    setShowGreeting(false)
    setOpen((o) => !o)
  }

  useEffect(() => {
    if (!open || loadedClaimsRef.current) return
    loadedClaimsRef.current = true

    getMyCustomerProfile()
      .then((customer) => getMyClaims(customer.customerId))
      .then((data) => {
        setClaims(data)
        if (data.length > 0) setClaimId(data[0].claimId)
      })
      .catch(() => {
        /* Chat still works without a pre-selected claim - the assistant
           will ask for a claim number in that case. */
      })
      .finally(() => setClaimsLoaded(true))
  }, [open])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  const speak = (text: string) => {
    if (muted || !SPEECH_OUTPUT_SUPPORTED) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-IN'
    window.speechSynthesis.speak(utterance)
  }

  // Auto-open Movo with a spoken welcome whenever the customer
  // navigates TO the Track Claim page (not on every re-render while
  // already there - prevPathRef guards against that).
  useEffect(() => {
    const cameFromElsewhere = prevPathRef.current !== location.pathname
    prevPathRef.current = location.pathname

    if (location.pathname !== '/track-claim' || !cameFromElsewhere) return

    const greeting = `Hi ${firstName}, I'm Movo, your smart assistant here to help you.`

    setShowGreeting(false)
    setOpen(true)
    setMessages((prev) => [
      ...prev,
      {
        id: `track-greet-${Date.now()}`,
        role: 'assistant',
        text: greeting,
      },
    ])
    speak(greeting)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, firstName])

  const send = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || sending) return

    setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'user', text: trimmed }])
    setInput('')
    setSending(true)
    setVoiceError(null)

    try {
      const result = await sendAiChatMessage({
        message: trimmed,
        claimId: claimId || null,
      })
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: 'assistant', text: result.message },
      ])
      speak(result.message)
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Sorry, something went wrong. Please try again.'
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'assistant', text: message }])
    } finally {
      setSending(false)
    }
  }

  const handleMic = () => {
    const SpeechRecognitionCtor = getSpeechRecognitionCtor()
    if (!SpeechRecognitionCtor) return

    const recognition = new SpeechRecognitionCtor()
    recognition.lang = 'en-IN'
    recognition.interimResults = false

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0]?.[0]?.transcript ?? ''
      if (transcript) void send(transcript)
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setListening(false)

      const message =
        event.error === 'not-allowed' || event.error === 'service-not-allowed'
          ? 'Microphone access was denied. Allow microphone access in your browser and try again.'
          : event.error === 'no-speech'
            ? "Didn't catch that - no speech was detected. Please try again."
            : event.error === 'audio-capture'
              ? 'No microphone was found on this device.'
              : 'Voice input failed. Please try again or type your question.'

      setVoiceError(message)
    }

    recognition.onend = () => setListening(false)

    setListening(true)
    recognition.start()
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    void send(input)
  }

  return (
    <>
      <AnimatePresence>
        {showGreeting && !open && (
          <>
            <motion.span
              className="chat-bubble-pulse-ring"
              initial={{ opacity: 0.55, scale: 1 }}
              animate={{ opacity: [0.55, 0, 0], scale: [1, 1.7, 1.7] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
            />
            <motion.div
              className="chat-greeting-bubble"
              initial={{ opacity: 0, y: 10, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.94 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <button
                type="button"
                className="chat-greeting-close"
                onClick={() => setShowGreeting(false)}
                aria-label="Dismiss"
              >
                <X size={12} />
              </button>
              <span className="chat-greeting-icon">
                <Sparkles size={14} />
              </span>
              <p>
                Welcome back, {firstName}! I'm Movo — here for any assistance, just tap to ask.
              </p>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        className="chat-bubble"
        onClick={handleBubbleClick}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        aria-label={open ? 'Close assistant' : 'Open assistant'}
      >
        {open ? <X size={22} /> : <MovoAvatar size={30} />}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="chat-panel"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <div className="chat-panel-header">
              <span className="chat-panel-header-icon">
                <MovoAvatar size={26} />
                <span className="chat-header-status-dot" />
              </span>
              <div className="chat-panel-header-text">
                <strong>Movo</strong>
                <span className="chat-panel-subtitle">
                  <Sparkles size={11} />
                  Rule-based lookup - answers from your real claim data
                </span>
              </div>
              {SPEECH_OUTPUT_SUPPORTED && (
                <motion.button
                  type="button"
                  className={`chat-mute-toggle ${muted ? 'chat-mute-toggle-muted' : 'chat-mute-toggle-active'}`}
                  onClick={() => setMuted((m) => !m)}
                  title={muted ? 'Unmute voice replies' : 'Mute voice replies'}
                  aria-pressed={!muted}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                >
                  {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </motion.button>
              )}
            </div>

            {claimsLoaded && claims.length > 0 && (
              <div className="chat-claim-picker-wrap">
                <ClipboardList size={14} className="chat-claim-picker-icon" />
                <select
                  className="chat-claim-picker"
                  value={claimId}
                  onChange={(e) => setClaimId(e.target.value)}
                >
                  {claims.map((c) => (
                    <option key={c.claimId} value={c.claimId}>
                      {c.claimNumber}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="chat-claim-picker-chevron" />
              </div>
            )}

            <div className="chat-messages" ref={scrollRef}>
              {messages.length === 0 && (
                <div className="chat-empty-state">
                  <span className="chat-empty-icon">
                    <Sparkles size={20} />
                  </span>
                  <p className="chat-empty-hint">
                    Ask about your claim status, who your Surveyor is, or who's handling your
                    repair.
                  </p>
                  <div className="chat-quick-prompts">
                    {QUICK_PROMPTS.map((q) => (
                      <motion.button
                        key={q.label}
                        type="button"
                        className="chat-quick-prompt-chip"
                        onClick={() => void send(q.text)}
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.96 }}
                      >
                        <q.icon size={13} />
                        {q.label}
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}
              <AnimatePresence initial={false}>
                {messages.map((m) => (
                  <motion.div
                    key={m.id}
                    className={`chat-msg-row chat-msg-row-${m.role}`}
                    initial={{ opacity: 0, y: 8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                  >
                    {m.role === 'assistant' && (
                      <span className="chat-msg-avatar chat-msg-avatar-assistant">
                        <Bot size={13} />
                      </span>
                    )}
                    <div className={`chat-msg chat-msg-${m.role}`}>{m.text}</div>
                    {m.role === 'user' && (
                      <span className="chat-msg-avatar chat-msg-avatar-user">
                        <User size={13} />
                      </span>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
              {sending && (
                <div className="chat-msg-row chat-msg-row-assistant">
                  <span className="chat-msg-avatar chat-msg-avatar-assistant">
                    <Bot size={13} />
                  </span>
                  <div className="chat-msg chat-msg-assistant chat-msg-typing">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              )}
            </div>

            {voiceError && <p className="error-text chat-voice-error">{voiceError}</p>}

            <form className="chat-input-row" onSubmit={handleSubmit}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question…"
                aria-label="Type your question"
              />
              {SPEECH_INPUT_SUPPORTED && (
                <span className="chat-mic-wrap">
                  {listening && (
                    <>
                      <span className="chat-mic-pulse-ring chat-mic-pulse-ring-1" />
                      <span className="chat-mic-pulse-ring chat-mic-pulse-ring-2" />
                    </>
                  )}
                  <motion.button
                    type="button"
                    className={`mic-button chat-mic-button ${listening ? 'listening' : ''}`}
                    onClick={handleMic}
                    title="Speak your question"
                    whileHover={{ scale: 1.06 }}
                    whileTap={{ scale: 0.92 }}
                  >
                    <Mic size={19} />
                  </motion.button>
                </span>
              )}
              <button type="submit" disabled={sending || !input.trim()} title="Send">
                <Send size={18} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}