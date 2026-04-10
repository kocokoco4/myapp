/**
 * BeginnerCompose — 初心者向け「ブドウの房」型制作画面
 * 大きな円ボタン5つ（歌詞・コード・メロディ・伴奏・辞典）
 * 各円をタップ→展開→入力→閉じる
 * 下に再生・GarageBandボタン
 */
import { useState, useRef, useCallback } from 'react'
import { useStore } from '../store'
import { QUICK_PROGRESSIONS, NOTE_NAMES, DURATION_BEATS } from '../constants'
import { playChord, playNote, playSectionAudio } from '../utils/audio'
import { createPitchDetector, type PitchDetector } from '../utils/pitchDetect'
import { MOOD_CATEGORIES, generateTemplate, type MoodSelection, type MoodCategory } from '../utils/moodTemplates'
import { downloadMidi } from '../utils/midi'
import { gid } from '../utils/id'
import FinchAvatar from './FinchAvatar'

const CAT_KEYS: MoodCategory[] = ['emotion', 'scene', 'energy', 'relation']

type BubbleId = 'lyrics' | 'chords' | 'melody' | 'mood' | 'dict'

const BUBBLES: { id: BubbleId; label: string; color: string; desc: string }[] = [
  { id: 'lyrics', label: '歌詞', color: '#50b0e0', desc: '歌いたい言葉を書こう' },
  { id: 'mood', label: '雰囲気', color: '#e0a050', desc: '気分で曲の骨格を作る' },
  { id: 'chords', label: 'コード', color: '#50c878', desc: 'ボタンひとつでコード進行' },
  { id: 'melody', label: 'メロディ', color: '#e080a0', desc: '鍵盤か鼻歌で音を入れる' },
  { id: 'dict', label: '学ぶ', color: '#9090cc', desc: '音楽の基礎を知ろう' },
]

