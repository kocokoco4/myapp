/**
 * Standard MIDI File (SMF) Format 1 出力
 * 外部パッケージ不要 — バイナリを直接組み立てる
 *
 * [ZooLab連携ポイント] MIDI出力は他のアプリでも再利用可能
 */
import type { MelNote, Song, Accomp } from '../types'
import { DURATION_BEATS } from '../constants'
import { parseChord } from './audio'

const NOTE_MAP: Record<string, number> = {
  'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
  'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11,
}

/** Pitch string (e.g. "C4") to MIDI note number (0-127) */
function pitchToMidi(pitch: string): number {
  const m = pitch.match(/^([A-G]#?)(\d)$/)
  if (!m) return 60 // fallback to middle C
  const note = NOTE_MAP[m[1]]
  const octave = parseInt(m[2])
  return (octave + 1) * 12 + note // MIDI convention: C4 = 60
}

/** Duration string to ticks (480 ticks per quarter note) */
function durToTicks(dur: string): number {
  const beats = DURATION_BEATS[dur] || 1
  return Math.round(beats * 480)
}

// ─── MIDI Binary helpers ─── //

function writeVarLen(val: number): number[] {
  if (val < 0) val = 0
  const bytes: number[] = []
  bytes.unshift(val & 0x7f)
  val >>= 7
  while (val > 0) {
    bytes.unshift((val & 0x7f) | 0x80)
    val >>= 7
  }
  return bytes
}

function writeStr(s: string): number[] {
  return Array.from(s).map(c => c.charCodeAt(0))
}

function write32(n: number): number[] {
  return [(n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

function write16(n: number): number[] {
  return [(n >> 8) & 0xff, n & 0xff]
}

interface MidiEvent {
  delta: number
  data: number[]
}

function buildTrack(events: MidiEvent[], name?: string): number[] {
  const body: number[] = []

  // Track name meta event
  if (name) {
    const nameBytes = new TextEncoder().encode(name)
    body.push(...writeVarLen(0), 0xff, 0x03, ...writeVarLen(nameBytes.length), ...nameBytes)
  }

  for (const ev of events) {
    body.push(...writeVarLen(ev.delta), ...ev.data)
  }

  // End of track
  body.push(...writeVarLen(0), 0xff, 0x2f, 0x00)

  return [...writeStr('MTrk'), ...write32(body.length), ...body]
}

function noteOn(ch: number, note: number, vel: number): number[] {
  return [0x90 | (ch & 0x0f), note & 0x7f, vel & 0x7f]
}

function noteOff(ch: number, note: number): number[] {
  return [0x80 | (ch & 0x0f), note & 0x7f, 0]
}

// ─── Build MIDI from song data ─── //

function melodyToEvents(notes: MelNote[], channel: number): MidiEvent[] {
  const events: MidiEvent[] = []
  let tick = 0
  for (const n of notes) {
    if (n.pitch === 'R') {
      tick += durToTicks(n.duration)
      continue
    }
    const midi = pitchToMidi(n.pitch)
    const dur = durToTicks(n.duration)
    const startTick = Math.round((n.startBeat || 0) * 480)
    const delta = startTick - tick
    events.push({ delta: Math.max(0, delta), data: noteOn(channel, midi, 80) })
    events.push({ delta: dur, data: noteOff(channel, midi) })
    tick = startTick + dur
  }
  return events
}

function chordsToEvents(chords: string[], beatsPerChord: number, channel: number): MidiEvent[] {
  const events: MidiEvent[] = []
  for (const chord of chords) {
    if (!chord) {
      // rest: advance by one chord duration
      const dur = Math.round(beatsPerChord * 480)
      events.push({ delta: dur, data: noteOn(channel, 0, 0) }) // placeholder
      continue
    }
    // Handle "Am | F" multi-chord measures
    const parts = chord.includes('|') ? chord.split('|').map(c => c.trim()) : [chord]
    const partBeats = beatsPerChord / parts.length

    for (const part of parts) {
      if (!part) continue
      const pitches = parseChord(part)
      const dur = Math.round(partBeats * 480)

      // Note on for all pitches
      for (let i = 0; i < pitches.length; i++) {
        const midi = pitchToMidi(pitches[i])
        events.push({ delta: i === 0 ? 0 : 0, data: noteOn(channel, midi, 60) })
      }
      // Note off after duration
      for (let i = 0; i < pitches.length; i++) {
        const midi = pitchToMidi(pitches[i])
        events.push({ delta: i === 0 ? dur : 0, data: noteOff(channel, midi) })
      }
    }
  }
  return events
}

export function songToMidi(song: Song): Uint8Array {
  const tpq = 480 // ticks per quarter
  const tracks: number[][] = []

  // Track 0: Tempo track
  const tempoEvents: MidiEvent[] = []
  const usPerBeat = Math.round(60_000_000 / song.tempo)
  tempoEvents.push({
    delta: 0,
    data: [0xff, 0x51, 0x03, (usPerBeat >> 16) & 0xff, (usPerBeat >> 8) & 0xff, usPerBeat & 0xff],
  })
  // Time signature: 4/4
  tempoEvents.push({
    delta: 0,
    data: [0xff, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08],
  })
  tracks.push(buildTrack(tempoEvents, song.title))

  // Track 1: Melody (from sections)
  const melEvents: MidiEvent[] = []
  for (const sec of song.sections) {
    for (const meas of sec.measures) {
      const notes = meas.melNotes || []
      if (notes.length > 0) {
        melEvents.push(...melodyToEvents(notes, 0))
      } else {
        // Empty measure — advance by 4 beats
        melEvents.push({ delta: 480 * 4, data: noteOn(0, 0, 0) })
      }
    }
  }
  if (melEvents.length > 0) tracks.push(buildTrack(melEvents, 'Melody'))

  // Track 2: Chord progression
  const allChords: string[] = []
  for (const sec of song.sections) {
    for (const meas of sec.measures) {
      allChords.push(meas.chord)
    }
  }
  if (allChords.some(c => !!c)) {
    tracks.push(buildTrack(chordsToEvents(allChords, 4, 1), 'Chords'))
  }

  // Accompaniment tracks (if available)
  const accomp = song.accomp as Accomp | null
  if (accomp) {
    const instrChannels: Record<string, number> = { piano: 2, bass: 3, guitar: 4, drums: 9 }
    for (const [instrKey, instr] of Object.entries(accomp)) {
      if (!instr?.sections) continue
      const ch = instrChannels[instrKey] ?? 5
      const instrEvents: MidiEvent[] = []

      for (const sec of instr.sections) {
        for (const meas of sec.measures) {
          if ('pattern' in meas && meas.pattern) {
            // Drum pattern
            const pat = meas.pattern as Record<string, number[]>
            const drumMap: Record<string, number> = { BD: 36, SD: 38, HH: 42, CY: 49 }
            const stepTicks = 480 / 2 // 8th note grid (8 steps per measure)
            for (let step = 0; step < 8; step++) {
              let delta = step === 0 ? 0 : stepTicks
              let first = true
              for (const [drum, row] of Object.entries(pat)) {
                if (row[step]) {
                  const midi = drumMap[drum] || 42
                  instrEvents.push({ delta: first ? delta : 0, data: noteOn(ch, midi, 90) })
                  instrEvents.push({ delta: 60, data: noteOff(ch, midi) })
                  first = false
                }
              }
              if (first) {
                // No hits this step, advance
                instrEvents.push({ delta: delta + stepTicks, data: [] })
              }
            }
          } else {
            // Melodic instrument
            const notes: MelNote[] = []
            if ('rh' in meas && meas.rh) notes.push(...(meas.rh as MelNote[]))
            if ('lh' in meas && meas.lh) notes.push(...(meas.lh as MelNote[]))
            if ('notes' in meas && meas.notes) notes.push(...(meas.notes as MelNote[]))
            if (notes.length > 0) {
              instrEvents.push(...melodyToEvents(notes, ch))
            } else {
              instrEvents.push({ delta: 480 * 4, data: [] })
            }
          }
        }
      }

      if (instrEvents.length > 0) {
        const name = { piano: 'Piano', bass: 'Bass', guitar: 'Guitar', drums: 'Drums' }[instrKey] || instrKey
        tracks.push(buildTrack(instrEvents.filter(e => e.data.length > 0), name))
      }
    }
  }

  // ─── Assemble SMF ─── //
  const header = [
    ...writeStr('MThd'),
    ...write32(6),          // header length
    ...write16(1),          // format 1
    ...write16(tracks.length),
    ...write16(tpq),
  ]

  const totalLen = header.length + tracks.reduce((sum, t) => sum + t.length, 0)
  const buf = new Uint8Array(totalLen)
  let offset = 0
  for (const b of header) buf[offset++] = b
  for (const track of tracks) {
    for (const b of track) buf[offset++] = b
  }

  return buf
}

/** Download MIDI file for a song */
export function downloadMidi(song: Song): void {
  const midi = songToMidi(song)
  const blob = new Blob([midi.buffer as ArrayBuffer], { type: 'audio/midi' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${song.title || '曲帳'}.mid`
  a.click()
  URL.revokeObjectURL(url)
}
