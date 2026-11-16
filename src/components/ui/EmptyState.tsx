import type { ReactNode } from 'react'
import { Icon, type IconName } from '../Icons'

interface EmptyStateProps {
  title: string
  message: string
  action?: ReactNode
  icon?: IconName
}

export function EmptyState({ title, message, action, icon = 'compass' }: EmptyStateProps) {
  return (
    <div className="empty">
      <div className="empty__art" aria-hidden="true">
        <span className="empty__ring empty__ring--outer" />
        <span className="empty__ring empty__ring--inner" />
        <span className="empty__glyph">
          <Icon name={icon} size={34} />
        </span>
      </div>
      <h2>{title}</h2>
      <p>{message}</p>
      {action ? <div className="empty__action">{action}</div> : null}
    </div>
  )
}
