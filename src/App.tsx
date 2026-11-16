import { useEffect } from 'react'
import { HashRouter, Link, Route, Routes, useLocation } from 'react-router-dom'
import { BottomNav } from './components/BottomNav'
import { UpdatePrompt } from './components/UpdatePrompt'
import { ToastProvider } from './components/ui/Toast'
import { EntryFormPage } from './features/capture/EntryFormPage'
import { EntryPage } from './features/entry/EntryPage'
import { JournalPage } from './features/journal/JournalPage'
import { MapPage } from './features/map/MapPage'
import { SettingsPage } from './features/settings/SettingsPage'
import { StatsPage } from './features/stats/StatsPage'
import { ThemeProvider } from './hooks/useTheme'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function NotFound() {
  return (
    <div className="page">
      <div className="center-block">
        <h1 className="display">Lost?</h1>
        <p>That page does not exist.</p>
        <Link to="/" className="btn btn--primary">
          Back to the journal
        </Link>
      </div>
    </div>
  )
}

function Shell() {
  const location = useLocation()
  const hideTabBar =
    location.pathname === '/new' || location.pathname.startsWith('/edit/')

  return (
    <div className="app-frame">
      <div className="app">
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <ScrollToTop />
        <main id="main" className="app__main" key={location.pathname}>
          <Routes>
            <Route path="/" element={<JournalPage />} />
            <Route path="/new" element={<EntryFormPage />} />
            <Route path="/entry/:id" element={<EntryPage />} />
            <Route path="/edit/:id" element={<EntryFormPage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        {hideTabBar ? null : <BottomNav />}
        <UpdatePrompt />
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <HashRouter>
          <Shell />
        </HashRouter>
      </ToastProvider>
    </ThemeProvider>
  )
}
