import {
  HandLandmarker,
  ImageSegmenter,
  FilesetResolver,
} from '@mediapipe/tasks-vision'

const CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'

let handLandmarker: HandLandmarker | null = null
let imageSegmenter: ImageSegmenter | null = null

export async function loadModels(
  onProgress?: (msg: string) => void
): Promise<{ handLandmarker: HandLandmarker; imageSegmenter: ImageSegmenter }> {
  onProgress?.('Loading MediaPipe WASM...')

  const vision = await FilesetResolver.forVisionTasks(CDN)

  onProgress?.('Loading hand detector model...')
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

  onProgress?.('Loading segmentation model...')
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

  onProgress?.('Ready!')
  return { handLandmarker, imageSegmenter }
}

export { handLandmarker, imageSegmenter }
