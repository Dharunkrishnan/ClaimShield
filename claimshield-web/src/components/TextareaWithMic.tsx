import { useState } from 'react'
import { Mic } from 'lucide-react'
import { useToast } from '../context/ToastContext'

// Shared voice-to-text textarea - originally built one-off for the
// Raise Claim wizard's Description field, then copy-pasted into a
// couple of Claim Detail forms as the same feature got requested on
// more fields. Pulled into one component so every reasoning/
// description/remarks box in the app gets identical mic behavior
// (same language, same error messages, same visual state) from a
// single place instead of N slightly-diverging copies.
export function TextareaWithMic({
  id,
  value,
  onChange,
  rows = 3,
  required,
  disabled,
  placeholder,
  minLength,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  rows?: number
  required?: boolean
  disabled?: boolean
  placeholder?: string
  minLength?: number
}) {
  const { showToast } = useToast()
  const [listening, setListening] = useState(false)
  const [voiceUnsupported, setVoiceUnsupported] = useState(false)

  const handleMic = () => {
    const SpeechRecognitionCtor =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognition })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognition })
        .webkitSpeechRecognition

    if (!SpeechRecognitionCtor) {
      setVoiceUnsupported(true)
      return
    }

    const recognition = new SpeechRecognitionCtor()
    recognition.lang = 'en-IN'
    recognition.interimResults = false

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0]?.[0]?.transcript ?? ''
      onChange(value ? `${value} ${transcript}` : transcript)
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
              : 'Voice input failed. Please try again or type your response.'

      showToast(message, 'error')
    }
    recognition.onend = () => setListening(false)

    setListening(true)
    recognition.start()
  }

  return (
    <>
      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          minLength={minLength}
          style={{ flex: 1 }}
        />
        {!disabled && (
          <button
            type="button"
            className={`mic-button ${listening ? 'listening' : ''}`}
            onClick={handleMic}
            title="Speak your response"
          >
            <Mic size={19} />
          </button>
        )}
      </div>
      {voiceUnsupported && (
        <p className="error-text">
          Voice input isn't supported in this browser. Please type your response.
        </p>
      )}
    </>
  )
}