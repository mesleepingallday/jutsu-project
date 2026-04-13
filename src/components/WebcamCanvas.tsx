import { useEffect, useRef, useState, useCallback } from 'react'
import { HUD } from './HUD'
import { PoseStabilizer } from '../detection/poseStabilizer'
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
import type { DetectionResult, CloneState, FlashState } from '../types'

interface Props {
  onError: (msg: string) => void
  onLoading: (msg: string | null) => void
}

export function WebcamCanvas({ onError, onLoading }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const workerRef = useRef<Worker | null>(null)
  const rafRef = useRef<number>(0)
  const frameCountRef = useRef(0)
  const readyRef = useRef(false)

  const fpsFrames = useRef<number[]>([])
  const [fps, setFps] = useState(0)

  const latestResult = useRef<DetectionResult | null>(null)
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

    // Signal ready on first valid frame
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

    // FPS
    fpsFrames.current.push(now)
    if (fpsFrames.current.length > 30) fpsFrames.current.shift()
    if (fpsFrames.current.length >= 2) {
      const span = fpsFrames.current[fpsFrames.current.length - 1] - fpsFrames.current[0]
      setFps(Math.round(((fpsFrames.current.length - 1) / span) * 1000))
    }

    // Send frame to worker
    const worker = workerRef.current
    if (worker) {
      frameCountRef.current++
      createImageBitmap(video).then(bmp => {
        worker.postMessage(
          { type: 'frame', bitmap: bmp, timestamp: now, frameCount: frameCountRef.current },
          [bmp]
        )
      }).catch(() => {/* skip */})
    }

    const result = latestResult.current
    const stabilizer = stabilizerRef.current
    const cloneState = cloneStateRef.current
    const flashState = flashStateRef.current

    if (result) {
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
    async function setup() {
      try {
        onLoading('Requesting webcam...')
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: false,
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
      } catch {
        onError('Webcam access denied. Please allow camera access and reload the page.')
        return
      }

      onLoading('Loading MediaPipe models (first load ~10s)...')

      const worker = new Worker(
        new URL('../mediapipe/inferenceWorker.ts', import.meta.url),
        { type: 'module' }
      )

      worker.onmessage = (e) => {
        if (e.data.type === 'ready') {
          console.log('[Worker] MediaPipe ready')
          onLoading('Starting camera...')
        } else if (e.data.type === 'result') {
          latestResult.current = e.data.result
        } else if (e.data.type === 'error') {
          console.error('[Worker] Error:', e.data.message)
          onError('Failed to load AI models. Check your connection and reload.')
        }
      }

      workerRef.current = worker

      rafRef.current = requestAnimationFrame(renderLoop)
    }

    setup()

    return () => {
      cancelAnimationFrame(rafRef.current)
      workerRef.current?.terminate()
      const video = videoRef.current
      if (video) {
        const stream = video.srcObject as MediaStream | null
        stream?.getTracks().forEach(t => t.stop())
      }
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
