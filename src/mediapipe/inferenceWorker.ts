import {
  HandLandmarker,
  ImageSegmenter,
  FilesetResolver,
} from '@mediapipe/tasks-vision'
import { detectCrossSeal } from '../detection/crossSealDetector'
import type { WorkerInMessage, WorkerOutMessage } from '../types'

const CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'

let handLandmarker: HandLandmarker | null = null
let imageSegmenter: ImageSegmenter | null = null
let frameCount = 0
let latestMask: Float32Array | null = null
let maskWidth = 0
let maskHeight = 0

async function init() {
  const vision = await FilesetResolver.forVisionTasks(CDN)

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

  self.postMessage({ type: 'ready' })
}

self.onmessage = async (e: MessageEvent<WorkerInMessage>) => {
  if (!handLandmarker || !imageSegmenter) return

  const { bitmap, timestamp, frameCount: fc } = e.data
  frameCount = fc

  // Hand detection — every frame
  const handResult = handLandmarker.detectForVideo(bitmap, timestamp)
  const landmarks = handResult.landmarks ?? []

  // Segmentation — every 5th frame
  if (frameCount % 5 === 0) {
    const segResult = imageSegmenter.segmentForVideo(bitmap, timestamp)
    const masks = segResult.confidenceMasks
    if (masks && masks.length > 0) {
      const mp = masks[0]
      const arr = mp.getAsFloat32Array()
      latestMask = arr
      maskWidth = mp.width
      maskHeight = mp.height
      mp.close()
    }
    segResult.close?.()
  }

  const sealDetected = detectCrossSeal(landmarks)

  const msg: WorkerOutMessage = {
    type: 'result',
    result: {
      sealDetected,
      landmarks,
      mask: latestMask ?? undefined,
      maskWidth,
      maskHeight,
      timestamp,
    },
  }

  // Transfer bitmap back to be closed by GC, or close it here
  bitmap.close()

  self.postMessage(msg)
}

init().catch(err => {
  self.postMessage({ type: 'error', message: String(err) })
})
