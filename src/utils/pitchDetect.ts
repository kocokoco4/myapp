/**
 * ピッチ検出 — Web Audio API + YIN algorithm
 * YIN: de Cheveigne & Kawahara (2002) の高精度ピッチ検出
 * autocorrelationより倍音耐性・ノイズ耐性が大幅に高い
 *
 * [ZooLab連携ポイント] 音声入力は他の音楽系アプリでも再利用可能
 */

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

/** Hz → 音名 (e.g. 440 → "A4") */
export function freqToNote(freq: number): { note: string; octave: number; cents: number } | null {
  if (freq < 60 || freq > 2000) return null
  const midi = 12 * (Math.log2(freq / 440)) + 69
  const rounded = Math.round(midi)
  const cents = Math.round((midi - rounded) * 100)
  const note = NOTE_NAMES[rounded % 12]
  const octave = Math.floor(rounded / 12) - 1
  return { note, octave, cents }
}

/**
 * YIN pitch detection algorithm
 * Reference: "YIN, a fundamental frequency estimator for speech and music"
 * de Cheveigne & Kawahara, JASA 2002
 */
function yinDetect(buf: Float32Array, sampleRate: number): number {
  const bufSize = buf.length
  const halfSize = Math.floor(bufSize / 2)
  const yinThreshold = 0.15 // lower = stricter (0.1-0.2 is good for voice)

  // Check if signal is loud enough
  let rms = 0
  for (let i = 0; i < bufSize; i++) rms += buf[i] * buf[i]
  rms = Math.sqrt(rms / bufSize)
  if (rms < 0.008) return -1 // too quiet

  // Step 1: Difference function
  const diff = new Float32Array(halfSize)
  for (let tau = 0; tau < halfSize; tau++) {
    let sum = 0
    for (let i = 0; i < halfSize; i++) {
      const d = buf[i] - buf[i + tau]
      sum += d * d
    }
    diff[tau] = sum
  }

  // Step 2: Cumulative mean normalized difference function (CMND)
  const cmnd = new Float32Array(halfSize)
  cmnd[0] = 1
  let runningSum = 0
  for (let tau = 1; tau < halfSize; tau++) {
    runningSum += diff[tau]
    cmnd[tau] = diff[tau] * tau / runningSum
  }

  // Step 3: Absolute threshold
  // Find the first tau where cmnd drops below threshold
  let tauEstimate = -1
  for (let tau = 2; tau < halfSize; tau++) {
    if (cmnd[tau] < yinThreshold) {
      // Find the local minimum after this point
      while (tau + 1 < halfSize && cmnd[tau + 1] < cmnd[tau]) {
        tau++
      }
      tauEstimate = tau
      break
    }
  }

  if (tauEstimate === -1) return -1 // no pitch found

  // Step 4: Parabolic interpolation for sub-sample accuracy
  let betterTau = tauEstimate
  if (tauEstimate > 0 && tauEstimate < halfSize - 1) {
    const s0 = cmnd[tauEstimate - 1]
    const s1 = cmnd[tauEstimate]
    const s2 = cmnd[tauEstimate + 1]
    const shift = (s0 - s2) / (2 * (s0 - 2 * s1 + s2))
    if (Math.abs(shift) < 1) betterTau = tauEstimate + shift
  }

  return sampleRate / betterTau
}

export interface PitchDetector {
  start: () => Promise<void>
  stop: () => void
  isActive: () => boolean
}

/**
 * Create a pitch detector that calls onPitch whenever a stable pitch is detected
 */
export function createPitchDetector(
  onPitch: (pitch: string) => void,
  _options?: { minConfidence?: number }
): PitchDetector {
  let audioCtx: AudioContext | null = null
  let analyser: AnalyserNode | null = null
  let stream: MediaStream | null = null
  let rafId = 0
  let active = false
  let lastNote = ''
  let stableCount = 0
  let emittedNote = '' // already emitted this note
  let silenceCount = 0

  const detect = () => {
    if (!analyser || !active) return
    const buf = new Float32Array(analyser.fftSize)
    analyser.getFloatTimeDomainData(buf)
    const freq = yinDetect(buf, audioCtx!.sampleRate)

    if (freq > 0) {
      silenceCount = 0
      const result = freqToNote(freq)
      if (result && Math.abs(result.cents) < 45) {
        const pitch = result.note + result.octave
        if (pitch === lastNote) {
          stableCount++
          // Emit only once per note. Need 3 frames of stability (~100ms)
          if (stableCount >= 3 && pitch !== emittedNote) {
            onPitch(pitch)
            emittedNote = pitch
            stableCount = 0
          }
        } else {
          lastNote = pitch
          stableCount = 1
        }
      }
    } else {
      // No pitch detected (silence or noise)
      silenceCount++
      if (silenceCount > 5) { // ~150ms of silence → ready for next note
        emittedNote = ''
        lastNote = ''
        stableCount = 0
      }
    }

    rafId = requestAnimationFrame(detect)
  }

  return {
    async start() {
      if (active) return
      audioCtx = new AudioContext()
      analyser = audioCtx.createAnalyser()
      analyser.fftSize = 4096 // larger = better pitch resolution for voice

      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const source = audioCtx.createMediaStreamSource(stream)
      source.connect(analyser)

      active = true
      detect()
    },
    stop() {
      active = false
      cancelAnimationFrame(rafId)
      stream?.getTracks().forEach(t => t.stop())
      audioCtx?.close()
      audioCtx = null
      analyser = null
      stream = null
    },
    isActive: () => active,
  }
}
