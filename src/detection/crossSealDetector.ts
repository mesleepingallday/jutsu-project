import type { HandLandmark } from '../types'

interface NormalizedLandmark {
  x: number
  y: number
  z: number
}

function dist(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

function getBBox(landmarks: NormalizedLandmark[]): {
  minX: number; minY: number; maxX: number; maxY: number
} {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const lm of landmarks) {
    if (lm.x < minX) minX = lm.x
    if (lm.y < minY) minY = lm.y
    if (lm.x > maxX) maxX = lm.x
    if (lm.y > maxY) maxY = lm.y
  }
  return { minX, minY, maxX, maxY }
}

function boxesOverlap(
  a: { minX: number; minY: number; maxX: number; maxY: number },
  b: { minX: number; minY: number; maxX: number; maxY: number }
): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY
}

export function detectCrossSeal(hands: HandLandmark[][]): boolean {
  // 1. Two hands present
  if (hands.length !== 2) return false

  const [h0, h1] = hands
  if (h0.length < 21 || h1.length < 21) return false

  // 2. Wrists centered (x in [0.15, 0.85] — relaxed for mirrored feed)
  const w0 = h0[0], w1 = h1[0]
  if (w0.x < 0.15 || w0.x > 0.85 || w1.x < 0.15 || w1.x > 0.85) return false

  // 3. Wrists close to each other
  if (dist(w0, w1) > 0.35) return false

  // 4. Bounding boxes overlap
  const bb0 = getBBox(h0)
  const bb1 = getBBox(h1)
  if (!boxesOverlap(bb0, bb1)) return false

  // 5. Chest height: average y of all landmarks in [0.2, 0.85]
  const allLandmarks = [...h0, ...h1]
  const avgY = allLandmarks.reduce((s, lm) => s + lm.y, 0) / allLandmarks.length
  if (avgY < 0.2 || avgY > 0.85) return false

  // 6. Fingers up: at least 3/4 fingertips above their base on each hand
  const fingertips = [8, 12, 16, 20]
  const fingerbases = [5, 9, 13, 17]
  let upCount0 = 0, upCount1 = 0
  for (let i = 0; i < 4; i++) {
    if (h0[fingertips[i]].y < h0[fingerbases[i]].y) upCount0++
    if (h1[fingertips[i]].y < h1[fingerbases[i]].y) upCount1++
  }
  if (upCount0 < 3 || upCount1 < 3) return false

  // 7. Hands crossed: fingertips from both hands interleaved by x coordinate
  const tips0 = fingertips.map(i => ({ x: h0[i].x, hand: 0 }))
  const tips1 = fingertips.map(i => ({ x: h1[i].x, hand: 1 }))
  const allTips = [...tips0, ...tips1].sort((a, b) => a.x - b.x)
  let alternations = 0
  for (let i = 1; i < allTips.length; i++) {
    if (allTips[i].hand !== allTips[i - 1].hand) alternations++
  }
  if (alternations < 2) return false

  return true
}
