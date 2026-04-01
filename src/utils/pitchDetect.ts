/**
 * ピッチ検出 — Web Audio API + autocorrelation
 * マイクからリアルタイムで音高を検出し、MIDI音名に変換する
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

/** Autocorrelation pitch detection */
function autoCorrelate(buf: Float32Array, sampleRate: number): number {
  // Not enough signal
  let rms = 0
  for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i]
  rms = Math.sqrt(rms / buf.length)
  if (rms < 0.01) return -1 // too quiet

  // Trim silence from edges
  let r1 = 0, r2 = buf.length - 1
  const threshold = 0.2
  for (let i = 0; i < buf.length / 2; i++) { if (Math.abs(buf[i]) < threshold) { r1 = i } else break }
  for (let i = 1; i < buf.length / 2; i++) { if (Math.abs(buf[buf.length - i]) < threshold) { r2 = buf.length - i } else break }
  const trimmed = buf.slice(r1, r2)
  const size = trimmed.length

  // Autocorrelation
  const c = new Float32Array(size)
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size - i; j++) {
      c[i] += trimmed[j] * trimmed[j + i]
    }
  }

  // Find first dip then first peak
  let d = 0
  while (c[d] > c[d + 1]) d++
  let maxVal = -1, maxPos = -1
  for (let i = d; i < size; i++) {
    if (c[i] > maxVal) { maxVal = c[i]; maxPos = i }
  }

  const freq = sampleRate / maxPos
  return freq
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

  const detect = () => {
    if (!analyser || !active) return
    const buf = new Float32Array(analyser.fftSize)
    analyser.getFloatTimeDomainData(buf)
    const freq = autoCorrelate(buf, audioCtx!.sampleRate)

    if (freq > 0) {
      const result = freqToNote(freq)
      if (result && Math.abs(result.cents) < 40) {
        const pitch = result.note + result.octave
        if (pitch === lastNote) {
          stableCount++
          if (stableCount >= 3) { // ~100ms of stability
            onPitch(pitch)
            stableCount = 0
          }
        } else {
          lastNote = pitch
          stableCount = 1
        }
      }
    }

    rafId = requestAnimationFrame(detect)
  }

  return {
    async start() {
      if (active) return
      audioCtx = new AudioContext()
      analyser = audioCtx.createAnalyser()
      analyser.fftSize = 2048

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
