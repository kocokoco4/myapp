/**
 * BeginnerCompose — 初心者向けウィザード型制作画面
 * ステップバイステップで歌詞→雰囲気→メロディ→完成を案内
 */
import { useState, useRef, useCallback } from 'react'
import { useStore } from '../store'
import { QUICK_PROGRESSIONS, NOTE_NAMES, OCTAVES, DURATIONS, DURATION_BEATS } from '../constants'
import { playChord, playNote, playSectionAudio } from '../utils/audio'
import { createPitchDetector, type PitchDetector } from '../utils/pitchDetect'
import { MOOD_CATEGORIES, generateTemplate, type MoodSelection, type MoodCategory } from '../utils/moodTemplates'
import { downloadMidi } from '../utils/midi'
import { gid } from '../utils/id'
import FinchAvatar from './FinchAvatar'

const CAT_KEYS: MoodCategory[] = ['emotion', 'scene', 'energy', 'relation']

export default function BeginnerCompose() {
  const { currentSong, updateSong, toast } = useStore()
  const song = currentSong()
  if (!song) return null

  return (
    <div className="animate-fi space-y-5 pb-8">
      {/* Progress indicator */}
      <div className="flex items-center gap-2 px-2">
        {['歌詞', '雰囲気', 'コード', 'メロディ', '完成'].map((step, i) => {
          const done = i === 0 ? !!song.sections[0]?.lyrics
            : i === 1 ? song.sections.length > 1
            : i === 2 ? song.sections[0]?.measures.some((m: { chord: string }) => m.chord)
            : i === 3 ? song.sections[0]?.measures.some((m: { melNotes: unknown[] }) => m.melNotes?.length)
            : false
          return (
            <div key={i} className="flex-1 text-center">
              <div className={`h-1.5 rounded-full mb-1 transition-colors ${done ? 'bg-amber' : 'bg-border2'}`} />
              <span className={`text-[10px] font-sans ${done ? 'text-amber font-bold' : 'text-text3'}`}>{step}</span>
            </div>
          )
        })}
      </div>

      {/* Step 1: 歌詞 */}
      <StepCard
        finchMood="wave"
        title="まず歌詞を書こう"
        subtitle="思いつくフレーズを自由に書いてみよう"
      >
        <textarea
          className="bg-bg4 border border-border2 rounded-2xl text-text p-4 text-[15px] leading-[2] resize-none outline-none w-full font-sans min-h-[100px] focus:border-amber shadow-inner"
          placeholder="歌詞やフレーズを入力..."
          value={song.sections[0]?.lyrics || ''}
          onChange={e => updateSong(s => { if (s.sections[0]) s.sections[0].lyrics = e.target.value })}
        />
      </StepCard>

      {/* Step 2: 雰囲気 */}
      <MoodStep song={song} updateSong={updateSong} toast={toast} />

      {/* Step 3: コード */}
      <StepCard
        finchMood="default"
        title="コードを選ぼう"
        subtitle="ボタンを押すとコード進行がセットされます"
      >
        <div className="flex gap-2 flex-wrap">
          {QUICK_PROGRESSIONS.map(p => (
            <button
              key={p.label}
              className="text-[13px] px-4 py-2.5 bg-bg4 border border-border2 rounded-2xl text-text2 cursor-pointer font-sans hover:border-amber hover:text-amber hover:shadow-md active:scale-95 transition-all"
              onClick={() => {
                updateSong(s => {
                  s.sections[0].measures = p.chords.map((c, i) => ({
                    ...s.sections[0].measures[i],
                    id: s.sections[0].measures[i]?.id || gid(),
                    chord: c,
                    melNotes: s.sections[0].measures[i]?.melNotes || [],
                  }))
                })
                playChord(p.chords[0])
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        {song.sections[0]?.measures.some(m => m.chord) && (
          <div className="flex gap-1.5 flex-wrap mt-3">
            {song.sections[0].measures.map((m, i) => (
              <span key={i} className={`text-[13px] px-2.5 py-1 rounded-lg font-mono ${m.chord ? 'bg-amber/10 border border-amber/30 text-amber' : 'text-text3'}`}>
                {m.chord || '-'}
              </span>
            ))}
          </div>
        )}
      </StepCard>

      {/* Step 4: メロディ */}
      <MelodyStep song={song} updateSong={updateSong} toast={toast} />

      {/* Step 5: 完成 */}
      <StepCard
        finchMood="happy"
        title="できた！聴いてみよう"
        subtitle="再生して確認。MIDIでGarageBandに持っていけます"
      >
        <CompleteSection song={song} toast={toast} />
      </StepCard>
    </div>
  )
}

/* ─── Step Card ─── */
function StepCard({ finchMood, title, subtitle, children }: {
  finchMood: 'default' | 'happy' | 'thinking' | 'wave'
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-bg3 border border-border rounded-3xl overflow-hidden shadow-[0_4px_20px_rgba(100,160,200,0.08)]">
      <div className="flex items-center gap-3 px-5 py-4">
        <div className="animate-float"><FinchAvatar size={36} mood={finchMood} /></div>
        <div>
          <div className="text-[16px] font-bold text-text font-sans">{title}</div>
          <div className="text-[12px] text-text3 font-sans">{subtitle}</div>
        </div>
      </div>
      <div className="px-5 pb-5">
        {children}
      </div>
    </div>
  )
}

/* ─── Mood Step ─── */
function MoodStep({ updateSong, toast }: { song: any; updateSong: any; toast: any }) {
  const [mood, setMood] = useState<Partial<MoodSelection>>({})
  const allSelected = CAT_KEYS.every(k => mood[k])

  const handleGenerate = () => {
    if (!allSelected) return
    const sel = mood as MoodSelection
    const tmpl = generateTemplate(sel)
    updateSong((s: any) => {
      s.key = tmpl.key
      s.tempo = tmpl.bpm
      s.sections = tmpl.sections.map((sec: any) => ({
        id: gid(),
        name: sec.name,
        lyrics: s.sections[0]?.lyrics || '',
        measures: sec.chords.map((c: string) => ({ id: gid(), chord: c, melNotes: [] })),
      }))
    })
    toast('雰囲気に合わせてコード進行を生成しました')
  }

  return (
    <StepCard
      finchMood="thinking"
      title="雰囲気を選ぼう"
      subtitle="4つ選ぶとコード進行が自動で作られます"
    >
      <div className="grid grid-cols-2 gap-2 mb-3">
        {CAT_KEYS.map(cat => (
          <div key={cat}>
            <label className="text-[11px] text-text2 font-sans mb-1 block">{MOOD_CATEGORIES[cat].label}</label>
            <select
              className="w-full bg-bg4 border border-border2 rounded-2xl text-text px-3 py-2.5 text-[14px] outline-none font-sans focus:border-amber"
              value={mood[cat] || ''}
              onChange={e => setMood(prev => ({ ...prev, [cat]: e.target.value }))}
            >
              <option value="">選択...</option>
              {MOOD_CATEGORIES[cat].options.map(o => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
      {allSelected && (
        <button
          className="w-full py-3.5 rounded-2xl text-[15px] font-bold font-sans bg-amber text-bg hover:bg-amber2 active:scale-[0.97] transition-all shadow-md"
          onClick={handleGenerate}
        >
          この雰囲気で作る
        </button>
      )}
    </StepCard>
  )
}

/* ─── Melody Step (keyboard + mic only) ─── */
function MelodyStep({ song, updateSong, toast }: { song: any; updateSong: any; toast: any }) {
  const [mode, setMode] = useState<'keyboard' | 'mic'>('keyboard')
  const [octave, setOctave] = useState(4)
  const [dur, setDur] = useState('q')
  const [micActive, setMicActive] = useState(false)
  const [detectedPitch, setDetectedPitch] = useState<string | null>(null)
  const detectorRef = useRef<PitchDetector | null>(null)

  const scaleNotes = (() => {
    const MAJOR = [0, 2, 4, 5, 7, 9, 11]
    const ri = NOTE_NAMES.indexOf(song.key)
    if (ri < 0) return NOTE_NAMES
    return MAJOR.map(i => NOTE_NAMES[(ri + i) % 12])
  })()

  const addNote = useCallback((pitch: string) => {
    updateSong((s: any) => {
      const sec = s.sections[0]
      if (!sec) return
      // Find first measure with space
      for (const m of sec.measures) {
        let sb = 0
        for (const n of (m.melNotes || [])) sb += (DURATION_BEATS[n.duration] || 1)
        if (sb + (DURATION_BEATS[dur] || 1) <= 4.01) {
          if (!m.melNotes) m.melNotes = []
          m.melNotes.push({ pitch, duration: dur, startBeat: sb })
          return
        }
      }
      toast('小節がいっぱいです。コード進行を先に設定してください')
    })
  }, [dur, updateSong, toast])

  return (
    <StepCard
      finchMood="default"
      title="メロディをつけよう"
      subtitle="鍵盤を弾くか、鼻歌を歌ってみよう"
    >
      {/* Mode toggle */}
      <div className="flex gap-2 mb-3">
        {([['keyboard', '鍵盤'], ['mic', '鼻歌']] as const).map(([m, label]) => (
          <button
            key={m}
            className={`text-[12px] px-4 py-2 rounded-lg font-sans border transition-colors
              ${mode === m ? 'bg-amber/15 border-amber text-amber font-bold' : 'bg-transparent border-border2 text-text3'}`}
            onClick={() => setMode(m)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Duration */}
      <div className="flex gap-1 flex-wrap mb-3">
        {DURATIONS.filter(d => ['q', '8', 'h'].includes(d.value)).map(d => (
          <button
            key={d.value}
            className={`px-2 py-1.5 rounded text-[11px] font-mono border
              ${dur === d.value ? 'bg-amber/15 border-amber text-amber' : 'bg-bg4 border-border2 text-text3'}`}
            onClick={() => setDur(d.value)}
          >
            {d.label}
          </button>
        ))}
        <button
          className="px-2 py-1.5 rounded text-[11px] font-mono border border-text3/30 text-text3 hover:bg-text3/10"
          onClick={() => addNote('R')}
        >
          休符
        </button>
      </div>

      {/* Octave */}
      <div className="flex gap-1 mb-3 items-center">
        <span className="text-[11px] text-text3 font-mono mr-1">Oct</span>
        {OCTAVES.map(o => (
          <button
            key={o}
            className={`px-2.5 py-1.5 rounded text-[12px] font-mono border
              ${octave === o ? 'bg-amber/15 border-amber text-amber' : 'bg-bg4 border-border2 text-text3'}`}
            onClick={() => setOctave(o)}
          >
            {o}
          </button>
        ))}
      </div>

      {/* Keyboard */}
      {mode === 'keyboard' && (
        <div className="relative h-[140px] select-none rounded-b-lg overflow-hidden">
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
                  onClick={() => { const p = n + octave; playNote(p); addNote(p) }}
                >
                  <span className="text-[14px] font-bold">{n}</span>
                </button>
              )
            })}
          </div>
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
                  onClick={() => { const p = note + octave; playNote(p); addNote(p) }}
                >
                  {note}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Mic */}
      {mode === 'mic' && (
        <div className="text-center py-4">
          {detectedPitch ? (
            <div className="text-3xl font-mono font-bold text-amber animate-pulse mb-3">{detectedPitch}</div>
          ) : (
            <div className="text-[14px] text-text3 font-sans mb-3">{micActive ? '歌ってください...' : 'マイクを開始してください'}</div>
          )}
          <div className="flex gap-2 justify-center">
            <button
              className={`px-5 py-2.5 rounded-xl text-[13px] font-sans font-bold border transition-colors
                ${micActive ? 'bg-coral/15 border-coral text-coral' : 'bg-teal/15 border-teal text-teal'}`}
              onClick={async () => {
                if (micActive) {
                  detectorRef.current?.stop()
                  setMicActive(false)
                  setDetectedPitch(null)
                } else {
                  const detector = createPitchDetector((pitch) => {
                    setDetectedPitch(pitch)
                    playNote(pitch)
                  })
                  detectorRef.current = detector
                  try { await detector.start(); setMicActive(true) } catch { toast('マイクへのアクセスが許可されていません') }
                }
              }}
            >
              {micActive ? '停止' : 'マイク開始'}
            </button>
            {detectedPitch && (
              <button
                className="px-5 py-2.5 rounded-xl text-[13px] font-sans font-bold bg-amber text-bg"
                onClick={() => { if (detectedPitch) addNote(detectedPitch) }}
              >
                {detectedPitch} を入力
              </button>
            )}
          </div>
        </div>
      )}
    </StepCard>
  )
}

/* ─── Complete Section ─── */
function CompleteSection({ song, toast }: { song: any; toast: any }) {
  const [playing, setPlaying] = useState(false)
  const stopRef = useRef<{ stop: () => void } | null>(null)

  const handlePlay = useCallback(async () => {
    if (stopRef.current) {
      stopRef.current.stop(); stopRef.current = null; setPlaying(false)
      return
    }
    try { const ctx = new AudioContext(); if (ctx.state === 'suspended') await ctx.resume(); ctx.close() } catch {}
    const allMeasures = song.sections.flatMap((s: any) => s.measures)
    const result = playSectionAudio(allMeasures, song.tempo)
    stopRef.current = result
    setPlaying(true)
    setTimeout(() => { stopRef.current = null; setPlaying(false) }, result.durationMs + 100)
  }, [song])

  return (
    <div className="flex gap-3 flex-wrap">
      <button
        className={`px-6 py-3.5 rounded-2xl text-[15px] font-sans font-bold border transition-all shadow-md active:scale-[0.97]
          ${playing ? 'bg-teal/15 border-teal text-teal' : 'bg-teal text-white border-teal'}`}
        onClick={handlePlay}
      >
        {playing ? '停止' : '再生してみよう'}
      </button>
      <button
        className="px-6 py-3.5 rounded-2xl text-[15px] font-sans font-bold bg-amber text-white shadow-md active:scale-[0.97] transition-all"
        onClick={() => { downloadMidi(song); toast('MIDIをダウンロード。GarageBandで開いてね') }}
      >
        GarageBandへ
      </button>
    </div>
  )
}
