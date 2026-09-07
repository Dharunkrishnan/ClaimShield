import { AnimatePresence, motion } from 'framer-motion'
import { createPortal } from 'react-dom'
import { useEffect } from 'react'
import type { ReactNode, MouseEvent } from 'react'

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose?: () => void
  title?: string
  children: ReactNode
}) {
  // Escape-to-close - keyboard users otherwise have no way to dismiss a
  // modal without a mouse (the backdrop click-through has no keyboard
  // equivalent).
  useEffect(() => {
    if (!open || !onClose) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onMouseDown={(event: MouseEvent<HTMLDivElement>) => {
            if (event.target === event.currentTarget) {
              onClose?.()
            }
          }}
        >
          <motion.div
            className="modal-panel"
            initial={{
              opacity: 0,
              y: 24,
              scale: 0.96,
            }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
            }}
            exit={{
              opacity: 0,
              y: 16,
              scale: 0.97,
            }}
            transition={{
              type: 'spring',
              stiffness: 320,
              damping: 28,
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'claimshield-modal-title' : undefined}
            onMouseDown={(event) => {
              event.stopPropagation()
            }}
          >
            {title && (
              <h2 id="claimshield-modal-title">
                {title}
              </h2>
            )}

            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}