import { useState, useRef, useEffect, useCallback } from 'react'
import { useStore } from '../store'
import { KEYS, CHORD_LIST, QUICK_PROGRESSIONS, NOTE_NAMES, OCTAVES, DURATIONS, DURATION_BEATS, TIME_SIGNATURES, beatsPerMeasure } from '../constants'
import { playChord, playNote, getScaleNotes, playSectionAudio } from '../utils/audio'
import { melodyStaffSVG } from '../utils/staff'
import { gid } from '../utils/id'
import { createPitchDetector, type PitchDetector } from '../utils/pitchDetect'
import { useI18n } from '../i18n'
import MoodGenerator from './MoodGenerator'

/* ─────────────── セクション内 サブエリア切替 ─────────────── */
type Area = 'lyrics' | 'chords' | 'melody'

const AREA_TABS: { id: Area; label: string }[] = [
  { id: 'lyrics', label: 'Lyrics' },
  { id: 'chords', label: 'Chords' },
  { id: 'melody', label: 'Melody' },
]

/* ─────────────── 確認ダイアログ ─────────────── */
function ConfirmDialog({ msg, onOk, onCancel }: { msg: string; onOk: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div className="bg-bg3 border border-border2 rounded-2xl p-5 max-w-[280px] w-full shadow-lg" onClick={e => e.stopPropagation()}>
        <p className="text-text text-sm mb-4 font-sans leading-relaxed">{msg}</p>
        <div className="flex gap-2">
          <button
            className="flex-1 py-2 rounded-lg text-sm border border-border2 text-text2 bg-transparent hover:bg-bg4 font-sans"
            onClick={onCancel}
          >
            キャンセル
          </button>
          <button
            className="flex-1 py-2 rounded-lg text-sm border border-coral text-coral bg-coral/10 hover:bg-coral/20 font-sans font-bold"
            onClick={onOk}
          >
            削除する
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─────────────── SectionCard ─────────────── */
interface SectionCardProps {
  si: number
  songKey: string
  canDelete: boolean
}

function SectionCard({ si, songKey, canDelete }: SectionCardProps) {
  const { currentSong, updateSong, saveOnly, toast } = useStore()
  const { t } = useI18n()
  const song = currentSong()!
  const sec = song.sections[si]

  const [openAreas, setOpenAreas] = useState<Record<Area, boolean>>({ lyrics: true, chords: true, melody: false })
  const [chordPicker, setChordPicker] = useState<number | null>(null)
  const [chordSlot, setChordSlot] = useState<number>(0) // 0=前半, 1=後半
  const [notePicker, setNotePicker] = useState<number | null>(null)
  const [npState, setNpState] = useState({ pitch: 'C4', dur: 'q' })
  const [npInputMode, setNpInputMode] = useState<'buttons' | 'keyboard' | 'mic'>('buttons')
  const pitchDetectorRef = useRef<PitchDetector | null>(null)
  const [micActive, setMicActive] = useState(false)
  const [detectedPitch, setDetectedPitch] = useState<string | null>(null)
  const cpRef = useRef<HTMLDivElement>(null)
  const npRef = useRef<HTMLDivElement>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const [playing, setPlaying] = useState(false)
  const [playingNoteKey, setPlayingNoteKey] = useState<string | null>(null)
  const stopRef = useRef<{ stop: () => void } | null>(null)
  const highlightTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  const scaleNotes = getScaleNotes(songKey)

  const handlePlay = useCallback(async () => {
    if (stopRef.current) {
      stopRef.current.stop(); stopRef.current = null; setPlaying(false); setPlayingNoteKey(null)
      highlightTimers.current.forEach(t => clearTimeout(t)); highlightTimers.current = []
      return
    }
    const hasChords = sec.measures.some(m => !!m.chord)
    const hasMelody = sec.measures.some(m => m.melNotes?.some(n => n.pitch !== 'R'))
    if (!hasChords && !hasMelody) return
    // Ensure AudioContext is resumed (iOS requires user gesture)
    try { const ctx = new AudioContext(); if (ctx.state === 'suspended') await ctx.resume(); ctx.close() } catch {}
    const bpm = beatsPerMeasure(song.timeSig)
    const result = playSectionAudio(sec.measures, song.tempo, bpm)
    stopRef.current = result
    setPlaying(true)

    const beatDur = 60 / song.tempo * 1000
    highlightTimers.current = []
    sec.measures.forEach((m, mi) => {
      const mStart = mi * bpm * beatDur
      ;(m.melNotes || []).forEach((n, ni) => {
        if (n.pitch === 'R') return
        const nStart = mStart + (n.startBeat || 0) * beatDur
        const dur = (DURATION_BEATS[n.duration] || 1) * beatDur
        highlightTimers.current.push(
          setTimeout(() => setPlayingNoteKey(`${mi}-${ni}`), nStart),
          setTimeout(() => setPlayingNoteKey(prev => prev === `${mi}-${ni}` ? null : prev), nStart + dur - 30),
        )
      })
    })

    const totalMs = result.durationMs
    highlightTimers.current.push(
      setTimeout(() => { stopRef.current = null; setPlaying(false); setPlayingNoteKey(null) }, totalMs + 100)
    )
  }, [sec.measures, song.tempo, song.timeSig])

  const autoAssignSyllables = useCallback(() => {
    const lyrics = sec.lyrics || ''
    const SMALL = 'ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮー'
    const syllables: string[] = []
    for (const ch of lyrics) {
      if (ch === '\n' || ch === ' ' || ch === '　') continue
      if (SMALL.includes(ch) && syllables.length > 0) {
        syllables[syllables.length - 1] += ch
      } else {
        syllables.push(ch)
      }
    }
    let si2 = 0
    updateSong(s => {
      for (const m of s.sections[si].measures) {
        for (const n of (m.melNotes || [])) {
          if (n.pitch === 'R') { n.syllable = undefined; continue }
          n.syllable = si2 < syllables.length ? syllables[si2++] : undefined
        }
      }
    })
    toast(`${si2}音にシラブルを割当しました`)
  }, [sec.lyrics, si, updateSong, toast])

  // Close pickers on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (cpRef.current && !cpRef.current.contains(e.target as Node) && !(e.target as HTMLElement).closest('.chord-cell')) {
        setChordPicker(null)
      }
      if (npRef.current && !npRef.current.contains(e.target as Node) && !(e.target as HTMLElement).closest('.add-note-trigger')) {
        setNotePicker(null)
      }
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  // Keep note picker in viewport
  useEffect(() => {
    if (notePicker !== null && npRef.current) {
      requestAnimationFrame(() => {
        const el = npRef.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        if (rect.bottom > window.innerHeight) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
      })
    }
  }, [notePicker])

  const toggleArea = (a: Area) => setOpenAreas(prev => ({ ...prev, [a]: !prev[a] }))

  /** Parse chord string — supports "Am | F" or "Am/F" half-bar split */
  const getChordsInMeasure = (chord: string): string[] => {
    if (!chord) return ['']
    if (chord.includes('|')) return chord.split('|').map(c => c.trim())
    return [chord]
  }

  const setChordAndPlay = (mi: number, c: string, slot: number) => {
    const current = sec.measures[mi].chord || ''
    const parts = getChordsInMeasure(current)
    const newParts = [...parts]
    while (newParts.length <= slot) newParts.push('')
    newParts[slot] = c
    // Trim trailing empty slots, but keep intermediate empties
    while (newParts.length > 1 && !newParts[newParts.length - 1]) newParts.pop()
    const result = newParts.length === 1 ? newParts[0] : newParts.join(' | ')
    updateSong(s => { s.sections[si].measures[mi].chord = result })
    setChordPicker(null)
    if (c) setTimeout(() => playChord(c), 50)
  }

  const maxBeats = beatsPerMeasure(song.timeSig)

  const addNote = (mi: number, pitch: string, dur: string) => {
    const meas = sec.measures[mi]
    let sb = 0
    for (const n of (meas.melNotes || [])) sb += (DURATION_BEATS[n.duration] || 1)
    const adding = DURATION_BEATS[dur] || 1
    if (sb + adding > maxBeats + 0.01) { toast('この小節はいっぱいです'); return }
    updateSong(s => {
      if (!s.sections[si].measures[mi].melNotes) s.sections[si].measures[mi].melNotes = []
      s.sections[si].measures[mi].melNotes.push({ pitch, duration: dur, startBeat: sb })
    })
  }

  const delNote = (mi: number, ni: number) => {
    updateSong(s => {
      s.sections[si].measures[mi].melNotes.splice(ni, 1)
      let sb = 0
      for (const n of s.sections[si].measures[mi].melNotes) { n.startBeat = sb; sb += (DURATION_BEATS[n.duration] || 1) }
    })
  }

  return (
    <div className="bg-bg3 border border-border rounded-2xl mb-3 overflow-hidden">
      {confirmDelete && (
        <ConfirmDialog
          msg={`「${sec.name}」を削除しますか？この操作は元に戻せません。`}
          onOk={() => { updateSong(s => { if (s.sections.length > 1) s.sections.splice(si, 1) }); setConfirmDelete(false) }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
      {/* Section header — row 1: name + play + delete */}
      <div className="px-4 pt-3 pb-1 bg-bg3 border-b border-border">
        <div className="flex items-center gap-2 mb-2">
          <input
            className="bg-transparent border-none text-amber font-bold text-[13px] outline-none font-display flex-1 min-w-0"
            value={sec.name}
            onChange={e => saveOnly(s => { s.sections[si].name = e.target.value })}
          />
          <button
            className={`text-[12px] px-3 py-1.5 rounded-md font-sans border transition-colors
              ${playing
                ? 'bg-teal/15 border-teal text-teal'
                : 'bg-transparent text-text3 border border-border2 hover:border-teal hover:text-teal'}`}
            onClick={handlePlay}
          >
            {playing ? t('compose.stop') : t('compose.play')}
          </button>
          {canDelete && (
            <button
              className="px-2 py-1.5 border border-border2 rounded-md text-text3 cursor-pointer text-[12px] hover:text-coral hover:border-coral bg-transparent font-sans"
              onClick={() => setConfirmDelete(true)}
            >
              ✕
            </button>
          )}
        </div>
        {/* Row 2: area toggles + measure buttons */}
        <div className="flex items-center gap-1.5 pb-2">
          {AREA_TABS.map(a => (
            <button
              key={a.id}
              className={`text-[11px] px-2 py-1 rounded-md font-sans transition-colors
                ${openAreas[a.id]
                  ? 'bg-amber/15 text-amber border border-amber/40'
                  : 'bg-transparent text-text3 border border-border2 hover:text-text2'}`}
              onClick={() => toggleArea(a.id)}
            >
              {a.label}
            </button>
          ))}
          <span className="flex-1" />
          <button
            className="text-[11px] px-2 py-1 border border-border2 rounded-md text-text2 bg-transparent hover:border-amber hover:text-amber font-sans"
            onClick={() => updateSong(s => s.sections[si].measures.push({ id: gid(), chord: '', melNotes: [] }))}
          >
            {t('compose.addMeasure')}
          </button>
          {sec.measures.length > 1 && (
            <button
              className="text-[11px] px-2 py-1 border border-border2 rounded-md text-text3 bg-transparent hover:border-coral hover:text-coral font-sans"
              onClick={() => updateSong(s => { if (s.sections[si].measures.length > 1) s.sections[si].measures.pop() })}
            >
              {t('compose.removeMeasure')}
            </button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* ─── Lyrics area ─── */}
        {openAreas.lyrics && (
          <div>
            <textarea
              className="bg-bg4 border border-border2 rounded-[10px] text-text p-3 text-[15px] leading-[2] resize-none outline-none w-full font-sans min-h-[60px] focus:border-amber"
              placeholder={`${sec.name}${t('compose.lyricsPlaceholder')}`}
              value={sec.lyrics || ''}
              onChange={e => {
                const val = e.target.value
                saveOnly(s => { s.sections[si].lyrics = val })
              }}
            />
          </div>
        )}

        {/* ─── Chords area ─── */}
        {openAreas.chords && (
          <div>
            <div className="flex gap-1.5 flex-wrap mb-2">
              {sec.measures.map((m, mi) => {
                const chords = getChordsInMeasure(m.chord)
                return (
                  <div
                    key={m.id}
                    className={`chord-cell min-w-[58px] h-[44px] rounded-[9px] border cursor-pointer flex items-center justify-center flex-col relative select-none active:scale-95 transition-transform
                      ${m.chord
                        ? 'border-amber bg-amber/[0.08]'
                        : 'border-border2 bg-bg4'}`}
                    onClick={() => {
                      if (m.chord) playChord(chords[0])
                      setChordPicker(mi)
                      setChordSlot(0)
                    }}
                  >
                    <span className="text-[10px] text-text3 absolute top-0.5 left-1.5 font-mono">{mi + 1}</span>
                    {chords.length > 1 ? (
                      <div className="flex gap-0.5">
                        {chords.map((c, ci) => (
                          <span
                            key={ci}
                            className={`text-[10px] font-bold font-mono px-0.5 ${c ? 'text-amber' : 'text-text3'}`}
                            onClick={e => { e.stopPropagation(); setChordPicker(mi); setChordSlot(ci) }}
                          >
                            {c || '-'}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className={`text-xs font-bold font-mono ${m.chord ? 'text-amber' : 'text-text3'}`}>
                        {m.chord || '-'}
                      </span>
                    )}
                    {/* Chord picker — rendered as portal modal below */}
                  </div>
                )
              })}
            </div>
            {/* Quick progressions */}
            <div className="flex gap-1 flex-wrap">
              {QUICK_PROGRESSIONS.map(p => (
                <button
                  key={p.label}
                  className="text-[10px] px-2 py-1 bg-bg4 border border-border2 rounded-full text-text2 cursor-pointer font-sans hover:border-teal hover:text-teal"
                  onClick={() => updateSong(s => {
                    s.sections[si].measures = p.chords.map((c, i) => ({
                      ...s.sections[si].measures[i],
                      id: s.sections[si].measures[i]?.id || gid(),
                      chord: c,
                      melNotes: s.sections[si].measures[i]?.melNotes || [],
                    }))
                  })}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Chord picker modal */}
            {chordPicker !== null && sec.measures[chordPicker] && (
              <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/40" onClick={() => setChordPicker(null)}>
                <div
                  ref={cpRef}
                  className="bg-bg3 border border-border2 rounded-2xl p-4 mx-3 max-w-[340px] w-full shadow-[0_16px_48px_rgba(0,0,0,0.6)] max-h-[85vh] overflow-y-auto"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[12px] font-bold text-amber font-mono">{chordPicker + 1}小節 コード選択</span>
                    <button className="bg-transparent border-none text-text3 cursor-pointer text-lg px-1" onClick={() => setChordPicker(null)}>✕</button>
                  </div>

                  {/* Slot selector — free division */}
                  {(() => {
                    const parts = getChordsInMeasure(sec.measures[chordPicker].chord)
                    const slotCount = Math.max(parts.length, 1)
                    return (
                      <div className="mb-3">
                        <div className="flex gap-1 mb-1.5 flex-wrap">
                          {Array.from({ length: slotCount }, (_, idx) => (
                            <button
                              key={idx}
                              className={`flex-1 min-w-[44px] text-[11px] py-1.5 rounded-lg border font-mono
                                ${chordSlot === idx ? 'bg-amber/15 border-amber text-amber' : 'bg-bg4 border-border2 text-text3'}`}
                              onClick={() => setChordSlot(idx)}
                            >
                              {parts[idx] || '-'}
                            </button>
                          ))}
                          {slotCount < 8 && (
                            <button
                              className="w-8 text-[11px] py-1.5 rounded-lg border border-dashed border-border2 text-text3 font-mono hover:border-amber hover:text-amber"
                              onClick={() => {
                                const cur = sec.measures[chordPicker].chord || ''
                                updateSong(s => { s.sections[si].measures[chordPicker].chord = cur ? cur + ' | ' : '' })
                                setChordSlot(slotCount)
                              }}
                            >
                              +
                            </button>
                          )}
                        </div>
                        <div className="text-[10px] text-text3 font-mono">
                          {slotCount}分割 · 小節内を均等に割り当て
                        </div>
                      </div>
                    )
                  })()}

                  {/* Direct input */}
                  <div className="flex gap-1.5 mb-3">
                    <input
                      className="bg-bg4 border border-border2 rounded-lg text-text px-3 py-2 text-sm outline-none font-sans flex-1 focus:border-amber"
                      placeholder="コードを入力（例: Am7）"
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          const v = (e.target as HTMLInputElement).value.trim()
                          if (v) setChordAndPlay(chordPicker, v, chordSlot)
                        }
                      }}
                    />
                    <button
                      className="px-3 py-2 bg-amber text-bg rounded-lg text-[12px] font-bold cursor-pointer border-none"
                      onClick={() => {
                        const inp = cpRef.current?.querySelector('input') as HTMLInputElement
                        if (inp?.value.trim()) setChordAndPlay(chordPicker, inp.value.trim(), chordSlot)
                      }}
                    >
                      OK
                    </button>
                  </div>

                  {/* Chord grid */}
                  <div className="max-h-[200px] overflow-y-auto mb-3">
                    {CHORD_LIST.map((row, ri) => (
                      <div key={ri} className="flex gap-1 flex-wrap mb-1">
                        {row.map(c => (
                          <button
                            key={c}
                            className={`px-2 py-1.5 rounded text-[11px] cursor-pointer font-mono border
                              ${c === getChordsInMeasure(sec.measures[chordPicker].chord)[chordSlot]
                                ? 'bg-amber/20 border-amber text-amber'
                                : 'bg-bg4 border-border2 text-text2 hover:bg-amber/20 hover:border-amber hover:text-amber'}`}
                            onClick={() => setChordAndPlay(chordPicker, c, chordSlot)}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-1.5 pt-2 border-t border-border2">
                    <button
                      className="flex-1 text-[11px] py-2 border border-border2 rounded-lg text-text2 bg-transparent hover:border-amber hover:text-amber"
                      onClick={() => setChordAndPlay(chordPicker, '', chordSlot)}
                    >
                      クリア
                    </button>
                    <button
                      className="flex-1 text-[11px] py-2 border border-coral rounded-lg text-coral bg-transparent hover:bg-coral/10"
                      onClick={() => {
                        updateSong(s => { if (s.sections[si].measures.length > 1) s.sections[si].measures.splice(chordPicker, 1) })
                        setChordPicker(null)
                      }}
                    >
                      小節削除
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── Melody area ─── */}
        {openAreas.melody && (
          <div>
            {/* Staff SVG */}
            <div className="mb-2 overflow-x-auto">
              <div className="staff-block" dangerouslySetInnerHTML={{ __html: melodyStaffSVG(sec.measures, '#333', song.timeSig) }} />
            </div>

            {/* Syllable auto-assign */}
            {sec.lyrics && sec.measures.some(m => m.melNotes?.length) && (
              <div className="flex gap-2 items-center mb-2">
                <button
                  className="text-[10px] px-2.5 py-1 border border-border2 rounded-lg text-text2 bg-transparent hover:border-amber hover:text-amber font-sans"
                  onClick={autoAssignSyllables}
                >
                  歌詞をメロディに割当
                </button>
                <span className="text-[11px] text-text3">歌詞の各文字を音符に自動マッピング</span>
              </div>
            )}

            {/* Note list per measure */}
            <div className="flex gap-2 flex-wrap mb-2">
              {sec.measures.map((m, mi) => (
                <div key={m.id} className="bg-bg4 border border-border2 rounded-lg p-2 min-w-[85px]">
                  <div className="text-[10px] font-bold text-amber font-mono mb-1">
                    {mi + 1}小節 {m.chord ? `(${m.chord})` : ''}
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {(m.melNotes || []).map((n, ni) => {
                      const noteKey = `${mi}-${ni}`
                      const isHighlighted = playingNoteKey === noteKey
                      return (
                        <div key={ni} className="flex flex-col items-center gap-0.5">
                          <div
                            className={`px-2 py-1.5 rounded-lg text-[11px] font-mono cursor-pointer flex items-center gap-0.5 transition-all duration-100
                              ${isHighlighted
                                ? 'border-amber text-amber bg-amber/25 border-2 scale-110 shadow-[0_0_8px_rgba(232,160,32,0.4)]'
                                : n.pitch === 'R'
                                  ? 'border-text3/30 text-text3 bg-bg4 border'
                                  : 'border-text2/30 text-text bg-bg4 border'}`}
                            onClick={() => n.pitch !== 'R' && playNote(n.pitch)}
                          >
                            <span>{n.pitch === 'R' ? '休' : n.pitch}</span>
                            <span className={`text-[10px] ${isHighlighted ? 'text-amber/60' : 'text-text3'}`}>
                              {DURATIONS.find(d => d.value === n.duration)?.label?.slice(0, 2) || n.duration}
                            </span>
                            <span
                              className="text-[11px] text-text3/50 hover:text-coral"
                              onClick={e => { e.stopPropagation(); delNote(mi, ni) }}
                            >
                              x
                            </span>
                          </div>
                          <span
                            className={`text-[11px] font-sans transition-colors cursor-pointer min-w-[16px] text-center
                              ${isHighlighted ? 'text-amber font-bold' : n.syllable ? 'text-purple' : 'text-text3/30'}`}
                            onClick={e => {
                              e.stopPropagation()
                              const current = n.syllable || ''
                              const el = e.currentTarget
                              el.contentEditable = 'true'
                              el.textContent = current
                              el.focus()
                              // Select all text
                              const range = document.createRange()
                              range.selectNodeContents(el)
                              window.getSelection()?.removeAllRanges()
                              window.getSelection()?.addRange(range)
                              const save = () => {
                                const val = el.textContent?.trim() || ''
                                el.contentEditable = 'false'
                                updateSong(s => {
                                  const note = s.sections[si].measures[mi].melNotes[ni]
                                  if (note) note.syllable = val || undefined
                                })
                              }
                              el.onblur = save
                              el.onkeydown = (ev: KeyboardEvent) => {
                                if (ev.key === 'Enter') { ev.preventDefault(); el.blur() }
                              }
                            }}
                          >
                            {n.syllable || (n.pitch !== 'R' ? '·' : '')}
                          </span>
                        </div>
                      )
                    })}
                    <button
                      className="add-note-trigger px-1.5 py-0.5 rounded bg-transparent border border-dashed border-border2 text-text3 text-[10px] cursor-pointer font-mono hover:border-teal hover:text-teal"
                      onClick={() => setNotePicker(mi)}
                    >
                      + 音
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Note picker — center modal overlay */}
            {notePicker !== null && (
              <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/40" onClick={() => { setNotePicker(null); pitchDetectorRef.current?.stop(); setMicActive(false); setDetectedPitch(null) }}>
                <div
                  ref={npRef}
                  className="bg-bg3 border border-border2 rounded-2xl p-4 mx-3 max-w-[380px] w-full shadow-[0_16px_48px_rgba(0,0,0,0.6)] max-h-[85vh] overflow-y-auto"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[12px] font-bold text-text font-mono">
                      {notePicker + 1}小節に追加
                    </span>
                    {/* Input mode toggle */}
                    <div className="flex gap-1">
                      {(['buttons', 'keyboard', 'mic'] as const).map(mode => (
                        <button
                          key={mode}
                          className={`text-[10px] px-2 py-1 rounded border font-mono
                            ${npInputMode === mode ? 'bg-amber/15 border-amber text-amber' : 'bg-bg4 border-border2 text-text3'}`}
                          onClick={() => {
                            setNpInputMode(mode)
                            // Stop mic when switching away
                            if (mode !== 'mic' && pitchDetectorRef.current) {
                              pitchDetectorRef.current.stop()
                              setMicActive(false)
                              setDetectedPitch(null)
                            }
                          }}
                        >
                          {mode === 'buttons' ? 'ボタン' : mode === 'keyboard' ? '鍵盤' : 'マイク'}
                        </button>
                      ))}
                    </div>
                    <button className="bg-transparent border-none text-text3 cursor-pointer text-lg px-1" onClick={() => { setNotePicker(null); pitchDetectorRef.current?.stop(); setMicActive(false); setDetectedPitch(null) }}>✕</button>
                  </div>

                  {/* Duration + Octave row */}
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-[10px] text-text2 font-mono w-9 shrink-0">音価</span>
                    <div className="flex gap-1 flex-wrap flex-1">
                      {DURATIONS.map(d => (
                        <button
                          key={d.value}
                          className={`px-1.5 py-1 rounded text-[10px] cursor-pointer font-mono border
                            ${npState.dur === d.value
                              ? 'bg-amber/15 border-amber text-amber'
                              : 'bg-bg4 border-border2 text-text2 hover:bg-amber/15 hover:border-amber hover:text-amber'}`}
                          onClick={() => setNpState(s => ({ ...s, dur: d.value }))}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mb-3">
                    <span className="text-[10px] text-text2 font-mono w-9 shrink-0">Oct</span>
                    <div className="flex gap-1">
                      {OCTAVES.map(o => (
                        <button
                          key={o}
                          className={`px-2.5 py-1 rounded text-[11px] cursor-pointer font-mono border
                            ${npState.pitch.slice(-1) === String(o)
                              ? 'bg-amber/15 border-amber text-amber'
                              : 'bg-bg4 border-border2 text-text2 hover:bg-amber/15 hover:border-amber hover:text-amber'}`}
                          onClick={() => {
                            const root = npState.pitch.replace(/\d/, '')
                            setNpState(s => ({ ...s, pitch: root + o }))
                          }}
                        >
                          {o}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Button mode */}
                  {npInputMode === 'buttons' && (
                    <div>
                      <div className="flex gap-1 flex-wrap mb-2">
                        {NOTE_NAMES.map(n => {
                          const isScale = scaleNotes.includes(n)
                          return (
                            <button
                              key={n}
                              className={`px-2.5 py-2 rounded text-[12px] cursor-pointer font-mono border
                                ${isScale ? 'bg-amber/10 border-amber/50' : 'bg-bg4 border-border2'}
                                ${n.includes('#') ? 'text-text3 text-[10px]' : 'text-text2'}
                                hover:bg-amber/15 hover:border-amber hover:text-amber active:scale-95`}
                              onClick={() => {
                                const oct = npState.pitch.slice(-1)
                                const pitch = n + oct
                                setNpState(s => ({ ...s, pitch }))
                                playNote(pitch)
                                addNote(notePicker, pitch, npState.dur)
                              }}
                            >
                              {n}
                            </button>
                          )
                        })}
                        <button
                          className="px-2.5 py-2 rounded text-[12px] cursor-pointer font-mono border border-text3/30 text-text3 hover:bg-text3/10 active:scale-95"
                          onClick={() => addNote(notePicker, 'R', npState.dur)}
                        >
                          休
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Keyboard mode */}
                  {npInputMode === 'keyboard' && (
                    <div>
                      <div className="text-[11px] text-text3 font-mono mb-1.5 flex items-center gap-2">
                        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-teal/30 border border-teal/60" /> スケール音</span>
                        <span className="text-text3/60">Key: {songKey}</span>
                      </div>
                      <div className="relative h-[140px] mb-2 select-none rounded-b-lg overflow-hidden">
                        {/* White keys */}
                        <div className="flex h-full gap-[1px] bg-[#999]">
                          {['C', 'D', 'E', 'F', 'G', 'A', 'B'].map(n => {
                            const isScale = scaleNotes.includes(n)
                            return (
                              <button
                                key={n}
                                className={`flex-1 rounded-b-md flex flex-col items-center justify-end pb-2 font-mono transition-colors duration-50
                                  ${isScale
                                    ? 'bg-[#e0fff0] text-teal active:bg-teal/50'
                                    : 'bg-white text-[#999] active:bg-[#ccc]'}`}
                                onClick={() => {
                                  const oct = npState.pitch.slice(-1)
                                  const pitch = n + oct
                                  setNpState(s => ({ ...s, pitch }))
                                  playNote(pitch)
                                  addNote(notePicker, pitch, npState.dur)
                                }}
                              >
                                <span className="text-[13px] font-bold">{n}</span>
                              </button>
                            )
                          })}
                        </div>
                        {/* Black keys */}
                        <div className="absolute top-0 left-0 right-0 h-[60%] pointer-events-none">
                          {[
                            { note: 'C#', left: '10%' },
                            { note: 'D#', left: '24%' },
                            { note: 'F#', left: '52.5%' },
                            { note: 'G#', left: '66.5%' },
                            { note: 'A#', left: '80.5%' },
                          ].map(({ note, left }) => {
                            const isScale = scaleNotes.includes(note)
                            return (
                              <button
                                key={note}
                                className={`absolute w-[11%] h-full rounded-b-md shadow-[1px_2px_4px_rgba(0,0,0,0.5)] text-[10px] font-mono flex items-end justify-center pb-1.5 pointer-events-auto transition-colors duration-50
                                  ${isScale
                                    ? 'bg-[#1a4a3a] text-teal/90 active:bg-teal/60'
                                    : 'bg-[#222] text-white/40 active:bg-[#555]'}`}
                                style={{ left }}
                                onClick={() => {
                                  const oct = npState.pitch.slice(-1)
                                  const pitch = note + oct
                                  setNpState(s => ({ ...s, pitch }))
                                  playNote(pitch)
                                  addNote(notePicker, pitch, npState.dur)
                                }}
                              >
                                {note}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Mic mode — pitch detection */}
                  {npInputMode === 'mic' && (
                    <div className="text-center py-4">
                      <div className="mb-3">
                        {detectedPitch ? (
                          <div className="text-3xl font-mono font-bold text-amber animate-pulse">{detectedPitch}</div>
                        ) : (
                          <div className="text-lg text-text3 font-mono">{micActive ? '歌ってください...' : 'マイクを開始してください'}</div>
                        )}
                      </div>
                      <div className="flex gap-2 justify-center mb-3">
                        <button
                          className={`px-4 py-2.5 rounded-lg text-sm font-sans font-bold transition-colors
                            ${micActive
                              ? 'bg-coral/15 border border-coral text-coral'
                              : 'bg-teal/15 border border-teal text-teal'}`}
                          onClick={async () => {
                            if (micActive) {
                              pitchDetectorRef.current?.stop()
                              setMicActive(false)
                              setDetectedPitch(null)
                            } else {
                              const detector = createPitchDetector((pitch) => {
                                setDetectedPitch(pitch)
                                playNote(pitch)
                              })
                              pitchDetectorRef.current = detector
                              try {
                                await detector.start()
                                setMicActive(true)
                              } catch {
                                toast('マイクへのアクセスが許可されていません')
                              }
                            }
                          }}
                        >
                          {micActive ? '停止' : 'マイク開始'}
                        </button>
                        {detectedPitch && (
                          <button
                            className="px-4 py-2.5 rounded-lg text-sm font-sans font-bold bg-amber text-bg"
                            onClick={() => {
                              if (notePicker !== null && detectedPitch) {
                                addNote(notePicker, detectedPitch, npState.dur)
                              }
                            }}
                          >
                            {detectedPitch} を入力
                          </button>
                        )}
                      </div>
                      <div className="text-[11px] text-text3 font-sans leading-relaxed">
                        音を歌うかハミングすると音高を検出します。<br/>
                        検出された音名が表示されたら「入力」ボタンで追加できます。
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="text-[10px] text-text3 font-mono">
                      <span className="text-amber">*</span> Key: {songKey} スケール音
                    </div>
                    <button
                      className="text-[10px] px-2 py-1 rounded border border-text3/30 text-text3 font-mono hover:bg-text3/10"
                      onClick={() => addNote(notePicker, 'R', npState.dur)}
                    >
                      + 休符
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────── ComposeTab (main) ─────────────── */
export default function ComposeTab() {
  const { currentSong, updateSong, saveOnly } = useStore()
  const song = currentSong()
  const [playingAll, setPlayingAll] = useState(false)
  const allStopRef = useRef<{ stop: () => void } | null>(null)

  const handlePlayAll = useCallback(() => {
    if (allStopRef.current) {
      allStopRef.current.stop(); allStopRef.current = null; setPlayingAll(false)
      return
    }
    if (!song) return
    // Concatenate all sections' measures
    const allMeasures = song.sections.flatMap(s => s.measures)
    if (!allMeasures.some(m => m.chord || m.melNotes?.length)) return
    const bpm = beatsPerMeasure(song.timeSig)
    const result = playSectionAudio(allMeasures, song.tempo, bpm)
    allStopRef.current = result
    setPlayingAll(true)
    setTimeout(() => { allStopRef.current = null; setPlayingAll(false) }, result.durationMs + 100)
  }, [song])
  const { t: t2 } = useI18n()
  if (!song) return null

  return (
    <div className="animate-fi">
      {/* Key / BPM */}
      <div className="flex gap-2.5 flex-wrap mb-3.5 items-end">
        <div>
          <label className="text-[10px] text-text2 font-bold block mb-1 font-mono tracking-wider">KEY</label>
          <select
            className="bg-bg4 border border-border2 rounded-lg text-text px-2.5 py-1.5 text-sm outline-none font-sans focus:border-amber"
            value={song.key}
            onChange={e => updateSong(s => { s.key = e.target.value })}
          >
            {KEYS.map(k => <option key={k}>{k}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-text2 font-bold block mb-1 font-mono tracking-wider">BPM</label>
          <input
            type="text"
            inputMode="numeric"
            className="bg-bg4 border border-border2 rounded-lg text-text px-2.5 py-1.5 text-sm outline-none font-sans w-[72px] focus:border-amber"
            defaultValue={song.tempo}
            key={song.id}
            onBlur={e => {
              const v = parseInt(e.target.value)
              const clamped = isNaN(v) ? 120 : Math.max(20, Math.min(300, v))
              e.target.value = String(clamped)
              updateSong(s => { s.tempo = clamped })
            }}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          />
        </div>
        <div>
          <label className="text-[10px] text-text2 font-bold block mb-1 font-mono tracking-wider">拍子</label>
          <select
            className="bg-bg4 border border-border2 rounded-lg text-text px-2.5 py-1.5 text-sm outline-none font-sans focus:border-amber"
            value={song.timeSig ? `${song.timeSig.beats}/${song.timeSig.value}` : '4/4'}
            onChange={e => {
              if (e.target.value === 'custom') {
                const input = prompt('拍子を入力（例: 5/4, 7/8, 11/8）')
                if (input) {
                  const m = input.match(/^(\d+)\/(\d+)$/)
                  if (m) updateSong(s => { s.timeSig = { beats: parseInt(m[1]), value: parseInt(m[2]) } })
                }
                return
              }
              const ts = TIME_SIGNATURES.find(t => t.label === e.target.value)
              if (ts) updateSong(s => { s.timeSig = { beats: ts.beats, value: ts.value } })
            }}
          >
            {TIME_SIGNATURES.map(ts => (
              <option key={ts.label} value={ts.label}>{ts.label}</option>
            ))}
            <option value="custom">カスタム...</option>
          </select>
        </div>
        <button
          className={`text-[11px] px-3 py-1.5 rounded-lg font-sans ml-auto border transition-colors
            ${playingAll
              ? 'bg-teal/15 border-teal text-teal'
              : 'border-border2 text-text2 bg-transparent hover:border-teal hover:text-teal'}`}
          onClick={handlePlayAll}
        >
          {playingAll ? t2('compose.stop') : t2('compose.play')}
        </button>
        <button
          className="text-[11px] px-3 py-1.5 border border-border2 rounded-lg text-text2 bg-transparent hover:border-amber hover:text-amber font-sans"
          onClick={() => updateSong(s => s.sections.push({
            id: gid(), name: '新セクション', lyrics: '',
            measures: Array(4).fill(0).map(() => ({ id: gid(), chord: '', melNotes: [] })),
          }))}
        >
          {t2('compose.addSection')}
        </button>
      </div>

      {/* Mood-based generator */}
      <MoodGenerator />

      {/* Section cards */}
      {song.sections.map((sec, si) => (
        <SectionCard key={sec.id} si={si} songKey={song.key} canDelete={song.sections.length > 1} />
      ))}

      {/* Memos */}
      <div className="mt-2 space-y-2.5">
        <div>
          <label className="text-[10px] text-text2 font-bold block mb-1 font-mono tracking-wider">{t2('compose.lyricsMemo')}</label>
          <textarea
            className="bg-bg4 border border-border2 rounded-[10px] text-text p-3 text-base leading-[2] resize-none outline-none w-full font-sans min-h-[80px] focus:border-amber"
            placeholder={t2('compose.lyricsMemoPlaceholder')}
            value={song.lyrics}
            onChange={e => saveOnly(s => { s.lyrics = e.target.value })}
          />
        </div>
        <div>
          <label className="text-[10px] text-text2 font-bold block mb-1 font-mono tracking-wider">{t2('compose.memo')}</label>
          <textarea
            className="bg-bg4 border border-border2 rounded-[10px] text-text p-3 text-base leading-[2] resize-none outline-none w-full font-sans min-h-[55px] focus:border-amber"
            placeholder={t2('compose.memoPlaceholder')}
            value={song.memo}
            onChange={e => saveOnly(s => { s.memo = e.target.value })}
          />
        </div>
      </div>
    </div>
  )
}
