// Short synthesized "poof" sound using Web Audio API
let audioCtx: AudioContext | null = null

function getAudioCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext()
  }
  return audioCtx
}

export function playPoofSound(): void {
  try {
    const ctx = getAudioCtx()
    if (ctx.state === 'suspended') {
      ctx.resume()
    }

    const now = ctx.currentTime
    const duration = 0.4

    // White noise burst
    const bufferSize = ctx.sampleRate * duration
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1)
    }

    const source = ctx.createBufferSource()
    source.buffer = buffer

    // Bandpass filter for "poof" character
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(400, now)
    filter.frequency.exponentialRampToValueAtTime(100, now + duration)
    filter.Q.value = 0.5

    // Gain envelope: quick attack, fast decay
    const gainNode = ctx.createGain()
    gainNode.gain.setValueAtTime(0, now)
    gainNode.gain.linearRampToValueAtTime(0.8, now + 0.02)
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration)

    source.connect(filter)
    filter.connect(gainNode)
    gainNode.connect(ctx.destination)

    source.start(now)
    source.stop(now + duration)
  } catch {
    // Audio context may be blocked; silently fail
  }
}

export function initAudio(): void {
  // Call on user gesture to unlock audio
  try {
    const ctx = getAudioCtx()
    if (ctx.state === 'suspended') {
      ctx.resume()
    }
  } catch {
    // ignore
  }
}
