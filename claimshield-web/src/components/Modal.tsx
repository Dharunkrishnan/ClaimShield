import { AnimatePresence, motion } from 'framer-motion'
import type { ReactNode } from 'react'

export function Modal({
  open,
  onClose,
  title,
  wide,
  bare,
  children,
}: {
  open: boolean
  onClose?: () => void
  title?: string
  wide?: boolean
  bare?: boolean
  children: ReactNode
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <motion.div
            className={`modal-panel${wide ? ' modal-panel-wide' : ''}${bare ? ' modal-panel-bare' : ''}`}
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            {title && <h2>{title}</h2>}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}