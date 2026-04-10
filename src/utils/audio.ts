import { NOTE_NAMES, DURATION_BEATS } from '../constants'
import type { MelNote } from '../types'

const NOTE_FREQS: Record<string, number> = {
  'C2': 65.4, 'C#2': 69.3, 'D2': 73.4, 'D#2': 77.8, 'E2': 82.4, 'F2': 87.3, 'F#2': 92.5, 'G2': 98, 'G#2': 103.8, 'A2': 110, 'A#2': 116.5, 'B2': 123.5,
  'C3': 130.8, 'C#3': 138.6, 'D3': 146.8, 'D#3': 155.6, 'E3': 164.8, 'F3': 174.6, 'F#3': 185, 'G3': 196, 'G#3': 207.7, 'A3': 220, 'A#3': 233.1, 'B3': 246.9,
  'C4': 261.6, 'C#4': 277.2, 'D4': 293.7, 'D#4': 311.1, 'E4': 329.6, 'F4': 349.2, 'F#4': 370, 'G4': 392, 'G#4': 415.3, 'A4': 440, 'A#4': 466.2, 'B4': 493.9,
  'C5': 523.3, 'C#5': 554.4, 'D5': 587.3, 'D#5': 622.3, 'E5': 659.3, 'F5': 698.5, 'F#5': 740, 'G5': 784, 'G#5': 830.6, 'A5': 880, 'A#5': 932.3, 'B5': 987.8,
}

const CHORD_INTERVALS: Record<string, number[]> = {
  '': [0, 4, 7], 'M7': [0, 4, 7, 11], '7': [0, 4, 7, 10],
  'm': [0, 3, 7], 'm7': [0, 3, 7, 10], 'add9': [0, 4, 7, 14], 'sus4': [0, 5, 7],
}

let actx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!actx) actx = new AudioContext()
  if (actx.state === 'suspended') {
    // Fire and forget — but also try synchronous resume for immediate playback
    actx.resume().catch(() => {})
  }
  return actx
}

/** Ensure AudioContext is ready (call before playback after user gesture) */
export async function ensureAudioReady(): Promise<void> {
  const ctx = getCtx()
  if (ctx.state === 'suspended') await ctx.resume()
}

export function parseChord(name: string): string[] {
  if (!name) return []
  const sl = name.indexOf('/')
  const base = sl > 0 ? name.slice(0, sl) : name
  const m = base.match(/^([A-G]#?)(.*)$/)
  if (!m) return []
  const ri = NOTE_NAMES.indexOf(m[1])
  if (ri < 0) return []
  const ivs = CHORD_INTERVALS[m[2]] || CHORD_INTERVALS['']
  return ivs.map(i => {
    const ni = (ri + i) % 12
    const o = 3 + Math.floor((ri + i) / 12)
    return NOTE_NAMES[ni] + o
  })
}

export function playChord(name: string): void {
  if (!name) return
  const ctx = getCtx()
  const notes = parseChord(name)
  if (!notes.length) return
  const now = ctx.currentTime
  notes.forEach(n => {
    const freq = NOTE_FREQS[n]
    if (!freq) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const filt = ctx.createBiquadFilter()
    osc.type = 'triangle'
    osc.frequency.value = freq
    filt.type = 'lowpass'
    filt.frequency.value = 2200
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.12, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2)
    osc.connect(filt)
    filt.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 1.2)
  })
}

export function playNote(pitch: string): void {
  const ctx = getCtx()
  const freq = NOTE_FREQS[pitch]
  if (!freq) return
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(0.2, now + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + 0.8)
}

export function getScaleNotes(key: string): string[] {
  const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11]
  const ri = NOTE_NAMES.indexOf(key)
  if (ri < 0) return NOTE_NAMES
  return MAJOR_SCALE.map(i => NOTE_NAMES[(ri + i) % 12])
}

