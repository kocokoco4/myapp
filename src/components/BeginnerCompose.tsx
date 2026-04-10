/**
 * BeginnerCompose — 初心者向け「ブドウの房」型制作画面
 * 大きな円ボタン5つ（歌詞・コード・メロディ・伴奏・辞典）
 * 各円をタップ→展開→入力→閉じる
 * 下に再生・GarageBandボタン
 */
import { useState, useRef, useCallback } from 'react'
import { useStore } from '../store'
import { NOTE_NAMES, DURATION_BEATS } from '../constants'
import { playChord, playNote, playSectionAudio } from '../utils/audio'
import { createPitchDetector, type PitchDetector } from '../utils/pitchDetect'
import { MOOD_CATEGORIES, generateTemplate, type MoodSelection, type MoodCategory } from '../utils/moodTemplates'
import { downloadMidi } from '../utils/midi'
import { gid } from '../utils/id'
import { callGemini } from '../utils/gemini'
import FinchAvatar from './FinchAvatar'

const CAT_KEYS: MoodCategory[] = ['emotion', 'scene', 'energy', 'relation']

type BubbleId = 'lyrics' | 'autobuild' | 'melody' | 'learn' | 'ai'

const BUBBLES: { id: BubbleId; label: string; color: string; desc: string }[] = [
  { id: 'lyrics', label: '歌詞', color: '#50b0e0', desc: '歌いたい言葉を書こう' },
  { id: 'autobuild', label: '曲にする', color: '#50c878', desc: '雰囲気を選ぶだけでOK' },
  { id: 'melody', label: 'メロディ', color: '#e080a0', desc: '鍵盤か鼻歌で音を入れる' },
  { id: 'learn', label: '学ぶ', color: '#9090cc', desc: '音楽の基礎とコード辞典' },
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
      {/* Finch greeting + AI chat */}
      <div className="text-center mb-6">
        <button
          className="inline-block group"
          onClick={() => setOpenBubble(openBubble === 'ai' ? null : 'ai')}
        >
          <div className="animate-float"><FinchAvatar size={52} mood={openBubble === 'ai' ? 'happy' : 'wave'} /></div>
          <p className={`text-[13px] font-sans mt-1.5 transition-colors ${openBubble === 'ai' ? 'text-amber font-bold' : 'text-text3 group-hover:text-amber'}`}>
            僕に相談
          </p>
        </button>
      </div>

      {/* Bubble grid */}
      <div className="flex flex-wrap justify-center gap-3 mb-8 px-2 max-w-sm mx-auto">
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
        <div className="bg-bg3 border border-border rounded-3xl mx-1 mb-6 overflow-hidden shadow-[0_4px_24px_rgba(100,160,200,0.1)] animate-fi max-w-lg mx-auto">
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
            {openBubble === 'autobuild' && <AutoBuildPanel song={song} updateSong={updateSong} toast={toast} />}
            {openBubble === 'melody' && <MelodyPanel song={song} updateSong={updateSong} toast={toast} />}
            {openBubble === 'learn' && <LearnPanel />}
            {openBubble === 'ai' && <AIChatPanel song={song} />}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-col gap-3 px-4 max-w-lg mx-auto w-full">
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
/* MoodPanel removed — integrated into AutoBuildPanel */

/* ─── Auto Build Panel — 雰囲気を選ぶだけで一曲分のコード＋構成が完成 ─── */
function AutoBuildPanel({ song, updateSong, toast }: { song: any; updateSong: any; toast: any }) {
  const [mood, setMood] = useState<Partial<MoodSelection>>({})
  const allSelected = CAT_KEYS.every(k => mood[k])
  const built = song.sections.length > 1 || song.sections[0]?.measures.some((m: any) => m.chord)

  const handleBuild = () => {
    if (!allSelected) return
    const sel = mood as MoodSelection
    const tmpl = generateTemplate(sel)
    updateSong((s: any) => {
      s.key = tmpl.key
      s.tempo = tmpl.bpm
      s.sections = tmpl.sections.map((sec: any) => ({
        id: gid(), name: sec.name, lyrics: s.sections[0]?.lyrics || '',
        measures: sec.chords.map((c: string) => ({ id: gid(), chord: c, melNotes: [] })),
      }))
    })
    toast('曲の骨組みができました！次はメロディをつけてみよう')
  }

  return (
    <div>
      {built ? (
        <div>
          <div className="bg-teal/10 border border-teal/30 rounded-2xl px-4 py-3 mb-3">
            <p className="text-[13px] text-teal font-sans font-bold">曲の骨組みができています</p>
            <p className="text-[12px] text-text3 font-sans mt-1">
              {song.sections.length}パート・{song.sections.reduce((s: number, sec: any) => s + sec.measures.length, 0)}ブロック
            </p>
          </div>
          <div className="space-y-1 mb-3">
            {song.sections.map((sec: any, si: number) => (
              <div key={si} className="flex items-center gap-2 text-[12px]">
                <span className="text-amber font-sans font-bold w-16 shrink-0">{sec.name}</span>
                <div className="flex gap-1 flex-wrap flex-1">
                  {sec.measures.slice(0, 6).map((m: any, mi: number) => (
                    <span key={mi} className="px-1.5 py-0.5 rounded bg-bg4 text-text3 font-mono text-[11px]">{m.chord || '-'}</span>
                  ))}
                  {sec.measures.length > 6 && <span className="text-text3 text-[11px]">...</span>}
                </div>
              </div>
            ))}
          </div>
          <button
            className="text-[12px] text-text3 font-sans underline"
            onClick={() => {
              setMood({})
              updateSong((s: any) => {
                const lyrics = s.sections[0]?.lyrics || ''
                s.sections = [{ id: gid(), name: 'イントロ', lyrics, measures: Array(4).fill(0).map(() => ({ id: gid(), chord: '', melNotes: [] })) }]
              })
            }}
          >
            雰囲気を変えて作り直す
          </button>
        </div>
      ) : (
        <div>
          <p className="text-[13px] text-text2 font-sans mb-4 leading-relaxed">
            4つの雰囲気を選ぶだけで、<br/>曲のパート構成・コード進行・テンポが自動で決まります
          </p>
          <div className="grid grid-cols-2 gap-3 mb-4">
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
              className="w-full py-4 rounded-2xl text-[16px] font-bold font-sans bg-amber text-white shadow-lg active:scale-[0.97] transition-all"
              onClick={handleBuild}
            >
              曲にする
            </button>
          )}
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
      {/* Show lyrics for reference while composing melody */}
      {song.sections[0]?.lyrics && (
        <div className="bg-bg4 rounded-2xl px-4 py-3 mb-3">
          <div className="text-[11px] text-text3 font-sans mb-1">歌詞を見ながらメロディをつけよう</div>
          <div className="text-[14px] text-text font-sans leading-[2] whitespace-pre-wrap max-h-[80px] overflow-y-auto">
            {song.sections[0].lyrics}
          </div>
        </div>
      )}

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
        <div className="text-center py-4">
          <div className="text-3xl font-mono font-bold text-amber mb-3 h-10">
            {detectedPitch ? detectedPitch : <span className="text-text3 text-[14px] font-sans">{micActive ? '歌ってください...' : ''}</span>}
          </div>
          {micActive && (
            <div className="w-full h-1.5 bg-bg4 rounded-full mb-3 overflow-hidden">
              <div className="h-full bg-teal rounded-full animate-pulse" style={{ width: detectedPitch ? '80%' : '20%' }} />
            </div>
          )}
          <button
            className={`w-full py-4 rounded-2xl text-[16px] font-sans font-bold border transition-all shadow-md active:scale-[0.97]
              ${micActive ? 'bg-coral text-white border-coral' : 'bg-teal text-white border-teal'}`}
            onClick={async () => {
              if (micActive) {
                detectorRef.current?.stop(); setMicActive(false); setDetectedPitch(null)
              } else {
                const detector = createPitchDetector(pitch => {
                  setDetectedPitch(pitch)
                  playNote(pitch)
                  addNote(pitch) // 連続自動入力
                })
                detectorRef.current = detector
                try { await detector.start(); setMicActive(true) } catch { toast('マイクへのアクセスが許可されていません') }
              }
            }}
          >
            {micActive ? 'ストップ' : 'マイクで歌う'}
          </button>
          {!micActive && <p className="text-[12px] text-text3 font-sans mt-2">ボタンを押して歌うと自動で音が入ります</p>}
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

/* ─── AI Chat Panel (simple) ─── */
function AIChatPanel({ song }: { song: any }) {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([])
  const [sending, setSending] = useState(false)

  const send = async () => {
    const t = input.trim()
    if (!t || sending) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: t }])
    setSending(true)
    try {
      const sys = `初心者向けの作曲アドバイザー。「${song.title}」を制作中。Key:${song.key} BPM:${song.tempo}。やさしい言葉で短く答えて。専門用語は避けて。`
      const resp = await callGemini(sys, [{ role: 'user', content: t }], 400)
      setMessages(prev => [...prev, { role: 'ai', text: resp }])
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: 'ごめんね、うまく答えられなかった。もう一度聞いてみて。' }])
    }
    setSending(false)
  }

  return (
    <div>
      <div className="space-y-2 mb-3 max-h-[200px] overflow-y-auto">
        {messages.length === 0 && (
          <div className="text-[13px] text-text3 font-sans text-center py-3">
            作曲のことなんでも聞いてね
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`text-[13px] font-sans px-3 py-2 rounded-2xl leading-relaxed ${m.role === 'user' ? 'bg-amber/10 text-text ml-8' : 'bg-bg4 text-text2 mr-8'}`}>
            {m.text}
          </div>
        ))}
        {sending && <div className="text-[12px] text-text3 font-sans animate-pulse px-3">考え中...</div>}
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 min-w-0 bg-bg4 border border-border2 rounded-2xl text-text px-4 py-2.5 text-[14px] outline-none font-sans focus:border-amber"
          placeholder="なんでも聞いてね..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') send() }}
        />
        <button
          className="px-4 py-2.5 bg-amber text-white rounded-2xl text-[13px] font-bold font-sans shrink-0"
          onClick={send}
          disabled={sending}
        >
          送信
        </button>
      </div>
      <div className="flex gap-1.5 flex-wrap mt-2">
        {['コードって何？', 'サビの作り方', 'メロディのコツ'].map(q => (
          <button
            key={q}
            className="text-[11px] px-2.5 py-1 bg-bg4 border border-border2 rounded-full text-text3 font-sans hover:border-amber hover:text-amber"
            onClick={() => { setInput(q); }}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ─── Learn Panel (FAQ + chord dict) ─── */
function LearnPanel() {
  const [tab, setTab] = useState<'faq' | 'chords'>('faq')
  const BASICS = [
    { q: 'コードって何？', a: '複数の音を同時に鳴らしたもの。Cコード＝ド・ミ・ソの3音。明るいのがメジャー、暗いのがマイナー。' },
    { q: 'キーって何？', a: '曲の中心になる音。Cメジャーなら白鍵だけで弾ける。歌いやすい高さに合わせて変えられる。' },
    { q: 'BPMって何？', a: '1分間の拍数。60＝ゆっくり、120＝普通、160＝速い。J-POPのサビは120〜140くらい。' },
    { q: 'コード進行って？', a: 'コードの並び順のこと。「王道進行」C→G→Am→Fは日本のヒット曲の大半が使っている黄金パターン。' },
    { q: 'メロディの作り方は？', a: '鍵盤で緑色の鍵（スケール音）を適当に弾くだけで曲のキーに合ったメロディになる。' },
    { q: 'GarageBandで何ができる？', a: 'このアプリで作ったコードとメロディをMIDIで書き出し→GarageBandで楽器の音色をつけて本格的な曲に仕上げられる。' },
  ]
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  const CHORDS = [
    { name: '王道進行', chords: ['C', 'G', 'Am', 'F'], desc: '日本のヒット曲の黄金パターン' },
    { name: '小室進行', chords: ['Am', 'F', 'G', 'C'], desc: '90年代J-POPの哀愁疾走パターン' },
    { name: 'カノン', chords: ['C', 'G', 'Am', 'Em', 'F', 'C', 'F', 'G'], desc: '壮大で美しいクラシック由来' },
    { name: '丸サ進行', chords: ['FM7', 'Em7', 'Dm7', 'Em7'], desc: 'おしゃれシティポップ' },
  ]

  return (
    <div>
      <div className="flex gap-2 mb-3">
        {([['faq', '基礎知識'], ['chords', 'コード辞典']] as const).map(([id, label]) => (
          <button
            key={id}
            className={`text-[12px] px-3 py-1.5 rounded-xl font-sans border transition-colors
              ${tab === id ? 'bg-amber/15 border-amber text-amber font-bold' : 'bg-transparent border-border2 text-text3'}`}
            onClick={() => { setTab(id); setOpenIdx(null) }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'faq' && (
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
      )}

      {tab === 'chords' && (
        <div className="space-y-2">
          {CHORDS.map((item, i) => (
            <div key={i} className="bg-bg4 rounded-2xl overflow-hidden">
              <button
                className="w-full text-left px-4 py-3 flex items-center justify-between"
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
              >
                <div>
                  <div className="text-[13px] font-bold text-text font-sans">{item.name}</div>
                  <div className="text-[11px] text-text3 font-sans">{item.desc}</div>
                </div>
                <span className="text-text3">{openIdx === i ? '▾' : '▸'}</span>
              </button>
              {openIdx === i && (
                <div className="px-4 pb-3 flex gap-1.5 flex-wrap">
                  {item.chords.map((c, ci) => (
                    <button
                      key={ci}
                      className="px-3 py-1.5 rounded-xl text-[13px] font-mono border border-amber/40 text-amber bg-amber/5 hover:bg-amber/15 active:scale-95"
                      onClick={() => playChord(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
