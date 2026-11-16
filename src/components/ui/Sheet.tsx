import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../Icons'
import { IconButton } from './Button'

interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  variant?: 'default' | 'camera' | 'compact'
}

/**
 * Bottom sheet used for the camera, the confirm dialogs and the iOS install
 * help. Rendering through a portal keeps it above the app's stacking context;
 * Escape, the backdrop and the close button all dismiss it.
 */
export function Sheet({ open, onClose, title, children, variant = 'default' }: SheetProps) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className={`sheet sheet--${variant}`} role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="sheet__backdrop" aria-label="Close" onClick={onClose} />
      <div className="sheet__panel">
        <div className="sheet__rail" aria-hidden="true" />
        <header className="sheet__head">
          <h2>{title}</h2>
          <IconButton label="Close" onClick={onClose}>
            <Icon name="close" />
          </IconButton>
        </header>
        <div className="sheet__body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
