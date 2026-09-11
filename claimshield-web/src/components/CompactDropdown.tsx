import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

export interface DropdownOption {
  value: string | number
  label: string
}

interface CompactDropdownProps {
  id?: string
  value: string | number
  onChange: (value: any) => void
  options: DropdownOption[]
  placeholder?: string
  className?: string
  required?: boolean
  disabled?: boolean
}

export function CompactDropdown({
  id,
  value,
  onChange,
  options,
  placeholder = 'Select…',
  className = '',
  required = false,
  disabled = false,
}: CompactDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find((o) => String(o.value) === String(value))
  const displayLabel = selectedOption ? selectedOption.label : placeholder

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

  return (
    <div
      ref={containerRef}
      className={`compact-dropdown-container ${className}${isOpen ? ' is-open' : ''}${
        disabled ? ' is-disabled' : ''
      }`}
    >
      <input
        type="hidden"
        name={id}
        value={value ?? ''}
        required={required}
      />
      <button
        type="button"
        id={id}
        className="compact-dropdown-trigger"
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
      >
        <span className="compact-dropdown-selected-text">{displayLabel}</span>
        <ChevronDown
          size={14}
          className={`compact-dropdown-chevron${isOpen ? ' is-rotated' : ''}`}
        />
      </button>

      {isOpen && (
        <ul className="compact-dropdown-menu" role="listbox" tabIndex={-1}>
          {placeholder && !options.some((o) => String(o.value) === '0' || String(o.value) === '') && (
            <li
              role="option"
              aria-selected={!selectedOption}
              className={`compact-dropdown-option ${!selectedOption ? 'is-selected' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange('')
                setIsOpen(false)
              }}
            >
              {placeholder}
            </li>
          )}
          {options.map((option) => {
            const isSelected = String(option.value) === String(value)
            return (
              <li
                key={option.value}
                role="option"
                aria-selected={isSelected}
                className={`compact-dropdown-option${isSelected ? ' is-selected' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(option.value)
                  setIsOpen(false)
                }}
              >
                {option.label}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

