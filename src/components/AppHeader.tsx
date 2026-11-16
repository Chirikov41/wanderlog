import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from './Icons'
import { IconButton } from './ui/Button'

interface AppHeaderProps {
  title: string
  eyebrow?: string
  back?: boolean
  actions?: ReactNode
  subtitle?: string
}

/**
 * Sticky top bar for inner screens. `back` falls back to the journal when there
 * is no history (for example when an entry page is opened from a bookmark).
 */
export function AppHeader({ title, eyebrow, back = false, actions, subtitle }: AppHeaderProps) {
  const navigate = useNavigate()

  const goBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/')
  }

  return (
    <header className="app-header">
      {back ? (
        <IconButton label="Go back" onClick={goBack} className="app-header__back">
          <Icon name="back" />
        </IconButton>
      ) : null}
      <div className="app-header__titles">
        {eyebrow ? <span className="app-header__eyebrow">{eyebrow}</span> : null}
        <h1 className="app-header__title">{title}</h1>
        {subtitle ? <p className="app-header__subtitle">{subtitle}</p> : null}
      </div>
      <div className="app-header__actions">{actions}</div>
    </header>
  )
}
