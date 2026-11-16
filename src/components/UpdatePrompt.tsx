import { useRegisterSW } from 'virtual:pwa-register/react'
import { Icon } from './Icons'
import { Button } from './ui/Button'

/**
 * Service-worker update prompt.
 *
 * `registerType: 'prompt'` means a new build waits in the background until the
 * user accepts it — important for an app that may be open on a phone for days.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div className="update-banner" role="status">
      <Icon name="sparkle" size={20} />
      <p>A new version of Wanderlog is ready.</p>
      <Button size="sm" onClick={() => void updateServiceWorker(true)}>
        Refresh
      </Button>
      <button
        type="button"
        className="update-banner__dismiss"
        aria-label="Dismiss"
        onClick={() => setNeedRefresh(false)}
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  )
}
