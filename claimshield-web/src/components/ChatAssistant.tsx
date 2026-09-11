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
  HelpCircle,
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
  { label: 'Repair Estimate', text: 'Explain my repair estimate and deductible details', icon: HelpCircle },
  { label: 'My Repairer', text: 'Who is repairing my vehicle?', icon: Wrench },
]

function renderFormattedMessage(text: string) {
  const lines = text.split('\n')
  return (
    <div className="chat-msg-formatted">
      {lines.map((line, i) => {
        const trimmed = line.trim()
        if (!trimmed) {
          return <div key={i} className="chat-line-gap" />
        }

        const isBullet = /^[*-•]\s+(.*)$/.test(trimmed)
        const isNumbered = /^\d+\.\s+(.*)$/.test(trimmed)
        const lineText = isBullet
          ? trimmed.replace(/^[*-•]\s+/, '')
          : isNumbered
            ? trimmed.replace(/^\d+\.\s+/, '')
            : trimmed

        const parts = lineText.split(/(\*\*[^*]+\*\*)/g)
        const renderedParts = parts.map((part, pIdx) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={pIdx} className="chat-strong">
                {part.slice(2, -2)}
              </strong>
            )
          }
          return part
        })

        if (isBullet) {
          return (
            <div key={i} className="chat-bullet-item">
              <span className="chat-bullet-dot">•</span>
              <span>{renderedParts}</span>
            </div>
          )
        }

        if (isNumbered) {
          const numMatch = trimmed.match(/^(\d+)\./)
          return (
            <div key={i} className="chat-bullet-item">
              <span className="chat-bullet-num">{numMatch ? numMatch[1] : ''}.</span>
              <span>{renderedParts}</span>
            </div>
          )
        }

        return (
          <p key={i} className="chat-msg-paragraph">
            {renderedParts}
          </p>
        )
      })}
    </div>
  )
}

const DIGIT_WORDS: Record<string, string> = {
  '0': 'zero',
  '1': 'one',
  '2': 'two',
  '3': 'three',
  '4': 'four',
  '5': 'five',
  '6': 'six',
  '7': 'seven',
  '8': 'eight',
  '9': 'nine',
}

function spellOutCode(token: string): string {
  if (!token) return ''
  const clean = token.replace(/[^A-Za-z0-9]/g, '')
  if (!clean) return token

  const chars = clean.split('')
  const spoken = chars.map((char) => {
    const upper = char.toUpperCase()
    if (DIGIT_WORDS[upper]) {
      return DIGIT_WORDS[upper]
    }
    return upper
  })

  return spoken.join(', ') + ' '
}

function findFemaleVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null

  // 1. High priority: Indian English Female voices (Heera, Neerja, Veena, Raveena, Swara, etc.)
  const inFemaleKeywords = [
    'heera',
    'neerja',
    'veena',
    'raveena',
    'swara',
    'priya',
    'ananya',
    'kavya',
    'geeta',
    'sunita',
  ]
  const inFemale = voices.find((v) => {
    const name = (v.name || '').toLowerCase()
    const lang = (v.lang || '').toLowerCase()
    const isIndian = lang.includes('en-in') || lang.includes('ta-in') || name.includes('india')
    const matchesName =
      inFemaleKeywords.some((k) => name.includes(k)) ||
      (isIndian &&
        (name.includes('female') || name.includes('woman') || name.includes('girl')))
    return matchesName
  })
  if (inFemale) return inFemale

  // 2. Any en-IN voice that is explicitly NOT male
  const inAnyFemale = voices.find((v) => {
    const name = (v.name || '').toLowerCase()
    const lang = (v.lang || '').toLowerCase()
    const isIndian = lang.includes('en-in') || lang.includes('ta-in') || name.includes('india')
    const isMale =
      name.includes('ravi') ||
      name.includes('male') ||
      name.includes('guy') ||
      name.includes('man') ||
      name.includes('david') ||
      name.includes('prabhat')
    return isIndian && !isMale
  })
  if (inAnyFemale) return inAnyFemale

  // 3. Known Natural / High-quality English Female voices (Windows Zira, Edge Jenny/Aria, Apple Samantha, Chrome Female)
  const generalFemaleKeywords = [
    'zira',
    'jenny',
    'aria',
    'hazel',
    'susan',
    'sonia',
    'samantha',
    'victoria',
    'karen',
    'tessa',
    'moira',
    'steffi',
    'clara',
    'libby',
    'natasha',
    'ava',
    'emma',
    'ana',
    'mia',
    'female',
    'woman',
  ]
  const generalFemale = voices.find((v) => {
    const name = (v.name || '').toLowerCase()
    const lang = (v.lang || '').toLowerCase()
    const isEnglish = lang.startsWith('en')
    return isEnglish && generalFemaleKeywords.some((k) => name.includes(k))
  })
  if (generalFemale) return generalFemale

  // 4. Any English voice that is NOT in the male keywords list
  const anyNonMaleEnglish = voices.find((v) => {
    const name = (v.name || '').toLowerCase()
    const lang = (v.lang || '').toLowerCase()
    const isEnglish = lang.startsWith('en')
    const isMale =
      name.includes('ravi') ||
      name.includes('david') ||
      name.includes('mark') ||
      name.includes('guy') ||
      name.includes('george') ||
      name.includes('richard') ||
      name.includes('male') ||
      name.includes('man') ||
      name.includes('stefan')
    return isEnglish && !isMale
  })
  if (anyNonMaleEnglish) return anyNonMaleEnglish

  // 5. Fallback
  return voices[0] || null
}

