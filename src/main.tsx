import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { TeamProvider } from './context/TeamContext'
import { initAnalytics } from './utils/analytics'
import './index.css'

// Kick off Application Insights asynchronously — any trackEvent calls
// that happen before init resolves are buffered and replayed.
initAnalytics()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TeamProvider>
      <App />
    </TeamProvider>
  </React.StrictMode>
)
