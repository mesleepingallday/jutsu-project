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

export interface CloneState {
  active: boolean
  phase: 'flash' | 'fadein' | 'hold' | 'fadeout' | 'done'
  startTime: number
  alpha: number
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
