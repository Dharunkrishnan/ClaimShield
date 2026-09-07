import { useEffect, useRef, useState, type FormEvent, type ComponentType } from 'react'
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
  Layers,
  IndianRupee,
  FileText,
  Car,
} from 'lucide-react'
import {
  ApiError,
  getClaimsHandlerAllClaims,
  getMyClaims,
  getMyCustomerProfile,
  sendAiChatMessage,
} from '../lib/api'
import type { ClaimResponseDto } from '../lib/types'
import { useAuth } from '../context/AuthContext'
import { RoleId } from '../lib/roles'
import { BotMascotIcon } from './BotMascotIcon'

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

const CUSTOMER_QUICK_PROMPTS: QuickPrompt[] = [
  { label: 'Claim status', text: 'What is the status of my claim?', icon: Gauge },
  { label: 'My Surveyor', text: 'Who is my surveyor?', icon: Eye },
  { label: 'My Repairer', text: 'Who is repairing my vehicle?', icon: Wrench },
]

// A Surveyor is looking at claims they're handling for someone else, not
// their own - "Who is my surveyor?" and "my vehicle" don't make sense
// coming from the Surveyor themselves, so this is a separate set, not a
// reworded copy of the Customer one above. Two prompts work off whatever
// claim is selected in the picker; "My claims" steps back to an update
// across everything assigned to them.
const SURVEYOR_QUICK_PROMPTS: QuickPrompt[] = [
  { label: 'Claim status', text: 'What is the status of this claim?', icon: Gauge },
  { label: 'Repair status', text: 'What is the repair status for this claim?', icon: Wrench },
  {
    label: 'Settled amount',
    text: 'What is the settled amount for this claim?',
    icon: IndianRupee,
  },
  {
    label: 'Policy details',
    text: 'Show me the policy details for this claim.',
    icon: FileText,
  },
  {
    label: 'Vehicle details',
    text: 'Show me the vehicle details for this claim.',
    icon: Car,
  },
  {
    label: 'My claims',
    text: 'Can you give me an update on all my claims?',
    icon: Layers,
  },
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
  const [open, setOpen] = useState(false)
  const [claims, setClaims] = useState<Array<{ claimId: string; claimNumber: string }>>([])
  const { roleId, displayName } = useAuth()
  const [claimId, setClaimId] = useState('')
  const [claimsLoaded, setClaimsLoaded] = useState(false)
  const [greetingDismissed, setGreetingDismissed] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [listening, setListening] = useState(false)
  const [muted, setMuted] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const loadedClaimsRef = useRef(false)

  const quickPrompts = roleId === RoleId.Surveyor ? SURVEYOR_QUICK_PROMPTS : CUSTOMER_QUICK_PROMPTS

  useEffect(() => {
    if (!open || loadedClaimsRef.current) return
    loadedClaimsRef.current = true

    const loadClaims =
      roleId === RoleId.Surveyor
        ? getClaimsHandlerAllClaims().then((data) =>
            data.map((c) => ({ claimId: c.claimId, claimNumber: c.claimNumber })),
          )
        : getMyCustomerProfile()
            .then((customer) => getMyClaims(customer.customerId))
            .then((data: ClaimResponseDto[]) =>
              data.map((c) => ({ claimId: c.claimId, claimNumber: c.claimNumber })),
            )

    loadClaims
      .then((data) => {
        setClaims(data)
        if (data.length > 0) setClaimId(data[0].claimId)
      })
      .catch(() => {
        /* Chat still works without a pre-selected claim - the assistant
           will ask for a claim number in that case. */
      })
      .finally(() => setClaimsLoaded(true))
  }, [open, roleId])

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
        {!open && !greetingDismissed && (
          <motion.div
            className="chat-greeting-bubble"
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <button
              type="button"
              className="chat-greeting-dismiss"
              onClick={(e) => {
                e.stopPropagation()
                setGreetingDismissed(true)
              }}
              aria-label="Dismiss"
            >
              <X size={12} />
            </button>
            <p>
              Hi {displayName}, I&apos;m your assistant here to help.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        className="chat-bubble"
        onClick={() => {
          setOpen((o) => !o)
          setGreetingDismissed(true)
        }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        aria-label={open ? 'Close assistant' : 'Open assistant'}
      >
        {open ? <X size={22} /> : <BotMascotIcon size={30} />}
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
                <BotMascotIcon size={22} />
                <span className="chat-header-status-dot" />
              </span>
              <div className="chat-panel-header-text">
                <strong>ClaimShield Assistant</strong>
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
                    {roleId === RoleId.Surveyor
                      ? "Select a claim above to ask about it, or get an update across all your claims."
                      : "Ask about your claim status, who your Surveyor is, or who's handling your repair."}
                  </p>
                  <div className="chat-quick-prompts">
                    {quickPrompts.map((q) => (
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