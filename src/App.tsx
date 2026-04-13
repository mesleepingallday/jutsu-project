import { useState } from 'react'
import { WebcamCanvas } from './components/WebcamCanvas'
import { LoadingScreen } from './components/LoadingScreen'

export default function App() {
  const [loadingMessage, setLoadingMessage] = useState<string | null>('Requesting webcam...')
  const [error, setError] = useState<string | null>(null)

  function handleLoading(msg: string | null) {
    setLoadingMessage(msg)
  }

  function handleError(msg: string) {
    setError(msg)
  }

  if (error) {
    return (
      <div className="app">
        <div className="error-screen">
          <h2>Something went wrong</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Reload</button>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      {loadingMessage && <LoadingScreen message={loadingMessage} />}
      <div style={{ display: loadingMessage ? 'none' : 'contents' }}>
        <WebcamCanvas onError={handleError} onLoading={handleLoading} />
      </div>
    </div>
  )
}