/** Play a section: auto-detects melody/chords/both and schedules playback */
export function playSectionAudio(
  measures: { chord: string; melNotes: MelNote[] }[],
  tempo: number,
  beatsPerMeas = 4,
  autoAccomp = false,
): { stop: () => void; durationMs: number } {
  const ctx = getCtx()
  const beatDur = 60 / tempo
  const oscs: OscillatorNode[] = []
  const now = ctx.currentTime + 0.05

  const hasChords = measures.some(m => !!m.chord)
  const hasMelody = measures.some(m => m.melNotes?.some(n => n.pitch !== 'R'))

  // Auto accompaniment: bass + pad + drums
  if (autoAccomp && hasChords) {
    for (let mi = 0; mi < measures.length; mi++) {
      const m = measures[mi]
      if (!m.chord) continue
      const mStart = now + mi * beatsPerMeas * beatDur
      const chordParts = m.chord.includes('|') ? m.chord.split('|').map(c => c.trim()) : [m.chord]
      const chordDur = (beatsPerMeas * beatDur) / chordParts.length

      for (let ci = 0; ci < chordParts.length; ci++) {
        if (!chordParts[ci]) continue
        const cStart = mStart + ci * chordDur
        const notes = parseChord(chordParts[ci])
        if (notes.length === 0) continue

        // Bass: root note on every beat (quarter notes)
        const rootMatch = notes[0].match(/^([A-G]#?)/)
        if (rootMatch) {
          const bassRoot = rootMatch[1] + '2'
          const bassFreq = NOTE_FREQS[bassRoot]
          if (bassFreq) {
            const beatsInChord = chordDur / beatDur
            for (let b = 0; b < beatsInChord; b++) {
              const bStart = cStart + b * beatDur
              const osc = ctx.createOscillator()
              const gain = ctx.createGain()
              const filt = ctx.createBiquadFilter()
              osc.type = 'sawtooth'
              osc.frequency.value = bassFreq
              filt.type = 'lowpass'
              filt.frequency.value = 400
              gain.gain.setValueAtTime(0, bStart)
              gain.gain.linearRampToValueAtTime(0.14, bStart + 0.01)
              gain.gain.exponentialRampToValueAtTime(0.001, bStart + beatDur * 0.9)
              osc.connect(filt); filt.connect(gain); gain.connect(ctx.destination)
              osc.start(bStart); osc.stop(bStart + beatDur)
              oscs.push(osc)
            }
          }
        }

        // Pad: chord sustained (3-note triad)
        for (const n of notes.slice(0, 3)) {
          const freq = NOTE_FREQS[n]
          if (!freq) continue
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          const filt = ctx.createBiquadFilter()
          osc.type = 'triangle'
          osc.frequency.value = freq
          filt.type = 'lowpass'
          filt.frequency.value = 1800
          gain.gain.setValueAtTime(0, cStart)
          gain.gain.linearRampToValueAtTime(0.04, cStart + 0.15)
          gain.gain.setValueAtTime(0.04, cStart + chordDur - 0.15)
          gain.gain.exponentialRampToValueAtTime(0.001, cStart + chordDur - 0.02)
          osc.connect(filt); filt.connect(gain); gain.connect(ctx.destination)
          osc.start(cStart); osc.stop(cStart + chordDur)
          oscs.push(osc)
        }
      }

      // Drums: 8-beat pattern per measure
      const beatsInMeas = beatsPerMeas
      for (let b = 0; b < beatsInMeas * 2; b++) { // 8 eighth notes
        const bStart = mStart + b * (beatDur / 2)
        const isKick = b === 0 || b === beatsInMeas // beats 1 & 3
        const isSnare = b === 2 || b === beatsInMeas + 2 // beats 2 & 4

        // Hi-hat: every 8th note
        {
          const noise = ctx.createBufferSource()
          const buf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate)
          const data = buf.getChannelData(0)
          for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1)
          noise.buffer = buf
          const filt = ctx.createBiquadFilter()
          filt.type = 'highpass'
          filt.frequency.value = 7000
          const gain = ctx.createGain()
          gain.gain.setValueAtTime(0.03, bStart)
          gain.gain.exponentialRampToValueAtTime(0.001, bStart + 0.04)
          noise.connect(filt); filt.connect(gain); gain.connect(ctx.destination)
          noise.start(bStart); noise.stop(bStart + 0.05)
        }

        if (isKick) {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.setValueAtTime(120, bStart)
          osc.frequency.exponentialRampToValueAtTime(40, bStart + 0.08)
          gain.gain.setValueAtTime(0.3, bStart)
          gain.gain.exponentialRampToValueAtTime(0.001, bStart + 0.15)
          osc.connect(gain); gain.connect(ctx.destination)
          osc.start(bStart); osc.stop(bStart + 0.15)
          oscs.push(osc)
        }

        if (isSnare) {
          const noise = ctx.createBufferSource()
          const buf = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate)
          const data = buf.getChannelData(0)
          for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1)
          noise.buffer = buf
          const filt = ctx.createBiquadFilter()
          filt.type = 'bandpass'
          filt.frequency.value = 2000
          const gain = ctx.createGain()
          gain.gain.setValueAtTime(0.15, bStart)
          gain.gain.exponentialRampToValueAtTime(0.001, bStart + 0.12)
          noise.connect(filt); filt.connect(gain); gain.connect(ctx.destination)
          noise.start(bStart); noise.stop(bStart + 0.15)
        }
      }
    }
  }

  for (let mi = 0; mi < measures.length; mi++) {
    const m = measures[mi]
    const mStart = now + mi * beatsPerMeas * beatDur

    // Chords — supports "Am | F" (half-bar split)
    if (hasChords && m.chord) {
      const chordParts = m.chord.includes('|') ? m.chord.split('|').map(c => c.trim()) : [m.chord]
      const chordDur = (beatsPerMeas * beatDur) / chordParts.length
      for (let ci = 0; ci < chordParts.length; ci++) {
        if (!chordParts[ci]) continue
        const cStart = mStart + ci * chordDur
        const notes = parseChord(chordParts[ci])
        for (const n of notes) {
          const freq = NOTE_FREQS[n]
          if (!freq) continue
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          const filt = ctx.createBiquadFilter()
          osc.type = 'triangle'
          osc.frequency.value = freq
          filt.type = 'lowpass'
          filt.frequency.value = 2200
          const vol = hasMelody ? 0.06 : 0.12
          gain.gain.setValueAtTime(0, cStart)
          gain.gain.linearRampToValueAtTime(vol, cStart + 0.02)
          gain.gain.exponentialRampToValueAtTime(0.001, cStart + chordDur - 0.05)
          osc.connect(filt)
          filt.connect(gain)
          gain.connect(ctx.destination)
          osc.start(cStart)
          osc.stop(cStart + chordDur)
          oscs.push(osc)
        }
      }
    }

    // Melody
    if (hasMelody) {
      for (const n of (m.melNotes || [])) {
        if (n.pitch === 'R') continue
        const freq = NOTE_FREQS[n.pitch]
        if (!freq) continue
        const nStart = mStart + (n.startBeat || 0) * beatDur
        const nDur = (DURATION_BEATS[n.duration] || 1) * beatDur
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = freq
        gain.gain.setValueAtTime(0, nStart)
        gain.gain.linearRampToValueAtTime(0.28, nStart + 0.01)
        gain.gain.setValueAtTime(0.22, nStart + nDur * 0.7)
        gain.gain.exponentialRampToValueAtTime(0.001, nStart + nDur - 0.01)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(nStart)
        osc.stop(nStart + nDur)
        oscs.push(osc)
      }
    }
  }

  const durationMs = measures.length * beatsPerMeas * beatDur * 1000
  return {
    durationMs,
    stop() { for (const o of oscs) try { o.stop() } catch { /* already stopped */ } },
  }
}
