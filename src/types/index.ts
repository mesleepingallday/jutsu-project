export interface HandLandmark {
  x: number
  y: number
  z: number
}

export interface DetectionResult {
  sealDetected: boolean
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
  cloneCanvas: OffscreenCanvas | null
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