function cleanTextForSpeech(text: string): string {
  if (!text) return ''

  return (
    text
      // Strip markdown bold and italic formatting (**word**, *word*, __word__, _word_)
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      // Strip markdown headers (#, ##, ###)
      .replace(/^#+\s+/gm, '')
      // Replace rupee symbol with number + rupees (preserve formatted numbers like ₹45,000)
      .replace(/₹\s*([\d,]+)/g, '$1 rupees')
      // Spell out Claim Numbers (e.g. CLM00234, CLM202600107-DRAFT, CLM25DE9488, CLM0021)
      .replace(/\b(CLM[0-9A-Za-z_-]*)\b/gi, (m) => {
        const parts = m.split(/[-_]/)
        return (
          parts
            .map((p) => (/^[a-zA-Z]{4,}$/.test(p) ? p : spellOutCode(p).trim()))
            .join(' ') + ' '
        )
      })
      // Spell out Policy Numbers (e.g. POLTN74BC4444, POL123456 - ignore word 'Policy' or 'Police')
      .replace(/\b(POL[0-9][0-9A-Za-z]*|POL[A-Z]{2,}[0-9A-Za-z]*)\b/gi, (m) => {
        if (/^(policy|policies|police)$/i.test(m)) return m
        return spellOutCode(m)
      })
      // Spell out Vehicle Registration Numbers (e.g. TN41AX5452, KA01AB1234)
      .replace(/\b([A-Z]{2}\s?[0-9]{1,2}\s?[A-Z]{1,3}\s?[0-9]{4})\b/gi, (m) =>
        spellOutCode(m)
      )
      // Spell out standalone numbers with leading zeros (e.g. 00234, 00111, 0021 - but NOT inside amounts like 1,000)
      .replace(/(?<![\d,])\b(0\d+)\b(?![\d,])/g, (m) => spellOutCode(m))
      // Spell out any other mixed alphanumeric codes with BOTH letters and digits (e.g. EST101, WO2026, IDV123)
      .replace(/\b(?=[A-Za-z0-9]*[A-Za-z])(?=[A-Za-z0-9]*[0-9])[A-Za-z0-9]{3,}\b/g, (m) => {
        if (/^(1st|2nd|3rd|[0-9]+th)$/i.test(m)) return m
        return spellOutCode(m)
      })
      // Spell out 10-digit phone numbers digit-by-digit
      .replace(/(?<![\d,])\b(\d{10})\b(?![\d,])/g, (m) => spellOutCode(m))
      // Replace bullets and list numbers
      .replace(/^[*-•]\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '')
      // Remove divider lines (---, ===)
      .replace(/^[=-]{3,}\s*$/gm, '')
      // Remove pure Tamil script characters if any
      .replace(/[\u0B80-\u0BFF]/g, '')
      // Remove emojis and unicode symbols
      .replace(
        /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F018}-\u{1F270}\u{2388}\u{200D}\u{FE0F}]/gu,
        ''
      )
      // Clean colons, newlines, dots, and extra whitespace
      .replace(/[:]/g, ', ')
      .replace(/\n+/g, '. ')
      .replace(/\.\s*\./g, '.')
      .replace(/\s{2,}/g, ' ')
      .trim()
  )
}

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
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])

  const scrollRef = useRef<HTMLDivElement>(null)
  const prevPathRef = useRef(location.pathname)

  const firstName = displayName?.trim().split(' ')[0] || 'there'

  // Pre-load available synthesis voices and track updates (Chrome / Edge / Safari / Windows)
  useEffect(() => {
    if (!SPEECH_OUTPUT_SUPPORTED) return

    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices()
      if (v && v.length > 0) {
        setAvailableVoices(v)
      }
    }

    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices

    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = null
      }
    }
  }, [])

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
    setOpen((o) => {
      if (o && SPEECH_OUTPUT_SUPPORTED) {
        window.speechSynthesis.cancel()
      }
      return !o
    })
  }

  const handleClose = () => {
    if (SPEECH_OUTPUT_SUPPORTED) {
      window.speechSynthesis.cancel()
    }
    setOpen(false)
  }

  const toggleMute = () => {
    if (SPEECH_OUTPUT_SUPPORTED) {
      window.speechSynthesis.cancel()
    }
    setMuted((m) => !m)
  }

  // Fetch user's claims on mount or open
  useEffect(() => {
    if (!open && claims.length > 0) return

    getMyCustomerProfile()
      .then((customer) => getMyClaims(customer.customerId))
      .then((data) => {
        setClaims(data)
        setClaimsLoaded(true)
      })
      .catch(() => {
        setClaimsLoaded(true)
      })
  }, [open, claims.length])

  // Sync selected claim with the current route / page
  useEffect(() => {
    if (claims.length === 0) return

    // 1. Extract claim ID or number from URL if viewing a claim page
    const pathMatch = location.pathname.match(/\/(?:my-claims|claims)\/([^/?#]+)/)
    const urlClaimParam = pathMatch ? pathMatch[1] : new URLSearchParams(location.search).get('claimId')

    if (urlClaimParam) {
      const match = claims.find(
        (c) =>
          c.claimId.toLowerCase() === urlClaimParam.toLowerCase() ||
          c.claimNumber.toLowerCase() === urlClaimParam.toLowerCase()
      )
      if (match) {
        setClaimId(match.claimId)
        return
      }
    }

    // 2. Default to the latest claim if nothing is selected yet
    setClaimId((prev) => {
      if (prev && claims.some((c) => c.claimId === prev)) return prev
      return claims[0]?.claimId || ''
    })
  }, [location.pathname, location.search, claims])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  const speak = (text: string) => {
    if (muted || !SPEECH_OUTPUT_SUPPORTED) return
    const cleaned = cleanTextForSpeech(text)
    if (!cleaned) return

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(cleaned)

    const voiceList = availableVoices.length > 0 ? availableVoices : window.speechSynthesis.getVoices()
    const femaleVoice = findFemaleVoice(voiceList)

    if (femaleVoice) {
      utterance.voice = femaleVoice
      utterance.lang = femaleVoice.lang
    } else {
      utterance.lang = 'en-IN'
    }

    utterance.rate = 0.98
    utterance.pitch = 1.15 // Pleasant, bright female tone
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

    // Auto-detect if user mentioned a specific claim number in the text
    const mentionedClaim = claims.find((c) =>
      new RegExp(`\\b${c.claimNumber}\\b`, 'i').test(trimmed)
    )

    let targetClaimId = claimId
    if (mentionedClaim) {
      targetClaimId = mentionedClaim.claimId
      setClaimId(mentionedClaim.claimId)
    }

    setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'user', text: trimmed }])
    setInput('')
    setSending(true)
    setVoiceError(null)

    try {
      const result = await sendAiChatMessage({
        message: trimmed,
        claimId: targetClaimId || null,
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
    if (SPEECH_OUTPUT_SUPPORTED) {
      window.speechSynthesis.cancel()
    }
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
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              <button
                type="button"
                className="chat-greeting-close"
                onClick={() => setShowGreeting(false)}
                aria-label="Dismiss"
              >
                <X size={11} />
              </button>
              <span className="chat-greeting-icon">
                <Sparkles size={11} />
              </span>
              <p>
                Hi {firstName}! Tap to ask Movo.
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
        {open ? <X size={22} /> : <MovoAvatar size={38} />}
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
                <MovoAvatar size={32} />
                <span className="chat-header-status-dot" />
              </span>
              <div className="chat-panel-header-text">
                <strong>Movo</strong>
                <span className="chat-panel-subtitle">
                  <Sparkles size={11} />
                  Powered by Gemini AI • Real-time Claim Assistant
                </span>
              </div>
              <div className="chat-panel-header-actions">
                {SPEECH_OUTPUT_SUPPORTED && (
                  <motion.button
                    type="button"
                    className={`chat-mute-toggle ${muted ? 'chat-mute-toggle-muted' : 'chat-mute-toggle-active'}`}
                    onClick={toggleMute}
                    title={muted ? 'Unmute voice replies' : 'Mute / Stop voice playback'}
                    aria-pressed={!muted}
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                  >
                    {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                  </motion.button>
                )}
                <button
                  type="button"
                  className="chat-panel-close-btn"
                  onClick={handleClose}
                  title="Close assistant"
                  aria-label="Close assistant"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {claimsLoaded && claims.length > 0 && (
              <div className="chat-claim-picker-wrap">
                <ClipboardList size={14} className="chat-claim-picker-icon" />
                <select
                  className="chat-claim-picker"
                  value={claimId}
                  onChange={(e) => setClaimId(e.target.value)}
                >
                  <option value="">All Claims / General</option>
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
                    <div className={`chat-msg chat-msg-${m.role}`}>
                      {m.role === 'assistant' ? renderFormattedMessage(m.text) : m.text}
                    </div>
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