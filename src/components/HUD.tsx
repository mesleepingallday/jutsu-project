interface Props {
  fps: number
  sealProgress: number
  isInCooldown: boolean
  handsDetected: number
  cloneActive: boolean
}

export function HUD({ fps, sealProgress, isInCooldown, handsDetected, cloneActive }: Props) {
  const fpsWarning = fps > 0 && fps < 15

  return (
    <div className="hud">
      <div className="hud-left">
        <div className={`hud-pill ${fpsWarning ? 'warning' : ''}`}>
          {fps > 0 ? `${fps} FPS` : 'Starting...'}
        </div>

        {handsDetected > 0 && (
          <div className="hud-pill">
            {handsDetected === 2 ? '👐 2 hands' : '✋ 1 hand'}
          </div>
        )}

        {sealProgress > 0 && !isInCooldown && (
          <div className="hud-pill active">
            Seal: {Math.round(sealProgress * 100)}%
          </div>
        )}

        {isInCooldown && (
          <div className="hud-pill">
            Cooldown...
          </div>
        )}

        {cloneActive && (
          <div className="hud-pill active">
            ⚡ Shadow Clone!
          </div>
        )}

        {fpsWarning && (
          <div className="hud-pill warning">
            ⚠ Low FPS — segmentation paused
          </div>
        )}
      </div>

      <div>
        <div className="hud-pill">
          Make a cross seal ✕
        </div>
      </div>
    </div>
  )
}
