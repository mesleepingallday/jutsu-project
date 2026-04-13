interface StabilizerConfig {
  requiredFrames: number  // consecutive frames to confirm seal
  cooldownMs: number      // ms before retriggering
}

export class PoseStabilizer {
  private consecutiveFrames = 0
  private lastTriggerTime = 0
  private config: StabilizerConfig

  constructor(config: StabilizerConfig = { requiredFrames: 10, cooldownMs: 10500 }) {
    this.config = config
  }

  update(sealDetected: boolean): boolean {
    const now = performance.now()
    const inCooldown = now - this.lastTriggerTime < this.config.cooldownMs

    if (!sealDetected) {
      this.consecutiveFrames = 0
      return false
    }

    if (inCooldown) {
      return false
    }

    this.consecutiveFrames++
    if (this.consecutiveFrames >= this.config.requiredFrames) {
      this.consecutiveFrames = 0
      this.lastTriggerTime = now
      return true
    }

    return false
  }

  getProgress(): number {
    return Math.min(this.consecutiveFrames / this.config.requiredFrames, 1)
  }

  isInCooldown(): boolean {
    return performance.now() - this.lastTriggerTime < this.config.cooldownMs
  }

  getCooldownProgress(): number {
    const elapsed = performance.now() - this.lastTriggerTime
    return Math.min(elapsed / this.config.cooldownMs, 1)
  }
}
