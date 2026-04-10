/**
 * UniversalCompose — 全レベル共通の円型UI
 * レベル（beginner/intermediate/advanced）に応じて円の数と機能が変わる
 */
import { useState, useRef, useCallback } from 'react'
import { useStore } from '../store'
import { NOTE_NAMES, DURATION_BEATS, KEYS, TIME_SIGNATURES } from '../constants'
import { playChord, playNote, playSectionAudio } from '../utils/audio'
import { createPitchDetector, quantizeDuration, snapToScale, type PitchDetector } from '../utils/pitchDetect'
import { MOOD_CATEGORIES, generateTemplate, type MoodSelection, type MoodCategory } from '../utils/moodTemplates'
import { downloadMidi } from '../utils/midi'
import { exportMusicXML } from '../utils/musicxml'
import { gid } from '../utils/id'
import { callGemini } from '../utils/gemini'
import FinchAvatar from './FinchAvatar'

const CAT_KEYS: MoodCategory[] = ['emotion', 'scene', 'energy', 'relation']

type BubbleId = 'lyrics' | 'autobuild' | 'melody' | 'learn' | 'ai' | 'finish'

interface Bubble {
  id: BubbleId
  label: string
  color: string
  desc: string
  levels: Array<'beginner' | 'intermediate' | 'advanced'>
}

const ALL_BUBBLES: Bubble[] = [
  { id: 'lyrics', label: '歌詞', color: '#50b0e0', desc: '歌いたい言葉を書こう', levels: ['beginner', 'intermediate', 'advanced'] },
  { id: 'autobuild', label: '曲にする', color: '#50c878', desc: '雰囲気を選ぶだけでOK', levels: ['beginner', 'intermediate', 'advanced'] },
  { id: 'melody', label: 'メロディ', color: '#e080a0', desc: '鍵盤か鼻歌で音を入れる', levels: ['beginner', 'intermediate', 'advanced'] },
  { id: 'finish', label: '仕上げ', color: '#e0a050', desc: '伴奏・設定・書き出し', levels: ['intermediate', 'advanced'] },
  { id: 'learn', label: '学ぶ', color: '#9090cc', desc: '音楽の基礎とコード辞典', levels: ['beginner', 'intermediate', 'advanced'] },
]

