import type { CloneState } from '../types'

const PHASE_DURATIONS = {
  flash: 150,
  fadein: 350,   // 150-500ms
  hold: 9000,    // 500-9500ms
  fadeout: 500,  // 9500-10000ms
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

export function createCloneState(): CloneState {
  return {
    active: false,
    phase: 'done',
    startTime: 0,
    alpha: 0,
  }
}

export function triggerClone(state: CloneState): void {
  state.active = true
  state.phase = 'flash'
  state.startTime = performance.now()
}

export function updateClone(state: CloneState): void {
  if (!state.active) return

  const elapsed = performance.now() - state.startTime

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
  } else {
    state.phase = 'done'
    state.active = false
    state.alpha = 0
  }
}

const CLONE_POSITIONS = [
  { dx: -100, dy: 5, scale: 0.95 },
  { dx: 100, dy: -5, scale: 0.90 },
]

export function drawClones(
  ctx: CanvasRenderingContext2D,
  state: CloneState,
  canvasW: number,
  canvasH: number,
  video: HTMLVideoElement,
  maskData?: { mask: Float32Array; width: number; height: number } | null
): void {
  if (!state.active || state.alpha <= 0) return

  const offCtx = getCompositeCanvas(canvasW, canvasH)
  if (!offCtx) return

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
