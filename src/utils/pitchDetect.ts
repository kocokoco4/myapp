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

export interface DetectedNote {
  pitch: string
  durationMs: number
}

/**
 * Quantize duration (ms) to nearest musical note value based on BPM.
 * Returns duration string: 'w'|'h'|'q'|'8'|'16'|'32'|'dq'|'d8'|'tq'|'t8'
 */
export function quantizeDuration(ms: number, bpm: number): string {
  const beatMs = 60000 / bpm // 1 quarter note in ms
  // Candidate durations in ms
  const candidates: { v: string; ms: number }[] = [
    { v: 'w', ms: beatMs * 4 },
    { v: 'dh', ms: beatMs * 3 },
    { v: 'h', ms: beatMs * 2 },
    { v: 'dq', ms: beatMs * 1.5 },
    { v: 'q', ms: beatMs },
    { v: 'tq', ms: beatMs * (2 / 3) }, // quarter triplet
    { v: 'd8', ms: beatMs * 0.75 },
    { v: '8', ms: beatMs * 0.5 },
    { v: 't8', ms: beatMs * (1 / 3) }, // eighth triplet
    { v: '16', ms: beatMs * 0.25 },
    { v: '32', ms: beatMs * 0.125 },
  ]
  let best = candidates[0]
  let bestDiff = Math.abs(ms - best.ms)
  for (const c of candidates) {
    const diff = Math.abs(ms - c.ms)
    if (diff < bestDiff) { best = c; bestDiff = diff }
  }
  return best.v
}

/**
 * Create a pitch detector with onset/offset detection.
 * Calls onNote(pitch, durationMs) when a note ends.
 */
export function createPitchDetector(
  onNote: (note: DetectedNote) => void,
  _options?: { minConfidence?: number }
): PitchDetector {
  let audioCtx: AudioContext | null = null
  let analyser: AnalyserNode | null = null
  let stream: MediaStream | null = null
  let rafId = 0
  let active = false

  // Onset/offset state
  let currentNote = '' // note being sung right now
  let noteStartTime = 0 // ms when current note started
  let lastStableNote = '' // last candidate
  let stableFrames = 0
  let silenceFrames = 0

  const STABILITY_FRAMES = 3 // ~100ms confirm
  const SILENCE_FRAMES_END = 4 // ~130ms silence = note end

  const emitNote = () => {
    if (currentNote && noteStartTime > 0) {
      const durationMs = performance.now() - noteStartTime
      if (durationMs > 80) { // ignore very short glitches
        onNote({ pitch: currentNote, durationMs })
      }
      currentNote = ''
      noteStartTime = 0
    }
  }

  const detect = () => {
    if (!analyser || !active) return
    const buf = new Float32Array(analyser.fftSize)
    analyser.getFloatTimeDomainData(buf)
    const freq = yinDetect(buf, audioCtx!.sampleRate)

    if (freq > 0) {
      silenceFrames = 0
      const result = freqToNote(freq)
      if (result && Math.abs(result.cents) < 45) {
        const pitch = result.note + result.octave
        if (pitch === lastStableNote) {
          stableFrames++
          if (stableFrames >= STABILITY_FRAMES) {
            // Pitch is stable
            if (currentNote !== pitch) {
              // New note started (pitch change)
              if (currentNote) emitNote() // emit previous note
              currentNote = pitch
              noteStartTime = performance.now()
            }
          }
        } else {
          lastStableNote = pitch
          stableFrames = 1
        }
      }
    } else {
      silenceFrames++
      if (silenceFrames >= SILENCE_FRAMES_END) {
        // Silence detected → end current note
        if (currentNote) emitNote()
        lastStableNote = ''
        stableFrames = 0
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
      // Emit final note if still singing
      if (currentNote) emitNote()
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
