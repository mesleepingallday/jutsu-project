import type { HandLandmark, SealCheckResult } from '../types'

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

export function detectCrossSeal(hands: HandLandmark[][]): SealCheckResult {
  const checks: SealCheckResult['checks'] = {
    twoHands: false,
    wristsCentered: false,
    wristsClose: false,
    boxesOverlap: false,
    chestHeight: false,
    fingersUp: false,
    handsCrossed: false,
  }

  // 1. Two hands present
  checks.twoHands = hands.length === 2
  if (!checks.twoHands) return { passed: false, checks }

  const [h0, h1] = hands
  if (h0.length < 21 || h1.length < 21) return { passed: false, checks }

  // 2. Wrists centered (x in [0.15, 0.85])
  const w0 = h0[0], w1 = h1[0]
  checks.wristsCentered = w0.x >= 0.15 && w0.x <= 0.85 && w1.x >= 0.15 && w1.x <= 0.85

  // 3. Wrists close to each other — relaxed from 0.35 to 0.45
  checks.wristsClose = dist(w0, w1) <= 0.45

  // 4. Bounding boxes overlap
  const bb0 = getBBox(h0)
  const bb1 = getBBox(h1)
  checks.boxesOverlap = boxesOverlap(bb0, bb1)

  // 5. Chest height: average y of all landmarks in [0.2, 0.85]
  const allLandmarks = [...h0, ...h1]
  const avgY = allLandmarks.reduce((s, lm) => s + lm.y, 0) / allLandmarks.length
  checks.chestHeight = avgY >= 0.2 && avgY <= 0.85

  // 6. Fingers up — relaxed: at least 1/4 per hand OR 2 total across both hands
  //    Real cross seal only has index fingers pointing up; most others are curled.
  const fingertips = [8, 12, 16, 20]
  const fingerbases = [5, 9, 13, 17]
  let upCount0 = 0, upCount1 = 0
  for (let i = 0; i < 4; i++) {
    if (h0[fingertips[i]].y < h0[fingerbases[i]].y) upCount0++
    if (h1[fingertips[i]].y < h1[fingerbases[i]].y) upCount1++
  }
  checks.fingersUp = (upCount0 >= 1 && upCount1 >= 1) || (upCount0 + upCount1 >= 2)

  // 7. Hands crossed — relaxed: x-ranges of fingertips from both hands overlap
  //    (real cross seal has wrapped fingers that cluster, not neat interleaving)
  const tips0x = fingertips.map(i => h0[i].x)
  const tips1x = fingertips.map(i => h1[i].x)
  const min0 = Math.min(...tips0x), max0 = Math.max(...tips0x)
  const min1 = Math.min(...tips1x), max1 = Math.max(...tips1x)
  const xOverlap = min0 < max1 && max0 > min1
  // Also check old interleaving as an OR — if either passes, accept
  const allTips = [
    ...fingertips.map(i => ({ x: h0[i].x, hand: 0 })),
    ...fingertips.map(i => ({ x: h1[i].x, hand: 1 })),
  ].sort((a, b) => a.x - b.x)
  let alternations = 0
  for (let i = 1; i < allTips.length; i++) {
    if (allTips[i].hand !== allTips[i - 1].hand) alternations++
  }
  checks.handsCrossed = xOverlap || alternations >= 1

  const passed =
    checks.twoHands &&
    checks.wristsCentered &&
    checks.wristsClose &&
    checks.boxesOverlap &&
    checks.chestHeight &&
    checks.fingersUp &&
    checks.handsCrossed

  return { passed, checks }
}
