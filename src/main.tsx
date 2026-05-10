import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { TeamProvider } from './context/TeamContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TeamProvider>
      <App />
    </TeamProvider>
  </React.StrictMode>
)
