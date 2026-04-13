export interface HandLandmark {
  x: number
  y: number
  z: number
}

export interface SealCheckResult {
  passed: boolean
  checks: {
    twoHands: boolean
    wristsCentered: boolean
    wristsClose: boolean
    boxesOverlap: boolean
    chestHeight: boolean
    fingersUp: boolean
    handsCrossed: boolean
  }
}

export interface DetectionResult {
  sealDetected: boolean
  sealChecks?: SealCheckResult
  landmarks: HandLandmark[][]
  mask?: Float32Array
  maskWidth?: number
  maskHeight?: number
  timestamp: number
}

export interface SmokeParticle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  alpha: number
  life: number
  maxLife: number
}

export interface CloneState {
  active: boolean
  phase: 'flash' | 'fadein' | 'hold' | 'poof' | 'done'
  startTime: number
  alpha: number
  particles: SmokeParticle[]
}

export interface FlashState {
  active: boolean
  startTime: number
}

export interface WorkerInMessage {
  type: 'frame'
  bitmap: ImageBitmap
  timestamp: number
  frameCount: number
}

export interface WorkerOutMessage {
  type: 'result'
  result: DetectionResult
}

export interface AppState {
  loading: boolean
  loadingMessage: string
  error: string | null
  webcamReady: boolean
}
