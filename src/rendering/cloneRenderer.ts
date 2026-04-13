import type { CloneState } from '../types'

const PHASE_DURATIONS = {
  flash: 150,
  fadein: 350,   // 150-500ms
  hold: 3000,    // 500-3500ms
  fadeout: 1000, // 3500-4500ms
}

export function createCloneState(): CloneState {
  return {
    active: false,
    phase: 'done',
    startTime: 0,
    cloneCanvas: null,
    alpha: 0,
  }
}

export function triggerClone(
  state: CloneState,
  videoElement: HTMLVideoElement,
  maskData?: { mask: Float32Array; width: number; height: number }
): void {
  state.active = true
  state.phase = 'flash'
  state.startTime = performance.now()

  // Capture current frame into offscreen canvas
  const vw = videoElement.videoWidth || 640
  const vh = videoElement.videoHeight || 480
  state.cloneCanvas = new OffscreenCanvas(vw, vh)
  const offCtx = state.cloneCanvas.getContext('2d') as OffscreenCanvasRenderingContext2D
  if (!offCtx) return

  // Draw mirrored frame
  offCtx.save()
  offCtx.scale(-1, 1)
  offCtx.drawImage(videoElement, -vw, 0, vw, vh)
  offCtx.restore()

  // Apply segmentation mask if available
  if (maskData) {
    applyMask(offCtx, maskData, vw, vh)
  }
}

function applyMask(
  ctx: OffscreenCanvasRenderingContext2D,
  maskData: { mask: Float32Array; width: number; height: number },
  canvasW: number,
  canvasH: number
): void {
  const imageData = ctx.getImageData(0, 0, canvasW, canvasH)
  const pixels = imageData.data
  const { mask, width: mw, height: mh } = maskData

  for (let y = 0; y < canvasH; y++) {
    for (let x = 0; x < canvasW; x++) {
      const mx = Math.floor((x / canvasW) * mw)
      const my = Math.floor((y / canvasH) * mh)
      const maskIdx = my * mw + mx
      // Mirror the x-coordinate for the mask (since frame was mirrored)
      const mirroredMx = mw - 1 - mx
      const mirroredIdx = my * mw + mirroredMx
      const confidence = mask[mirroredIdx] ?? mask[maskIdx] ?? 0

      const pixelIdx = (y * canvasW + x) * 4
      // Zero out background pixels
      pixels[pixelIdx + 3] = Math.floor(confidence * 255)
    }
  }
  ctx.putImageData(imageData, 0, 0)
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
    state.alpha = t * 0.4  // max alpha 0.4
  } else if (elapsed < PHASE_DURATIONS.flash + PHASE_DURATIONS.fadein + PHASE_DURATIONS.hold) {
    state.phase = 'hold'
    state.alpha = 0.4
  } else if (elapsed < PHASE_DURATIONS.flash + PHASE_DURATIONS.fadein + PHASE_DURATIONS.hold + PHASE_DURATIONS.fadeout) {
    state.phase = 'fadeout'
    const t = (elapsed - PHASE_DURATIONS.flash - PHASE_DURATIONS.fadein - PHASE_DURATIONS.hold) / PHASE_DURATIONS.fadeout
    state.alpha = 0.4 * (1 - t)
  } else {
    state.phase = 'done'
    state.active = false
    state.alpha = 0
    state.cloneCanvas = null
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
  canvasH: number
): void {
  if (!state.active || !state.cloneCanvas || state.alpha <= 0) return

  ctx.save()

  const supportsFilter = 'filter' in ctx
  if (supportsFilter) {
    ctx.filter = 'blur(3px)'
  }

  ctx.globalAlpha = state.alpha

  for (const { dx, dy, scale } of CLONE_POSITIONS) {
    ctx.save()
    ctx.translate(canvasW / 2 + dx, canvasH / 2 + dy)
    ctx.scale(scale, scale)
    ctx.drawImage(
      state.cloneCanvas,
      -canvasW / 2,
      -canvasH / 2,
      canvasW,
      canvasH
    )
    ctx.restore()
  }

  ctx.restore()
}
