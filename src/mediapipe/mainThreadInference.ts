import {
  HandLandmarker,
  ImageSegmenter,
  FilesetResolver,
} from '@mediapipe/tasks-vision'
import { detectCrossSeal } from '../detection/crossSealDetector'
import type { DetectionResult } from '../types'

const CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'

let handLandmarker: HandLandmarker | null = null
let imageSegmenter: ImageSegmenter | null = null
let latestMask: Float32Array | null = null
let maskWidth = 0
let maskHeight = 0
let initPromise: Promise<void> | null = null
let lastTimestamp = 0

export async function initModels(onProgress: (msg: string) => void): Promise<void> {
  // Guard against double-init (React StrictMode double-mounts)
  if (handLandmarker && imageSegmenter) return
  if (initPromise) return initPromise
  initPromise = doInit(onProgress)
  return initPromise
}

async function doInit(onProgress: (msg: string) => void): Promise<void> {
  onProgress('Loading MediaPipe WASM...')
  const vision = await FilesetResolver.forVisionTasks(CDN)

  onProgress('Loading hand detector (~5 MB)...')
  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numHands: 2,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  })

  onProgress('Loading segmentation model (~4 MB)...')
  imageSegmenter = await ImageSegmenter.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite',
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    outputCategoryMask: false,
    outputConfidenceMasks: true,
  })
}

export function runInference(
  video: HTMLVideoElement,
  timestamp: number,
  frameCount: number,
  lowFps: boolean
): DetectionResult {
  if (!handLandmarker || !imageSegmenter) {
    return { sealDetected: false, landmarks: [], timestamp }
  }

  // MediaPipe requires strictly increasing timestamps
  const mpTimestamp = Math.max(Math.round(timestamp), lastTimestamp + 1)
  lastTimestamp = mpTimestamp

  const handResult = handLandmarker.detectForVideo(video, mpTimestamp)
  const landmarks = handResult.landmarks ?? []

  // Segmentation every 5th frame (every 6th if low FPS)
  const segInterval = lowFps ? 6 : 5
  if (frameCount % segInterval === 0) {
    const segResult = imageSegmenter.segmentForVideo(video, mpTimestamp)
    const masks = segResult.confidenceMasks
    if (masks && masks.length > 0) {
      const mp = masks[0]
      latestMask = mp.getAsFloat32Array()
      maskWidth = mp.width
      maskHeight = mp.height
      mp.close()
    }
    segResult.close?.()
  }

  const sealDetected = detectCrossSeal(landmarks)

  return {
    sealDetected,
    landmarks,
    mask: latestMask ?? undefined,
    maskWidth,
    maskHeight,
    timestamp,
  }
}

export function isReady(): boolean {
  return handLandmarker !== null && imageSegmenter !== null
}