export default function BeginnerCompose() {
  const { currentSong, updateSong, toast, level } = useStore()
  const song = currentSong()
  const [openBubble, setOpenBubble] = useState<BubbleId | null>(null)
  const [playing, setPlaying] = useState(false)
  const stopRef = useRef<{ stop: () => void } | null>(null)

  if (!song) return null

  const activeLevel = (level || 'beginner') as 'beginner' | 'intermediate' | 'advanced'
  const BUBBLES = ALL_BUBBLES.filter(b => b.levels.includes(activeLevel))

  const handlePlay = useCallback(async () => {
    if (stopRef.current) {
      stopRef.current.stop(); stopRef.current = null; setPlaying(false)
      return
    }
    try { const ctx = new AudioContext(); if (ctx.state === 'suspended') await ctx.resume(); ctx.close() } catch {}
    const allMeasures = song.sections.flatMap(s => s.measures)
    if (!allMeasures.some(m => m.chord || m.melNotes?.length)) return
    const result = playSectionAudio(allMeasures, song.tempo, 4, true) // 自動伴奏ON
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
            {openBubble === 'finish' && <FinishPanel song={song} updateSong={updateSong} toast={toast} activeLevel={activeLevel} />}
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
        value={song.lyrics || ''}
        onChange={e => updateSong((s: any) => { s.lyrics = e.target.value })}
      />
    </div>
  )
}

/* ─── Mood Panel ─── */
/* MoodPanel removed — integrated into AutoBuildPanel */

/* ─── Auto Build Panel — 雰囲気を選ぶだけで一曲分のコード＋構成が完成 ─── */
const PRESET_PROGRESSIONS = [
  { name: '王道進行', desc: '感動系。J-POPヒット曲の定番', chords: ['C', 'G', 'Am', 'F'], mood: '明るい' },
  { name: '小室進行', desc: '哀愁と疾走感。90年代J-POP', chords: ['Am', 'F', 'G', 'C'], mood: '切ない' },
  { name: 'カノン進行', desc: '壮大で美しい。クラシック由来', chords: ['C', 'G', 'Am', 'Em', 'F', 'C', 'F', 'G'], mood: '壮大' },
  { name: '丸サ進行', desc: 'おしゃれシティポップ', chords: ['FM7', 'Em7', 'Dm7', 'Em7'], mood: 'おしゃれ' },
  { name: '暗い系', desc: 'ダークで情熱的', chords: ['Am', 'G', 'F', 'E'], mood: 'ダーク' },
  { name: '4-5-3-6', desc: 'ドラマチック。サビにぴったり', chords: ['F', 'G', 'Em', 'Am'], mood: 'ドラマ' },
]

function AutoBuildPanel({ song, updateSong, toast }: { song: any; updateSong: any; toast: any }) {
  const [tab, setTab] = useState<'preset' | 'mood'>('preset')
  const [mood, setMood] = useState<Partial<MoodSelection>>({})
  const allSelected = CAT_KEYS.every(k => mood[k])
  const built = song.sections.length > 1 || song.sections[0]?.measures.some((m: any) => m.chord)

  const handleBuild = () => {
    if (!allSelected) return
    try {
      const sel = mood as MoodSelection
      const tmpl = generateTemplate(sel)
      updateSong((s: any) => {
        s.key = tmpl.key
        s.tempo = tmpl.bpm
        // 初心者向けにセクション名をシンプルに
        let melodyNum = 0
        s.sections = tmpl.sections.map((sec: any) => {
          const isSabi = sec.name.includes('サビ') || sec.name.includes('ラスサビ')
          if (!isSabi) melodyNum++
          return {
            id: gid(),
            name: isSabi ? `サビ ★` : `メロディ ${melodyNum}`,
            lyrics: '',
            measures: sec.chords.map((c: string) => ({ id: gid(), chord: c, melNotes: [] })),
          }
        })
      })
      toast('曲の骨組みができました！次はメロディをつけてみよう')
    } catch (e) {
      console.error('handleBuild error:', e)
      toast('曲の生成に失敗しました。もう一度お試しください')
    }
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
                s.sections = [{ id: gid(), name: 'メロディ 1', lyrics: '', measures: Array(4).fill(0).map(() => ({ id: gid(), chord: '', melNotes: [] })) }]
                // 歌詞はsong.lyricsに保持されているので消えない
              })
            }}
          >
            雰囲気を変えて作り直す
          </button>
        </div>
      ) : (
        <div>
          {/* Tab: preset / mood */}
          <div className="flex gap-2 mb-4">
            {([['preset', 'おすすめから選ぶ'], ['mood', '雰囲気で自動生成']] as const).map(([id, label]) => (
              <button
                key={id}
                className={`text-[13px] px-4 py-2 rounded-2xl font-sans border transition-colors flex-1
                  ${tab === id ? 'bg-amber/15 border-amber text-amber font-bold' : 'bg-transparent border-border2 text-text3'}`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'preset' && (
            <div className="space-y-2">
              {PRESET_PROGRESSIONS.map(p => (
                <button
                  key={p.name}
                  className="w-full text-left px-4 py-3 bg-bg4 border border-border2 rounded-2xl hover:border-amber hover:shadow-md active:scale-[0.98] transition-all"
                  onClick={() => {
                    updateSong((s: any) => {
                      s.sections = [
                        { id: gid(), name: 'メロディ 1', lyrics: '', measures: [...p.chords, ...p.chords].map((c: string) => ({ id: gid(), chord: c, melNotes: [] })) },
                        { id: gid(), name: 'メロディ 2', lyrics: '', measures: [...p.chords, ...p.chords].map((c: string) => ({ id: gid(), chord: c, melNotes: [] })) },
                        { id: gid(), name: 'サビ ★', lyrics: '', measures: [...p.chords, ...p.chords].map((c: string) => ({ id: gid(), chord: c, melNotes: [] })) },
                      ]
                      // 歌詞はsong.lyricsに保持されているので消えない
                    })
                    playChord(p.chords[0])
                    toast(`「${p.name}」で曲を作りました`)
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[14px] font-bold text-text font-sans">{p.name}</div>
                      <div className="text-[12px] text-text3 font-sans">{p.desc}</div>
                    </div>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber/10 text-amber font-sans">{p.mood}</span>
                  </div>
                  <div className="flex gap-1.5 mt-2">
                    {p.chords.map((c, ci) => (
                      <span key={ci} className="text-[12px] px-2 py-0.5 rounded-lg bg-bg3 text-text2 font-mono border border-border2">{c}</span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          )}

          {tab === 'mood' && (
            <div>
              <p className="text-[12px] text-text3 font-sans mb-3">4つの雰囲気を選ぶと自動でコード進行が作られます</p>
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
      )}
    </div>
  )
}

/* ─── Melody Panel (keyboard + mic) ─── */
/** Re-number melody sections: メロディ1, メロディ2, ... (skip サビ★) */
function renumberSections(sections: any[]) {
  let num = 0
  for (const sec of sections) {
    if (sec.name.includes('★')) continue
    num++
    sec.name = `メロディ ${num}`
  }
}

function MelodyPanel({ song, updateSong, toast }: { song: any; updateSong: any; toast: any }) {
  const [mode, setMode] = useState<'keyboard' | 'mic'>('keyboard')
  const [octave, setOctave] = useState(4)
  const [dur] = useState('q')
  const [micActive, setMicActive] = useState(false)
  const [detectedPitch, setDetectedPitch] = useState<string | null>(null)
  const detectorRef = useRef<PitchDetector | null>(null)
  const [targetSection, setTargetSection] = useState(0) // which section to add notes to

  const scaleNotes = (() => {
    const MAJOR = [0, 2, 4, 5, 7, 9, 11]
    const ri = NOTE_NAMES.indexOf(song.key)
    if (ri < 0) return NOTE_NAMES
    return MAJOR.map(i => NOTE_NAMES[(ri + i) % 12])
  })()

  const addNote = useCallback((pitch: string, customDur?: string) => {
    const noteDur = customDur || dur
    updateSong((s: any) => {
      // Add to target section's first empty slot
      const sec = s.sections[targetSection] || s.sections[0]
      if (!sec) return
      for (const m of sec.measures) {
        let sb = 0
        for (const n of (m.melNotes || [])) sb += (DURATION_BEATS[n.duration] || 1)
        if (sb + (DURATION_BEATS[noteDur] || 1) <= 4.01) {
          if (!m.melNotes) m.melNotes = []
          m.melNotes.push({ pitch, duration: noteDur, startBeat: sb })
          return
        }
      }
      // Section full → add new measure
      sec.measures.push({ id: gid(), chord: sec.measures[0]?.chord || '', melNotes: [{ pitch, duration: noteDur, startBeat: 0 }] })
    })
  }, [dur, targetSection, updateSong])

  return (
    <div>
      {/* Show lyrics for reference while composing melody */}
      {song.lyrics && (
        <div className="bg-bg4 rounded-2xl px-4 py-3 mb-3">
          <div className="text-[11px] text-text3 font-sans mb-1">歌詞を見ながらメロディをつけよう</div>
          <div className="text-[14px] text-text font-sans leading-[2] whitespace-pre-wrap max-h-[80px] overflow-y-auto">
            {song.lyrics}
          </div>
        </div>
      )}

      {/* Key/Tempo/Keyboard explanation */}
      <div className="bg-amber/8 border border-amber/20 rounded-2xl px-4 py-3 mb-3">
        <div className="text-[13px] text-text font-sans font-bold mb-1">
          この曲: {song.key}メジャー / テンポ {song.tempo}
        </div>
        <div className="text-[12px] text-text2 font-sans leading-relaxed">
          テンポ{song.tempo} = 1分間に{song.tempo}回のリズム。
          {song.tempo < 90 ? 'ゆっくりめの曲' : song.tempo < 130 ? 'ふつうのテンポ' : '速めの曲'}です。
        </div>
        <div className="text-[12px] text-text2 font-sans leading-relaxed mt-1">
          鍵盤の<span className="text-teal font-bold">緑の鍵</span>はこの曲に合う音。
          迷ったら緑だけ弾けばOK！
        </div>
      </div>

      {/* Section selector + melody status */}
      <div className="mb-3">
        <div className="text-[12px] text-text2 font-sans mb-1.5">どのパートにメロディを入れる？</div>
        <div className="flex gap-1.5 flex-wrap mb-2">
          {song.sections.map((sec: any, si: number) => {
            const noteCount = sec.measures.reduce((sum: number, m: any) => sum + (m.melNotes?.filter((n: any) => n.pitch !== 'R').length || 0), 0)
            const isSabi = sec.name.includes('★')
            return (
              <button
                key={si}
                className={`text-[12px] px-3 py-1.5 rounded-2xl font-sans border transition-colors
                  ${targetSection === si
                    ? isSabi ? 'bg-coral/15 border-coral text-coral font-bold' : 'bg-amber/15 border-amber text-amber font-bold'
                    : 'bg-bg4 border-border2 text-text3'}`}
                onClick={() => setTargetSection(si)}
              >
                {sec.name}
                {noteCount > 0 && <span className="ml-1 text-[10px] opacity-60">({noteCount}音)</span>}
              </button>
            )
          })}
          {/* Add part */}
          <button
            className="text-[12px] px-3 py-1.5 rounded-2xl font-sans border border-dashed border-border2 text-text3 hover:border-amber hover:text-amber"
            onClick={() => {
              updateSong((s: any) => {
                const chords = s.sections[0]?.measures.map((m: any) => m.chord) || ['C', 'G', 'Am', 'F']
                s.sections.push({
                  id: gid(), name: `メロディ`, lyrics: '',
                  measures: chords.map((c: string) => ({ id: gid(), chord: c, melNotes: [] })),
                })
                renumberSections(s.sections)
              })
              setTargetSection(song.sections.length)
            }}
          >
            + パート追加
          </button>
        </div>

        {/* Actions for selected section */}
        <div className="flex gap-2 flex-wrap">
          {/* Toggle sabi flag */}
          {song.sections[targetSection] && (
            <button
              className={`text-[11px] px-2.5 py-1 rounded-xl font-sans border transition-colors
                ${song.sections[targetSection]?.name.includes('★')
                  ? 'bg-coral/10 border-coral/40 text-coral'
                  : 'bg-bg4 border-border2 text-text3 hover:border-coral hover:text-coral'}`}
              onClick={() => {
                updateSong((s: any) => {
                  const sec = s.sections[targetSection]
                  if (sec.name.includes('★')) {
                    sec.name = `メロディ` // placeholder, renumber will fix
                  } else {
                    sec.name = 'サビ ★'
                  }
                  renumberSections(s.sections)
                })
              }}
            >
              {song.sections[targetSection]?.name.includes('★') ? '★ サビを解除' : '★ サビにする'}
            </button>
          )}

          {/* Clear melody */}
          {song.sections[targetSection]?.measures.some((m: any) => m.melNotes?.length > 0) && (
            <button
              className="text-[11px] px-2.5 py-1 rounded-xl font-sans border border-border2 text-text3 hover:border-amber hover:text-amber"
              onClick={() => {
                const name = song.sections[targetSection]?.name
                if (!confirm(`${name}のメロディをクリアしますか？`)) return
                updateSong((s: any) => {
                  for (const m of s.sections[targetSection].measures) { m.melNotes = [] }
                })
                toast(`${name}のメロディをクリアしました`)
              }}
            >
              やり直す
            </button>
          )}

          {/* Delete part */}
          {song.sections.length > 1 && (
            <button
              className="text-[11px] px-2.5 py-1 rounded-xl font-sans border border-border2 text-text3 hover:border-coral hover:text-coral"
              onClick={() => {
                const name = song.sections[targetSection]?.name
                if (!confirm(`「${name}」を削除しますか？`)) return
                updateSong((s: any) => {
                  s.sections.splice(targetSection, 1)
                  renumberSections(s.sections)
                })
                setTargetSection(Math.max(0, targetSection - 1))
                toast(`${name}を削除しました`)
              }}
            >
              パート削除
            </button>
          )}
        </div>
      </div>

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
                const detector = createPitchDetector(({ pitch, durationMs }) => {
                  // スケール吸着: キー外の音はスケール内に自動補正
                  const snapped = snapToScale(pitch, song.key)
                  setDetectedPitch(snapped)
                  // 歌った長さからBPMに合わせて音価を自動判定
                  const autoDur = quantizeDuration(durationMs, song.tempo)
                  addNote(snapped, autoDur)
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
      if (!resp || resp.trim() === '') {
        setMessages(prev => [...prev, { role: 'ai', text: '（返答が空でした。もう一度聞いてみて）' }])
      } else {
        setMessages(prev => [...prev, { role: 'ai', text: resp }])
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('AI chat error:', e)
      setMessages(prev => [...prev, { role: 'ai', text: `エラー: ${msg}` }])
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

/* ─── Finish Panel — 仕上げ（編集/伴奏/設定/書き出し統合） ─── */
function FinishPanel({ song, updateSong, toast, activeLevel }: { song: any; updateSong: any; toast: any; activeLevel: 'beginner' | 'intermediate' | 'advanced' }) {
  const isAdv = activeLevel === 'advanced'
  const tabs: { id: string; label: string }[] = [
    { id: 'edit', label: '編集' },
    { id: 'accomp', label: 'AI伴奏' },
    ...(isAdv ? [{ id: 'settings', label: '設定' }, { id: 'export', label: '書き出す' }] : []),
  ]
  const [tab, setTab] = useState<string>(tabs[0].id)

  return (
    <div>
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`text-[12px] px-3 py-1.5 rounded-xl font-sans border transition-colors
              ${tab === t.id ? 'bg-amber/15 border-amber text-amber font-bold' : 'bg-bg4 border-border2 text-text3'}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'edit' && <EditPanel song={song} updateSong={updateSong} toast={toast} />}
      {tab === 'accomp' && <AccompPanel song={song} updateSong={updateSong} toast={toast} />}
      {tab === 'settings' && <SettingsPanel song={song} updateSong={updateSong} />}
      {tab === 'export' && <ExportPanel song={song} toast={toast} />}
    </div>
  )
}

/* ─── Edit Panel (intermediate+) ─── */
function EditPanel({ song, updateSong, toast }: { song: any; updateSong: any; toast: any }) {
  return (
    <div>
      <p className="text-[12px] text-text3 font-sans mb-3">各パートのコードと音符を細かく編集できます</p>
      <div className="space-y-3">
        {song.sections.map((sec: any, si: number) => (
          <div key={si} className="bg-bg4 rounded-2xl p-3">
            <div className="text-[13px] font-bold text-amber font-sans mb-2">{sec.name}</div>
            <div className="flex gap-1.5 flex-wrap mb-2">
              {sec.measures.map((m: any, mi: number) => (
                <div key={mi} className="flex flex-col items-center">
                  <input
                    className="w-[60px] bg-bg3 border border-border2 rounded-lg text-text px-2 py-1 text-[13px] outline-none font-mono text-center focus:border-amber"
                    value={m.chord}
                    onChange={e => updateSong((s: any) => { s.sections[si].measures[mi].chord = e.target.value })}
                    placeholder="-"
                  />
                  <span className="text-[10px] text-text3 font-mono mt-0.5">{m.melNotes?.length || 0}音</span>
                </div>
              ))}
              <button
                className="w-[60px] h-[32px] border border-dashed border-border2 rounded-lg text-text3 text-[14px] hover:border-amber hover:text-amber"
                onClick={() => updateSong((s: any) => { s.sections[si].measures.push({ id: gid(), chord: '', melNotes: [] }) })}
              >
                +
              </button>
            </div>
            <div className="flex gap-2 text-[11px]">
              <button
                className="px-2 py-1 border border-border2 rounded text-text3 hover:border-coral hover:text-coral"
                onClick={() => {
                  if (!confirm(`${sec.name}の最後の小節を削除しますか？`)) return
                  updateSong((s: any) => { if (s.sections[si].measures.length > 1) s.sections[si].measures.pop() })
                }}
              >
                − 小節
              </button>
              <button
                className="px-2 py-1 border border-border2 rounded text-text3 hover:border-amber hover:text-amber"
                onClick={() => {
                  updateSong((s: any) => { for (const m of s.sections[si].measures) m.melNotes = [] })
                  toast(`${sec.name}のメロディをクリア`)
                }}
              >
                メロディ消去
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Accomp Panel (intermediate+) — AI伴奏生成 ─── */
function AccompPanel({ song, updateSong, toast }: { song: any; updateSong: any; toast: any }) {
  const [generating, setGenerating] = useState(false)

  const generate = async () => {
    setGenerating(true)
    try {
      const cp = song.sections.map((x: any) => `${x.name}:${x.measures.map((m: any) => m.chord || '-').join('|')}`).join('\n')
      const sys = `音楽アレンジャー。コード進行に合わせたJ-POP系伴奏をJSONのみで返す。説明・コードブロック不要。
フォーマット:
{"piano":{"sections":[{"sectionName":"サビ","measures":[{"chord":"C","rh":[{"pitch":"E4","startBeat":0,"duration":"h"}],"lh":[{"pitch":"C3","startBeat":0,"duration":"q"}]}]}]},
"bass":{"sections":[{"sectionName":"サビ","measures":[{"chord":"C","notes":[{"pitch":"C2","startBeat":0,"duration":"q"}]}]}]},
"drums":{"sections":[{"sectionName":"サビ","measures":[{"chord":"C","pattern":{"HH":[1,1,1,1,1,1,1,1],"SD":[0,0,0,0,1,0,0,0],"BD":[1,0,0,0,1,0,0,0]}}]}]}}
ルール:piano rh=C4以上,lh=C3以下。bass=C1-C3。startBeat=0〜3,duration=w/h/q/8/16。各小節合計4拍。drums=8拍8要素 0/1。各セクション2小節。`
      const raw = await callGemini(sys, [{ role: 'user', content: `Key:${song.key} BPM:${song.tempo}\n${cp}` }], 1500)
      const cleaned = raw.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(cleaned)
      updateSong((s: any) => { s.accomp = parsed })
      toast('伴奏を生成しました')
    } catch (e) {
      console.error(e)
      toast('伴奏生成に失敗しました')
    }
    setGenerating(false)
  }

  return (
    <div>
      <p className="text-[13px] text-text2 font-sans mb-3">AIがピアノ・ベース・ドラムの伴奏を作ります</p>
      <button
        className="w-full py-3.5 rounded-2xl text-[15px] font-bold font-sans bg-amber text-white shadow-md disabled:opacity-50"
        onClick={generate}
        disabled={generating}
      >
        {generating ? '生成中...' : 'AI伴奏を作る'}
      </button>
      {song.accomp && (
        <div className="mt-3 p-3 bg-teal/10 border border-teal/30 rounded-2xl">
          <p className="text-[12px] text-teal font-sans font-bold">伴奏データあり</p>
          <p className="text-[11px] text-text3 font-sans mt-1">
            {Object.keys(song.accomp).filter(k => song.accomp[k]).join(' / ')}
          </p>
        </div>
      )}
    </div>
  )
}

/* ─── Settings Panel (advanced) — KEY/BPM/拍子 ─── */
function SettingsPanel({ song, updateSong }: { song: any; updateSong: any }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-[12px] text-text2 font-sans mb-1 block">キー (Key)</label>
        <select
          className="w-full bg-bg4 border border-border2 rounded-2xl text-text px-3 py-2.5 text-[14px] outline-none font-sans focus:border-amber"
          value={song.key}
          onChange={e => updateSong((s: any) => { s.key = e.target.value })}
        >
          {KEYS.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>
      <div>
        <label className="text-[12px] text-text2 font-sans mb-1 block">テンポ (BPM)</label>
        <input
          type="number"
          className="w-full bg-bg4 border border-border2 rounded-2xl text-text px-3 py-2.5 text-[14px] outline-none font-sans focus:border-amber"
          value={song.tempo}
          min={40}
          max={300}
          onChange={e => updateSong((s: any) => { s.tempo = parseInt(e.target.value) || 120 })}
        />
      </div>
      <div>
        <label className="text-[12px] text-text2 font-sans mb-1 block">拍子</label>
        <select
          className="w-full bg-bg4 border border-border2 rounded-2xl text-text px-3 py-2.5 text-[14px] outline-none font-sans focus:border-amber"
          value={song.timeSig ? `${song.timeSig.beats}/${song.timeSig.value}` : '4/4'}
          onChange={e => {
            const ts = TIME_SIGNATURES.find(t => t.label === e.target.value)
            if (ts) updateSong((s: any) => { s.timeSig = { beats: ts.beats, value: ts.value } })
          }}
        >
          {TIME_SIGNATURES.map(ts => (
            <option key={ts.label} value={ts.label}>{ts.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-[12px] text-text2 font-sans mb-1 block">曲タイトル</label>
        <input
          className="w-full bg-bg4 border border-border2 rounded-2xl text-text px-3 py-2.5 text-[14px] outline-none font-sans focus:border-amber"
          value={song.title}
          onChange={e => updateSong((s: any) => { s.title = e.target.value })}
        />
      </div>
    </div>
  )
}

/* ─── Export Panel (advanced) — MIDI/MusicXML ─── */
function ExportPanel({ song, toast }: { song: any; toast: any }) {
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-text2 font-sans">プロの音楽制作ツールに持ち出せます</p>
      <button
        className="w-full py-3.5 rounded-2xl text-[15px] font-bold font-sans bg-amber text-white shadow-md"
        onClick={() => { downloadMidi(song); toast('MIDIをダウンロード。GarageBandで開けます') }}
      >
        MIDI で書き出す（GarageBand用）
      </button>
      <button
        className="w-full py-3.5 rounded-2xl text-[15px] font-bold font-sans bg-teal text-white shadow-md"
        onClick={() => { exportMusicXML(song); toast('MusicXMLをダウンロード。LogicProで開けます') }}
      >
        MusicXML で書き出す（LogicPro用）
      </button>
    </div>
  )
}
