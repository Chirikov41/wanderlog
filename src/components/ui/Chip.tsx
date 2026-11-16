import type { ReactNode } from 'react'

interface ChipProps {
  children: ReactNode
  selected?: boolean
  onClick?: () => void
  colour?: string
  count?: number
  title?: string
}

export function Chip({ children, selected = false, onClick, colour, count, title }: ChipProps) {
  return (
    <button
      type="button"
      className={['chip', selected ? 'chip--on' : ''].filter(Boolean).join(' ')}
      aria-pressed={selected}
      onClick={onClick}
      title={title}
    >
      {colour ? <span className="chip__dot" style={{ background: colour }} aria-hidden="true" /> : null}
      <span>{children}</span>
      {typeof count === 'number' ? <span className="chip__count">{count}</span> : null}
    </button>
  )
}
