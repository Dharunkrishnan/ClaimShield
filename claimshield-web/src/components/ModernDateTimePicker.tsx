import React, { useEffect, useRef, useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight, Clock, Check } from 'lucide-react'

export interface ModernDateTimePickerProps {
  id?: string
  date: string // YYYY-MM-DD
  time: string // HH:mm (24-hour)
  onDateChange: (date: string) => void
  onTimeChange: (time: string) => void
  minDate?: string
  maxDate?: string
  required?: boolean
  className?: string
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function getTodayDateStr(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getNowTimeStr(): string {
  const now = new Date()
  const h = String(now.getHours()).padStart(2, '0')
  const m = String(now.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

function parseDateStr(str: string): { year: number; month: number; day: number } {
  const effectiveStr = str || getTodayDateStr()
  const [y, m, d] = effectiveStr.split('-').map(Number)
  const now = new Date()
  return {
    year: y || now.getFullYear(),
    month: m ? m - 1 : now.getMonth(),
    day: d || now.getDate(),
  }
}

function formatDateStr(year: number, month: number, day: number): string {
  const y = String(year)
  const m = String(month + 1).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function to12Hour(time24: string) {
  const effectiveTime = time24 || getNowTimeStr()
  const [hStr, mStr] = effectiveTime.split(':')
  const h = Number(hStr) || 0
  const period: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM'
  let hour12 = h % 12
  if (hour12 === 0) hour12 = 12
  return {
    hour: String(hour12).padStart(2, '0'),
    minute: mStr ? mStr.padStart(2, '0') : '00',
    period,
  }
}

function to24Hour(hour12: string, minute: string, period: 'AM' | 'PM') {
  if (!hour12 || !minute) return ''
  let h = Number(hour12) % 12
  if (period === 'PM') h += 12
  return `${String(h).padStart(2, '0')}:${minute.padStart(2, '0')}`
}

function formatDisplayString(dateStr: string, timeStr: string): string {
  const effectiveDate = dateStr || getTodayDateStr()
  const effectiveTime = timeStr || getNowTimeStr()
  const { year, month, day } = parseDateStr(effectiveDate)
  const monthShort = MONTH_NAMES[month]?.slice(0, 3) || ''
  const { hour, minute, period } = to12Hour(effectiveTime)
  return `${day} ${monthShort} ${year}, ${hour}:${minute} ${period}`
}

export function ModernDateTimePicker({
  id = 'lossDateTime',
  date,
  time,
  onDateChange,
  onTimeChange,
  minDate,
  maxDate,
  required = false,
  className = '',
}: ModernDateTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const effectiveDate = date || getTodayDateStr()
  const effectiveTime = time || getNowTimeStr()

  // Auto-initialize if empty
  useEffect(() => {
    if (!date) {
      onDateChange(getTodayDateStr())
    }
    if (!time) {
      onTimeChange(getNowTimeStr())
    }
  }, [date, time, onDateChange, onTimeChange])

  const parsed = parseDateStr(effectiveDate)
  const [viewYear, setViewYear] = useState(parsed.year)
  const [viewMonth, setViewMonth] = useState(parsed.month)

  const { hour, minute, period } = to12Hour(effectiveTime)

  // Sync view when date prop changes
  useEffect(() => {
    if (date) {
      const p = parseDateStr(date)
      setViewYear(p.year)
      setViewMonth(p.month)
    }
  }, [date])

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  // Month navigation
  const prevMonth = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  const nextMonth = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  // Calendar days grid
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay()

  const handleSelectDay = (day: number) => {
    const newDateStr = formatDateStr(viewYear, viewMonth, day)
    onDateChange(newDateStr)
  }

  // Time adjustments
  const handleHourChange = (newH: number) => {
    let clamped = newH
    if (clamped < 1) clamped = 12
    if (clamped > 12) clamped = 1
    onTimeChange(to24Hour(String(clamped), minute, period))
  }

  const handleMinuteChange = (newM: number) => {
    let clamped = newM
    if (clamped < 0) clamped = 55
    if (clamped > 59) clamped = 0
    onTimeChange(to24Hour(hour, String(clamped).padStart(2, '0'), period))
  }

  const togglePeriod = (e: React.MouseEvent) => {
    e.stopPropagation()
    const nextPeriod: 'AM' | 'PM' = period === 'AM' ? 'PM' : 'AM'
    onTimeChange(to24Hour(hour, minute, nextPeriod))
  }

  return (
    <div
      ref={containerRef}
      className={`modern-datetime-container ${className}${isOpen ? ' is-open' : ''}`}
      id={id}
    >
      <input type="hidden" name="dateOfLoss" value={effectiveDate} required={required} />
      <input type="hidden" name="timeOfLoss" value={effectiveTime} required={required} />

      {/* Trigger button: Single unified box with ONLY ONE icon */}
      <button
        type="button"
        className="modern-datetime-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <Calendar size={13} className="modern-datetime-trigger-icon" />
        <span className="modern-datetime-trigger-text">
          {formatDisplayString(effectiveDate, effectiveTime)}
        </span>
      </button>

      {/* Unified Compact Popup for Date & Time */}
      {isOpen && (
        <div className="modern-datetime-popover" role="dialog" aria-modal="true">
          {/* Calendar Section */}
          <div className="modern-datetime-cal-header">
            <button
              type="button"
              className="modern-datetime-nav-btn"
              onClick={prevMonth}
              aria-label="Previous month"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="modern-datetime-month-label">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              className="modern-datetime-nav-btn"
              onClick={nextMonth}
              aria-label="Next month"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="modern-datetime-day-names">
            {DAY_LABELS.map((d) => (
              <span key={d} className="modern-datetime-day-label">
                {d}
              </span>
            ))}
          </div>

          <div className="modern-datetime-days-grid">
            {/* Blank leading slots */}
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <span key={`blank-${i}`} className="modern-datetime-day-blank" />
            ))}

            {/* Days in month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dayDateStr = formatDateStr(viewYear, viewMonth, day)
              const isSelected = effectiveDate === dayDateStr
              const isFuture = maxDate ? dayDateStr > maxDate : false
              const isPastMin = minDate ? dayDateStr < minDate : false
              const isDisabled = isFuture || isPastMin

              return (
                <button
                  key={day}
                  type="button"
                  disabled={isDisabled}
                  className={`modern-datetime-day-btn${isSelected ? ' is-selected' : ''}${
                    isDisabled ? ' is-disabled' : ''
                  }`}
                  onClick={() => handleSelectDay(day)}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {/* Time Picker Section */}
          <div className="modern-datetime-time-section-unified">
            <div className="modern-datetime-time-title">
              <Clock size={12} />
              <span>Time:</span>
            </div>

            <div className="modern-datetime-time-picker-row">
              {/* Hour control */}
              <div className="modern-datetime-stepper">
                <button
                  type="button"
                  className="modern-datetime-step-btn"
                  onClick={() => handleHourChange(Number(hour) - 1)}
                  aria-label="Decrease hour"
                >
                  −
                </button>
                <span className="modern-datetime-step-val">{hour}</span>
                <button
                  type="button"
                  className="modern-datetime-step-btn"
                  onClick={() => handleHourChange(Number(hour) + 1)}
                  aria-label="Increase hour"
                >
                  +
                </button>
              </div>

              <span className="modern-datetime-colon-unified">:</span>

              {/* Minute control */}
              <div className="modern-datetime-stepper">
                <button
                  type="button"
                  className="modern-datetime-step-btn"
                  onClick={() => handleMinuteChange(Number(minute) - 5)}
                  aria-label="Decrease minute"
                >
                  −
                </button>
                <span className="modern-datetime-step-val">{minute}</span>
                <button
                  type="button"
                  className="modern-datetime-step-btn"
                  onClick={() => handleMinuteChange(Number(minute) + 5)}
                  aria-label="Increase minute"
                >
                  +
                </button>
              </div>

              {/* AM / PM Toggle */}
              <button
                type="button"
                className="modern-datetime-period-pill"
                onClick={togglePeriod}
                aria-label={`Toggle period, currently ${period}`}
              >
                {period}
              </button>
            </div>
          </div>

          {/* Done action */}
          <button
            type="button"
            className="modern-datetime-done-btn"
            onClick={() => setIsOpen(false)}
          >
            <Check size={12} />
            <span>Set Date & Time</span>
          </button>
        </div>
      )}
    </div>
  )
}
