import type { CloneState, SmokeParticle } from '../types'

const PHASE_DURATIONS = {
  flash: 150,
  fadein: 350,   // 150-500ms
  hold: 9000,    // 500-9500ms
  fadeout: 500,  // 9500-10000ms
  poof: 700,     // 10000-10700ms
}

// Reusable offscreen canvas for mask compositing (avoids per-frame allocation)
let compositeCanvas: OffscreenCanvas | null = null
let compositeCtx: OffscreenCanvasRenderingContext2D | null = null

function getCompositeCanvas(w: number, h: number): OffscreenCanvasRenderingContext2D | null {
  if (!compositeCanvas || compositeCanvas.width !== w || compositeCanvas.height !== h) {
    compositeCanvas = new OffscreenCanvas(w, h)
    compositeCtx = compositeCanvas.getContext('2d') as OffscreenCanvasRenderingContext2D
  }
  return compositeCtx
}

function spawnParticles(cx: number, cy: number): SmokeParticle[] {
  const count = 24
  const particles: SmokeParticle[] = []
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4
    const speed = 40 + Math.random() * 80
    particles.push({
      x: cx + (Math.random() - 0.5) * 30,
      y: cy + (Math.random() - 0.5) * 30,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 20 - Math.random() * 30, // upward drift
      radius: 5 + Math.random() * 10,
      alpha: 0.7 + Math.random() * 0.2,
      life: 0,
      maxLife: 500 + Math.random() * 200,
    })
  }
  return particles
}

export function createCloneState(): CloneState {
  return {
    active: false,
    phase: 'done',
    startTime: 0,
    alpha: 0,
    particles: [],
  }
}

export function triggerClone(state: CloneState): void {
  state.active = true
  state.phase = 'flash'
  state.startTime = performance.now()
  state.particles = []
}

export function updateClone(state: CloneState, canvasW: number, canvasH: number): boolean {
  if (!state.active && state.particles.length === 0) return false

  const now = performance.now()
  let justEnteredPoof = false

  if (state.active) {
    const elapsed = now - state.startTime

    if (elapsed < PHASE_DURATIONS.flash) {
      state.phase = 'flash'
      state.alpha = 0
    } else if (elapsed < PHASE_DURATIONS.flash + PHASE_DURATIONS.fadein) {
      state.phase = 'fadein'
      const t = (elapsed - PHASE_DURATIONS.flash) / PHASE_DURATIONS.fadein
      state.alpha = t * 1.0
    } else if (elapsed < PHASE_DURATIONS.flash + PHASE_DURATIONS.fadein + PHASE_DURATIONS.hold) {
      state.phase = 'hold'
      state.alpha = 1.0
    } else if (elapsed < PHASE_DURATIONS.flash + PHASE_DURATIONS.fadein + PHASE_DURATIONS.hold + PHASE_DURATIONS.fadeout) {
      state.phase = 'fadeout'
      const t = (elapsed - PHASE_DURATIONS.flash - PHASE_DURATIONS.fadein - PHASE_DURATIONS.hold) / PHASE_DURATIONS.fadeout
      state.alpha = 1.0 * (1 - t)
    } else if (elapsed < PHASE_DURATIONS.flash + PHASE_DURATIONS.fadein + PHASE_DURATIONS.hold + PHASE_DURATIONS.fadeout + PHASE_DURATIONS.poof) {
      if (state.phase !== 'poof') {
        // Just entered poof — spawn particles at each clone position
        state.phase = 'poof'
        state.particles = []
        for (const { dx, dy } of CLONE_POSITIONS) {
          const cx = canvasW / 2 + dx
          const cy = canvasH / 2 + dy
          state.particles.push(...spawnParticles(cx, cy))
        }
        justEnteredPoof = true
      }
      state.alpha = 0
    } else {
      state.active = false
      state.alpha = 0
    }
  }

  // Update particles
  const dt = 1 / 60 // approximate dt in seconds
  state.particles = state.particles.filter(p => {
    p.life += (dt * 1000)
    if (p.life >= p.maxLife) return false
    const t = p.life / p.maxLife
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.vy += 15 * dt // slight gravity drag
    p.radius = p.radius + (30 * dt) // grow over time
    p.alpha = (1 - t) * 0.75
    return true
  })

  if (!state.active && state.particles.length === 0) {
    state.phase = 'done'
  }

  return justEnteredPoof
}

const CLONE_POSITIONS = [
  { dx: -220, dy: 17, scale: 0.95 },
  { dx: 220, dy: 19, scale: 0.90 },
]

export function drawClones(
  ctx: CanvasRenderingContext2D,
  state: CloneState,
  canvasW: number,
  canvasH: number,
  video: HTMLVideoElement,
  maskData?: { mask: Float32Array; width: number; height: number } | null
): void {
  // Draw clone images
  if (state.active && state.alpha > 0) {
    const offCtx = getCompositeCanvas(canvasW, canvasH)
    if (offCtx) {
      ctx.save()
      ctx.globalAlpha = state.alpha

      for (const { dx, dy, scale } of CLONE_POSITIONS) {
        // Draw mirrored live video frame to offscreen canvas
        offCtx.clearRect(0, 0, canvasW, canvasH)
        offCtx.save()
        offCtx.scale(-1, 1)
        offCtx.drawImage(video, -canvasW, 0, canvasW, canvasH)
        offCtx.restore()

        // Apply segmentation mask to erase background
        if (maskData) {
          const imageData = offCtx.getImageData(0, 0, canvasW, canvasH)
          const pixels = imageData.data
          const { mask, width: mw, height: mh } = maskData

          for (let y = 0; y < canvasH; y++) {
            for (let x = 0; x < canvasW; x++) {
              const mx = Math.floor((x / canvasW) * mw)
              const my = Math.floor((y / canvasH) * mh)
              // Mirror x for mask (frame is mirrored)
              const mirroredMx = mw - 1 - mx
              const mirroredIdx = my * mw + mirroredMx
              const maskIdx = my * mw + mx
              const confidence = mask[mirroredIdx] ?? mask[maskIdx] ?? 0
              pixels[(y * canvasW + x) * 4 + 3] = Math.floor(confidence * 255)
            }
          }
          offCtx.putImageData(imageData, 0, 0)
        }

        // Draw composited clone at offset position
        ctx.save()
        ctx.translate(canvasW / 2 + dx, canvasH / 2 + dy)
        ctx.scale(scale, scale)
        ctx.drawImage(compositeCanvas!, -canvasW / 2, -canvasH / 2, canvasW, canvasH)
        ctx.restore()
      }

      ctx.restore()
    }
  }

  // Draw smoke particles
  if (state.particles.length > 0) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    for (const p of state.particles) {
      if (p.alpha <= 0) continue
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius)
      grad.addColorStop(0, `rgba(230, 230, 230, ${p.alpha})`)
      grad.addColorStop(0.5, `rgba(200, 200, 200, ${p.alpha * 0.5})`)
      grad.addColorStop(1, `rgba(180, 180, 180, 0)`)
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
      ctx.fillStyle = grad
      ctx.fill()
    }
    ctx.restore()
  }
}
