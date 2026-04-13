import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// No StrictMode — MediaPipe allocates GPU/WASM resources that
// cannot survive double-mount teardown in dev mode.
createRoot(document.getElementById('root')!).render(<App />)
