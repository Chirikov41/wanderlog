import { NavLink, useNavigate } from 'react-router-dom'
import { Icon, type IconName } from './Icons'
import { tap } from '../lib/haptics'

interface Tab {
  to: string
  label: string
  icon: IconName
  end?: boolean
}

const TABS: Tab[] = [
  { to: '/', label: 'Journal', icon: 'book', end: true },
  { to: '/map', label: 'Map', icon: 'map' },
  { to: '/stats', label: 'Stats', icon: 'chart' },
  { to: '/settings', label: 'Settings', icon: 'sliders' },
]

/**
 * Bottom navigation with a raised capture button.
 *
 * The bar is part of the app frame (not a floating overlay), so it respects the
 * iOS home-indicator safe area and never covers the last card in the journal.
 */
export function BottomNav() {
  const navigate = useNavigate()

  return (
    <nav className="tab-bar" aria-label="Main">
      <div className="tab-bar__inner">
        {TABS.slice(0, 2).map((tab) => (
          <TabLink key={tab.to} tab={tab} />
        ))}

        <button
          type="button"
          className="tab-bar__fab"
          aria-label="Log a new place"
          onClick={() => {
            tap(14)
            navigate('/new')
          }}
        >
          <Icon name="plus" size={26} />
        </button>

        {TABS.slice(2).map((tab) => (
          <TabLink key={tab.to} tab={tab} />
        ))}
      </div>
    </nav>
  )
}

function TabLink({ tab }: { tab: Tab }) {
  return (
    <NavLink
      to={tab.to}
      end={tab.end}
      className={({ isActive }) => (isActive ? 'tab tab--active' : 'tab')}
    >
      <Icon name={tab.icon} size={22} />
      <span>{tab.label}</span>
    </NavLink>
  )
}