export default function BeginnerCompose() {
  const { currentSong, updateSong, toast } = useStore()
  const song = currentSong()
  const [openBubble, setOpenBubble] = useState<BubbleId | null>(null)
  const [playing, setPlaying] = useState(false)
  const stopRef = useRef<{ stop: () => void } | null>(null)

  if (!song) return null

  const handlePlay = useCallback(async () => {
    if (stopRef.current) {
      stopRef.current.stop(); stopRef.current = null; setPlaying(false)
      return
    }
    try { const ctx = new AudioContext(); if (ctx.state === 'suspended') await ctx.resume(); ctx.close() } catch {}
    const allMeasures = song.sections.flatMap(s => s.measures)
    if (!allMeasures.some(m => m.chord || m.melNotes?.length)) return
    const result = playSectionAudio(allMeasures, song.tempo)
    stopRef.current = result
    setPlaying(true)
    setTimeout(() => { stopRef.current = null; setPlaying(false) }, result.durationMs + 100)
  }, [song])

  return (
    <div className="animate-fi pb-8">
      {/* Finch greeting */}
      <div className="text-center mb-6">
        <div className="animate-float inline-block"><FinchAvatar size={48} mood="wave" /></div>
        <p className="text-[14px] text-text2 font-sans mt-2">好きなところから始めよう</p>
      </div>

      {/* Bubble grid */}
      <div className="flex flex-wrap justify-center gap-4 mb-8 px-2">
        {BUBBLES.map(b => {
          const isOpen = openBubble === b.id
          return (
            <button
              key={b.id}
              className="flex flex-col items-center gap-1.5 group"
              onClick={() => setOpenBubble(isOpen ? null : b.id)}
            >
              <div
                className={`w-[72px] h-[72px] rounded-full flex items-center justify-center text-white text-[15px] font-bold font-sans shadow-lg transition-all duration-200
                  ${isOpen ? 'scale-110 shadow-xl' : 'hover:scale-105 active:scale-95'}`}
                style={{ background: b.color }}
              >
                {b.label}
              </div>
              <span className="text-[11px] text-text3 font-sans">{b.desc}</span>
            </button>
          )
        })}
      </div>

      {/* Expanded panel */}
      {openBubble && (
        <div className="bg-bg3 border border-border rounded-3xl mx-1 mb-6 overflow-hidden shadow-[0_4px_24px_rgba(100,160,200,0.1)] animate-fi">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border">
            <span className="text-[15px] font-bold text-text font-sans">
              {BUBBLES.find(b => b.id === openBubble)?.label}
            </span>
            <button
              className="text-text3 text-lg px-2 hover:text-text"
              onClick={() => setOpenBubble(null)}
            >
              ✕
            </button>
          </div>
          <div className="p-5">
            {openBubble === 'lyrics' && <LyricsPanel song={song} updateSong={updateSong} />}
            {openBubble === 'mood' && <MoodPanel song={song} updateSong={updateSong} toast={toast} onDone={() => setOpenBubble(null)} />}
            {openBubble === 'chords' && <ChordsPanel song={song} updateSong={updateSong} />}
            {openBubble === 'melody' && <MelodyPanel song={song} updateSong={updateSong} toast={toast} />}
            {openBubble === 'dict' && <DictPanel />}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-col gap-3 px-4">
        <button
          className={`w-full py-4 rounded-2xl text-[16px] font-sans font-bold shadow-md transition-all active:scale-[0.97]
            ${playing ? 'bg-teal/20 border-2 border-teal text-teal' : 'bg-teal text-white'}`}
          onClick={handlePlay}
        >
          {playing ? '停止' : '再生してみよう'}
        </button>
        <button
          className="w-full py-4 rounded-2xl text-[16px] font-sans font-bold bg-amber text-white shadow-md active:scale-[0.97] transition-all"
          onClick={() => { downloadMidi(song); toast('MIDIをダウンロード。GarageBandで開いてね') }}
        >
          GarageBandへ書き出し
        </button>
      </div>
    </div>
  )
}

/* ─── Lyrics Panel ─── */
function LyricsPanel({ song, updateSong }: { song: any; updateSong: any }) {
  return (
    <div>
      <p className="text-[12px] text-text3 font-sans mb-2">思いつくフレーズを自由に。1行がだいたい1フレーズです。</p>
      <textarea
        className="bg-bg4 border border-border2 rounded-2xl text-text p-4 text-[15px] leading-[2] resize-none outline-none w-full font-sans min-h-[120px] focus:border-amber"
        placeholder="心に浮かんだ言葉を書いてみよう..."
        value={song.sections[0]?.lyrics || ''}
        onChange={e => updateSong((s: any) => { if (s.sections[0]) s.sections[0].lyrics = e.target.value })}
      />
    </div>
  )
}

/* ─── Mood Panel ─── */
function MoodPanel({ updateSong, toast, onDone }: { song: any; updateSong: any; toast: any; onDone: () => void }) {
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
    toast('コード進行ができました')
    onDone()
  }

  return (
    <div>
      <p className="text-[12px] text-text3 font-sans mb-3">4つ選ぶと自動でコード進行が作られます</p>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {CAT_KEYS.map(cat => (
          <div key={cat}>
            <label className="text-[12px] text-text2 font-sans mb-1 block">{MOOD_CATEGORIES[cat].label}</label>
            <select
              className="w-full bg-bg4 border border-border2 rounded-2xl text-text px-3 py-2.5 text-[14px] outline-none font-sans focus:border-amber"
              value={mood[cat] || ''}
              onChange={e => setMood(prev => ({ ...prev, [cat]: e.target.value }))}
            >
              <option value="">選んでね</option>
              {MOOD_CATEGORIES[cat].options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        ))}
      </div>
      {allSelected && (
        <button
          className="w-full py-3.5 rounded-2xl text-[15px] font-bold font-sans bg-amber text-white shadow-md active:scale-[0.97]"
          onClick={handleGenerate}
        >
          この雰囲気で作る
        </button>
      )}
    </div>
  )
}

/* ─── Chords Panel ─── */
function ChordsPanel({ song, updateSong }: { song: any; updateSong: any }) {
  return (
    <div>
      <p className="text-[12px] text-text3 font-sans mb-3">ボタンを押すとコード進行がセットされます</p>
      <div className="flex gap-2 flex-wrap mb-4">
        {QUICK_PROGRESSIONS.map(p => (
          <button
            key={p.label}
            className="text-[14px] px-4 py-3 bg-bg4 border border-border2 rounded-2xl text-text2 cursor-pointer font-sans hover:border-amber hover:text-amber hover:shadow-md active:scale-95 transition-all"
            onClick={() => {
              updateSong((s: any) => {
                s.sections[0].measures = p.chords.map((c: string, i: number) => ({
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
      {song.sections[0]?.measures.some((m: any) => m.chord) && (
        <div className="flex gap-2 flex-wrap">
          {song.sections[0].measures.map((m: any, i: number) => (
            <span key={i} className={`text-[14px] px-3 py-1.5 rounded-xl font-mono ${m.chord ? 'bg-amber/10 border border-amber/30 text-amber' : 'text-text3'}`}>
              {m.chord || '-'}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Melody Panel (keyboard + mic) ─── */
function MelodyPanel({ song, updateSong, toast }: { song: any; updateSong: any; toast: any }) {
  const [mode, setMode] = useState<'keyboard' | 'mic'>('keyboard')
  const [octave, setOctave] = useState(4)
  const [dur] = useState('q')
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
      // Auto-expand: add measure if all are full
      const sec = s.sections[0]
      if (!sec) return
      for (const m of sec.measures) {
        let sb = 0
        for (const n of (m.melNotes || [])) sb += (DURATION_BEATS[n.duration] || 1)
        if (sb + (DURATION_BEATS[dur] || 1) <= 4.01) {
          if (!m.melNotes) m.melNotes = []
          m.melNotes.push({ pitch, duration: dur, startBeat: sb })
          return
        }
      }
      // All measures full → add new measure
      const newMeas = { id: gid(), chord: '', melNotes: [{ pitch, duration: dur, startBeat: 0 }] }
      sec.measures.push(newMeas)
    })
  }, [dur, updateSong])

  return (
    <div>
      <div className="flex gap-2 mb-3">
        {([['keyboard', '鍵盤'], ['mic', '鼻歌']] as const).map(([m, label]) => (
          <button
            key={m}
            className={`text-[13px] px-4 py-2 rounded-2xl font-sans border transition-colors
              ${mode === m ? 'bg-amber/15 border-amber text-amber font-bold' : 'bg-transparent border-border2 text-text3'}`}
            onClick={() => setMode(m)}
          >
            {label}
          </button>
        ))}
        <span className="flex-1" />
        <div className="flex gap-1">
          {[{ o: 3, label: '低' }, { o: 4, label: '中' }, { o: 5, label: '高' }].map(({ o, label }) => (
            <button
              key={o}
              className={`px-3 py-1.5 rounded-xl text-[12px] font-sans border
                ${octave === o ? 'bg-amber/15 border-amber text-amber font-bold' : 'bg-bg4 border-border2 text-text3'}`}
              onClick={() => setOctave(o)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'keyboard' && (
        <div className="relative h-[140px] select-none rounded-2xl overflow-hidden mb-2">
          <div className="flex h-full gap-[1px] bg-[#999]">
            {['C', 'D', 'E', 'F', 'G', 'A', 'B'].map(n => {
              const isScale = scaleNotes.includes(n)
              return (
                <button
                  key={n}
                  className={`flex-1 rounded-b-md flex flex-col items-center justify-end pb-2 font-mono transition-colors duration-50
                    ${isScale ? 'bg-[#e0fff0] text-teal active:bg-teal/50' : 'bg-white text-[#999] active:bg-[#ccc]'}`}
                  onClick={() => { const p = n + octave; playNote(p); addNote(p) }}
                >
                  <span className="text-[14px] font-bold">{n}</span>
                </button>
              )
            })}
          </div>
          <div className="absolute top-0 left-0 right-0 h-[60%] pointer-events-none">
            {[
              { note: 'C#', left: '10%' }, { note: 'D#', left: '24%' },
              { note: 'F#', left: '52.5%' }, { note: 'G#', left: '66.5%' }, { note: 'A#', left: '80.5%' },
            ].map(({ note, left }) => {
              const isScale = scaleNotes.includes(note)
              return (
                <button
                  key={note}
                  className={`absolute w-[11%] h-full rounded-b-md shadow-[1px_2px_4px_rgba(0,0,0,0.5)] text-[10px] font-mono flex items-end justify-center pb-1.5 pointer-events-auto transition-colors duration-50
                    ${isScale ? 'bg-[#1a4a3a] text-teal/90 active:bg-teal/60' : 'bg-[#222] text-white/40 active:bg-[#555]'}`}
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

      {mode === 'mic' && (
        <div className="text-center py-6">
          {detectedPitch ? (
            <div className="text-3xl font-mono font-bold text-amber animate-pulse mb-3">{detectedPitch}</div>
          ) : (
            <div className="text-[14px] text-text3 font-sans mb-3">{micActive ? '歌ってください...' : 'マイクを開始してください'}</div>
          )}
          <div className="flex gap-2 justify-center">
            <button
              className={`px-5 py-3 rounded-2xl text-[14px] font-sans font-bold border transition-colors
                ${micActive ? 'bg-coral/15 border-coral text-coral' : 'bg-teal/15 border-teal text-teal'}`}
              onClick={async () => {
                if (micActive) {
                  detectorRef.current?.stop(); setMicActive(false); setDetectedPitch(null)
                } else {
                  const detector = createPitchDetector(pitch => { setDetectedPitch(pitch); playNote(pitch) })
                  detectorRef.current = detector
                  try { await detector.start(); setMicActive(true) } catch { toast('マイクへのアクセスが許可されていません') }
                }
              }}
            >
              {micActive ? '停止' : 'マイク開始'}
            </button>
            {detectedPitch && (
              <button
                className="px-5 py-3 rounded-2xl text-[14px] font-sans font-bold bg-amber text-white"
                onClick={() => { if (detectedPitch) addNote(detectedPitch) }}
              >
                {detectedPitch} を入力
              </button>
            )}
          </div>
        </div>
      )}

      <button
        className="text-[12px] px-3 py-1.5 rounded-xl border border-text3/30 text-text3 font-sans hover:bg-text3/10 mt-1"
        onClick={() => addNote('R')}
      >
        + 休符
      </button>
    </div>
  )
}

/* ─── Dict Panel (mini) ─── */
function DictPanel() {
  const BASICS = [
    { q: 'コードって何？', a: '複数の音を同時に鳴らしたもの。Cコード＝ド・ミ・ソの3音。明るいのがメジャー、暗いのがマイナー。' },
    { q: 'キーって何？', a: '曲の中心になる音。Cメジャーなら白鍵だけで弾ける。歌いやすい高さに合わせて変えられる。' },
    { q: 'BPMって何？', a: '1分間の拍数。60＝ゆっくり、120＝普通、160＝速い。J-POPのサビは120〜140くらい。' },
    { q: 'コード進行って？', a: 'コードの並び順のこと。「王道進行」C→G→Am→Fは日本のヒット曲の大半が使っている黄金パターン。' },
    { q: 'メロディの作り方は？', a: '鍵盤で緑色の鍵（スケール音）を適当に弾くだけで曲のキーに合ったメロディになる。' },
    { q: 'GarageBandで何ができる？', a: 'このアプリで作ったコードとメロディをMIDIで書き出し→GarageBandで楽器の音色をつけて本格的な曲に仕上げられる。' },
  ]
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  return (
    <div className="space-y-2">
      {BASICS.map((item, i) => (
        <div key={i} className="bg-bg4 rounded-2xl overflow-hidden">
          <button
            className="w-full text-left px-4 py-3 text-[13px] font-bold text-text font-sans flex items-center justify-between"
            onClick={() => setOpenIdx(openIdx === i ? null : i)}
          >
            {item.q}
            <span className="text-text3">{openIdx === i ? '▾' : '▸'}</span>
          </button>
          {openIdx === i && (
            <div className="px-4 pb-3 text-[12px] text-text2 font-sans leading-relaxed">{item.a}</div>
          )}
        </div>
      ))}
    </div>
  )
}
