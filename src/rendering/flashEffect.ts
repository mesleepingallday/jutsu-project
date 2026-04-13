import type { FlashState } from '../types'

const FLASH_DURATION = 150  // ms

export function createFlashState(): FlashState {
  return { active: false, startTime: 0 }
}

export function triggerFlash(state: FlashState): void {
  state.active = true
  state.startTime = performance.now()
}

export function drawFlash(
  ctx: CanvasRenderingContext2D,
  state: FlashState,
  width: number,
  height: number
): void {
  if (!state.active) return

  const elapsed = performance.now() - state.startTime
  if (elapsed >= FLASH_DURATION) {
    state.active = false
    return
  }

  const progress = elapsed / FLASH_DURATION
  // Fade from white to transparent
  const alpha = 1 - progress

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.restore()
}
