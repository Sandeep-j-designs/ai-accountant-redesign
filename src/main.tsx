import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// self-hosted fonts (no CDN): Inter = UI, Geist = display, IBM Plex Mono = data/figures
import '@fontsource-variable/inter'
import '@fontsource-variable/geist'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/600.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
