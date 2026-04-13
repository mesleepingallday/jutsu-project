import { useEffect, useRef, useState, useCallback } from 'react'
import { HUD } from './HUD'
import { PoseStabilizer } from '../detection/poseStabilizer'
import { initModels, runInference } from '../mediapipe/mainThreadInference'
import {
  createCloneState,
  triggerClone,
  updateClone,
  drawClones,
} from '../rendering/cloneRenderer'
import {
  createFlashState,
  triggerFlash,
  drawFlash,
} from '../rendering/flashEffect'
import { playPoofSound, initAudio } from '../rendering/soundEffect'
import type { CloneState, FlashState } from '../types'

interface Props {
  onError: (msg: string) => void
  onLoading: (msg: string | null) => void
}

export function WebcamCanvas({ onError, onLoading }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const frameCountRef = useRef(0)
  const readyRef = useRef(false)
  const modelsReadyRef = useRef(false)

  const fpsFrames = useRef<number[]>([])
  const [fps, setFps] = useState(0)
  const fpsValueRef = useRef(0)

  const stabilizerRef = useRef(new PoseStabilizer({ requiredFrames: 10, cooldownMs: 4000 }))
  const cloneStateRef = useRef<CloneState>(createCloneState())
  const flashStateRef = useRef<FlashState>(createFlashState())

  const [hudState, setHudState] = useState({
    sealProgress: 0,
    isInCooldown: false,
    handsDetected: 0,
    cloneActive: false,
  })

  const renderLoop = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) {
      rafRef.current = requestAnimationFrame(renderLoop)
      return
    }

    if (video.readyState < 2) {
      rafRef.current = requestAnimationFrame(renderLoop)
      return
    }

    if (!readyRef.current) {
      readyRef.current = true
      onLoading(null)
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth || 640
      canvas.height = video.videoHeight || 480
    }

    const w = canvas.width
    const h = canvas.height
    const now = performance.now()

    // FPS tracking
    fpsFrames.current.push(now)
    if (fpsFrames.current.length > 30) fpsFrames.current.shift()
    if (fpsFrames.current.length >= 2) {
      const span = fpsFrames.current[fpsFrames.current.length - 1] - fpsFrames.current[0]
      const currentFps = Math.round(((fpsFrames.current.length - 1) / span) * 1000)
      fpsValueRef.current = currentFps
      setFps(currentFps)
    }

    // Run inference on main thread (staggered)
    const stabilizer = stabilizerRef.current
    const cloneState = cloneStateRef.current
    const flashState = flashStateRef.current

    if (modelsReadyRef.current) {
      frameCountRef.current++
      const lowFps = fpsValueRef.current > 0 && fpsValueRef.current < 15
      const result = runInference(video, now, frameCountRef.current, lowFps)

      const triggered = stabilizer.update(result.sealDetected)

      if (triggered && !cloneState.active) {
        initAudio()
        playPoofSound()
        triggerFlash(flashState)

        const maskData =
          result.mask && result.maskWidth && result.maskHeight
            ? { mask: result.mask, width: result.maskWidth, height: result.maskHeight }
            : undefined

        triggerClone(cloneState, video, maskData)
      }

      setHudState({
        sealProgress: stabilizer.getProgress(),
        isInCooldown: stabilizer.isInCooldown(),
        handsDetected: result.landmarks.length,
        cloneActive: cloneState.active,
      })
    }

    updateClone(cloneState)

    // Draw
    ctx.clearRect(0, 0, w, h)

    ctx.save()
    ctx.scale(-1, 1)
    ctx.drawImage(video, -w, 0, w, h)
    ctx.restore()

    drawClones(ctx, cloneState, w, h)
    drawFlash(ctx, flashState, w, h)

    rafRef.current = requestAnimationFrame(renderLoop)
  }, [onLoading])

  useEffect(() => {
    let cancelled = false

    async function setup() {
      try {
        onLoading('Requesting webcam...')
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: false,
        })
        if (cancelled) return
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
      } catch {
        onError('Webcam access denied. Please allow camera access and reload the page.')
        return
      }

      try {
        await initModels((msg) => onLoading(msg))
        if (cancelled) return
        modelsReadyRef.current = true
        onLoading('Starting camera...')
      } catch (err) {
        console.error('Model load error:', err)
        onError('Failed to load AI models. Check your connection and reload.')
        return
      }

      rafRef.current = requestAnimationFrame(renderLoop)
    }

    setup()

    return () => {
      cancelled = true
      cancelAnimationFrame(rafRef.current)
      // Only stop tracks if component is truly unmounting (not StrictMode remount)
      setTimeout(() => {
        if (cancelled) {
          const video = videoRef.current
          if (video) {
            const stream = video.srcObject as MediaStream | null
            stream?.getTracks().forEach(t => t.stop())
          }
        }
      }, 100)
    }
  }, [onError, onLoading, renderLoop])

  return (
    <div className="canvas-wrapper">
      <video ref={videoRef} playsInline muted style={{ display: 'none' }} />
      <canvas ref={canvasRef} />
      <HUD
        fps={fps}
        sealProgress={hudState.sealProgress}
        isInCooldown={hudState.isInCooldown}
        handsDetected={hudState.handsDetected}
        cloneActive={hudState.cloneActive}
      />
      <div className="hud-title">影分身の術 — Shadow Clone Jutsu</div>
    </div>
  )
}
