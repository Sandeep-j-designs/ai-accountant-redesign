import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// self-hosted fonts (no CDN): IBM Plex Sans = UI/body, Space Grotesk = display/
// accent (hero metrics, headings), IBM Plex Mono = voucher numbers & invoice IDs.
// Variable packages ship the full weight axis (we use 400/500/600, +700 for display).
import '@fontsource-variable/ibm-plex-sans'
import '@fontsource-variable/space-grotesk'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/600.css'
import './index.css'
import './components/upload/upload.css'
import './workbench.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
