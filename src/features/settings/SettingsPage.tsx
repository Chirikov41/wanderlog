import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { AppHeader } from '../../components/AppHeader'
import { Icon } from '../../components/Icons'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { useToast } from '../../components/ui/Toast'
import { useInstallPrompt } from '../../hooks/useInstallPrompt'
import { useOnline } from '../../hooks/useOnline'
import { useTheme, type ThemeMode } from '../../hooks/useTheme'
import { APP_VERSION, REPO_URL } from '../../lib/constants'
import { clearDatabase } from '../../lib/db'
import { DEMO_ENTRY_COUNT, seedDemoTrip } from '../../lib/demo'
import { useEntries } from '../../lib/entries.repo'
import { downloadBackup, importBackupFile } from '../../lib/exportImport'
import { formatBytes, formatCount } from '../../lib/format'

type BusyTask = 'export' | 'import' | 'demo' | 'clear' | null

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'Auto' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

export function SettingsPage() {
  const entries = useEntries()
  const { mode, setMode } = useTheme()
  const install = useInstallPrompt()
  const online = useOnline()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null)
  const [busy, setBusy] = useState<BusyTask>(null)
  const [confirm, setConfirm] = useState<'demo' | 'clear' | null>(null)

  const entryCount = entries?.length ?? 0
  const swReady =
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    Boolean(navigator.serviceWorker.controller)

  useEffect(() => {
    let cancelled = false
    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      navigator.storage
        .estimate()
        .then((estimate) => {
          if (cancelled) return
          setStorage({ usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 })
        })
        .catch(() => undefined)
    }
    return () => {
      cancelled = true
    }
  }, [entryCount])

  const handleInstall = async () => {
    const outcome = await install.promptInstall()
    if (outcome === 'accepted') toast.show('Installing Wanderlog…', 'success')
    else if (outcome === 'unavailable') {
      toast.show(
        install.isIOS
          ? 'In Safari: Share → Add to Home Screen.'
          : 'Use your browser menu → Install app.',
      )
    }
  }

  const handleExport = async () => {
    setBusy('export')
    try {
      const count = await downloadBackup()
      toast.show(
        `Backup of ${formatCount(count, 'memory', 'memories')} downloaded`,
        'success',
      )
    } catch {
      toast.show('Could not build the backup file.', 'error')
    } finally {
      setBusy(null)
    }
  }

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setBusy('import')
    try {
      const result = await importBackupFile(file)
      toast.show(
        `Imported ${result.imported}${result.skipped ? ` · skipped ${result.skipped}` : ''}`,
        'success',
      )
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Import failed.', 'error')
    } finally {
      setBusy(null)
    }
  }

  const handleDemo = async () => {
    setBusy('demo')
    setConfirm(null)
    try {
      const count = await seedDemoTrip()
      toast.show(`Added ${formatCount(count, 'sample memory', 'sample memories')}`, 'success')
    } catch {
      toast.show('Could not add the sample trip.', 'error')
    } finally {
      setBusy(null)
    }
  }

  const handleClear = async () => {
    setBusy('clear')
    setConfirm(null)
    try {
      await clearDatabase()
      toast.show('All memories deleted', 'success')
    } catch {
      toast.show('Could not clear the database.', 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="page">
      <AppHeader eyebrow="Wanderlog" title="Settings" />

      {!install.installed ? (
        <>
          <h2 className="settings-group__title">Get the app</h2>
          <section className="settings-group">
            <button type="button" className="settings-row" onClick={() => void handleInstall()}>
              <span className="settings-row__icon">
                <Icon name="install" size={19} />
              </span>
              <span className="settings-row__body">
                <span className="settings-row__title">Add to home screen</span>
                <span className="settings-row__desc">
                  {install.canInstall
                    ? 'Install Wanderlog as an app — it opens offline, without a browser bar.'
                    : install.isIOS
                      ? 'In Safari tap Share, then “Add to Home Screen”.'
                      : 'Open the deployed URL in Chrome or Edge, then use “Install app”.'}
                </span>
              </span>
              <Icon name="forward" size={16} />
            </button>
            {install.isIOS && !install.canInstall ? (
              <ol className="install-steps">
                <li>Open this site in Safari (not Chrome).</li>
                <li>Tap the Share button in the toolbar.</li>
                <li>Choose “Add to Home Screen”, then “Add”.</li>
              </ol>
            ) : null}
          </section>
        </>
      ) : (
        <section className="settings-group">
          <div className="settings-row settings-row--static">
            <span className="settings-row__icon">
              <Icon name="check" size={19} />
            </span>
            <span className="settings-row__body">
              <span className="settings-row__title">Installed</span>
              <span className="settings-row__desc">
                Wanderlog is running as a standalone app on this device.
              </span>
            </span>
          </div>
        </section>
      )}

      <h2 className="settings-group__title">Appearance</h2>
      <section className="settings-group">
        <div className="settings-theme">
          <div className="settings-theme__label">Theme</div>
          <SegmentedControl
            label="Theme"
            options={THEME_OPTIONS}
            value={mode}
            onChange={setMode}
          />
        </div>
      </section>

      <h2 className="settings-group__title">Your data</h2>
      <section className="settings-group">
        <button type="button" className="settings-row" onClick={() => void handleExport()} disabled={busy !== null}>
          <span className="settings-row__icon">
            <Icon name="download" size={19} />
          </span>
          <span className="settings-row__body">
            <span className="settings-row__title">Export backup</span>
            <span className="settings-row__desc">
              One JSON file with every memory and photo ({formatCount(entryCount, 'entry', 'entries')}).
            </span>
          </span>
          {busy === 'export' ? <Icon name="clock" size={16} /> : <Icon name="forward" size={16} />}
        </button>

        <button type="button" className="settings-row" onClick={() => fileRef.current?.click()} disabled={busy !== null}>
          <span className="settings-row__icon">
            <Icon name="upload" size={19} />
          </span>
          <span className="settings-row__body">
            <span className="settings-row__title">Import backup</span>
            <span className="settings-row__desc">Restore a journal from a previous export.</span>
          </span>
          <Icon name="forward" size={16} />
        </button>

        <button type="button" className="settings-row" onClick={() => setConfirm('demo')} disabled={busy !== null}>
          <span className="settings-row__icon">
            <Icon name="sparkle" size={19} />
          </span>
          <span className="settings-row__body">
            <span className="settings-row__title">Load sample trip</span>
            <span className="settings-row__desc">
              Adds {DEMO_ENTRY_COUNT} example memories around Scotland — handy for a demo.
            </span>
          </span>
          <Icon name="forward" size={16} />
        </button>

        <button type="button" className="settings-row" onClick={() => setConfirm('clear')} disabled={busy !== null}>
          <span className="settings-row__icon settings-row__icon--danger">
            <Icon name="trash" size={19} />
          </span>
          <span className="settings-row__body">
            <span className="settings-row__title">Delete all memories</span>
            <span className="settings-row__desc">Removes every entry and photo from this device.</span>
          </span>
          <Icon name="forward" size={16} />
        </button>
      </section>

      <h2 className="settings-group__title">Storage &amp; offline</h2>
      <section className="settings-group">
        <div className="settings-row settings-row--static">
          <span className="settings-row__icon">
            <Icon name={online ? 'check' : 'wifiOff'} size={19} />
          </span>
          <span className="settings-row__body">
            <span className="settings-row__title">Connection</span>
            <span className="settings-row__desc">
              {online
                ? 'Online. New place names can be looked up automatically.'
                : 'Offline. Everything still works — only new place-name lookups wait.'}
            </span>
          </span>
          <span className={online ? 'offline-pill' : 'offline-pill offline-pill--off'}>
            {online ? 'Online' : 'Offline'}
          </span>
        </div>

        <div className="settings-row settings-row--static">
          <span className="settings-row__icon">
            <Icon name="install" size={19} />
          </span>
          <span className="settings-row__body">
            <span className="settings-row__title">Offline app shell</span>
            <span className="settings-row__desc">
              {swReady
                ? 'The interface and demo photos are cached by the service worker.'
                : 'Available once the app has been installed or reloaded over HTTPS.'}
            </span>
          </span>
        </div>

        <div className="settings-row settings-row--static">
          <span className="settings-row__icon">
            <Icon name="grid" size={19} />
          </span>
          <span className="settings-row__body">
            <span className="settings-row__title">Device storage used</span>
            <span className="settings-row__desc">
              Photos are compressed to 1600 px and stored in IndexedDB.
            </span>
          </span>
          <span className="settings-row__value">
            {storage ? formatBytes(storage.usage) : '—'}
          </span>
        </div>
      </section>

      <div className="about">
        <strong>Wanderlog {APP_VERSION}</strong>
        <p>
          React 19 · TypeScript · Vite · Dexie (IndexedDB) · Leaflet. Geolocation, camera,
          orientation, vibration and Web Share APIs, with a service worker for offline use.
        </p>
        <p>
          Map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>{' '}
          contributors. Place names by Nominatim.
        </p>
        <p>
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            Source code on GitHub
          </a>{' '}
          · MIT licence · Built for COMP10013.
        </p>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        tabIndex={-1}
        onChange={handleImport}
      />

      <ConfirmDialog
        open={confirm === 'demo'}
        title="Load the sample trip?"
        message={`This adds ${DEMO_ENTRY_COUNT} example memories (with photos) to your journal. You can delete them at any time.`}
        confirmLabel="Add samples"
        busy={busy === 'demo'}
        onConfirm={() => void handleDemo()}
        onCancel={() => setConfirm(null)}
      />

      <ConfirmDialog
        open={confirm === 'clear'}
        title="Delete everything?"
        message="Every memory and photo will be erased from this device. Export a backup first if you want to keep them."
        confirmLabel="Delete all"
        tone="danger"
        busy={busy === 'clear'}
        onConfirm={() => void handleClear()}
        onCancel={() => setConfirm(null)}
      />

      <p className="settings-note">
        Wanderlog stores everything locally in IndexedDB. Clearing your browser's site data for
        this app will also delete the journal — export a backup before you do.
      </p>
    </div>
  )
}
