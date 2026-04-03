import { useState, useCallback } from 'react'
import { useStore } from '../store'
import { MOOD_CATEGORIES, generateTemplate, type MoodSelection, type MoodCategory } from '../utils/moodTemplates'
import { gid } from '../utils/id'

const CAT_KEYS: MoodCategory[] = ['emotion', 'scene', 'energy', 'relation']

type Phase = 'select' | 'loading' | 'result'

interface GeneratedResult {
  title: string
  catchphrase: string
  bpm: number
  key: string
  sections: { name: string; chords: string[] }[]
}

export default function MoodGenerator() {
  const { updateSong, toast } = useStore()
  const [mood, setMood] = useState<Partial<MoodSelection>>({})
  const [phase, setPhase] = useState<Phase>('select')
  const [result, setResult] = useState<GeneratedResult | null>(null)

  const allSelected = CAT_KEYS.every(k => mood[k])

  const handleGenerate = useCallback(async () => {
    if (!allSelected) return
    const sel = mood as MoodSelection
    setPhase('loading')

    // テンプレートからBPM・KEY・コード進行を生成
    const tmpl = generateTemplate(sel)

    // 選んだ雰囲気テキストをそのままタイトルに
    const title = `${sel.emotion} × ${sel.scene}`
    const catchphrase = `${sel.energy} / ${sel.relation}`

    setResult({ title, catchphrase, bpm: tmpl.bpm, key: tmpl.key, sections: tmpl.sections })
    setPhase('result')
  }, [mood, allSelected])

  const handleApply = useCallback(() => {
    if (!result) return
    updateSong(s => {
      // タイトルは変更しない（ユーザーが自分で決める）
      s.key = result.key
      s.tempo = result.bpm
      s.memo = result.catchphrase ? result.catchphrase : s.memo
      s.sections = result.sections.map(sec => ({
        id: gid(),
        name: sec.name,
        lyrics: '',
        measures: sec.chords.map(c => ({ id: gid(), chord: c, melNotes: [] })),
      }))
    })
    toast('曲に反映しました')
    setPhase('select')
    setMood({})
    setResult(null)
  }, [result, updateSong, toast])

  const handleReset = () => {
    setPhase('select')
    setMood({})
    setResult(null)
  }

  return (
    <div className="bg-bg3 border border-border rounded-2xl mb-4 overflow-hidden">
      <div className="px-3.5 py-2.5 border-b border-border bg-bg3">
        <span className="text-[13px] font-bold font-display text-amber">雰囲気から作る</span>
        <span className="text-[10px] text-text3 ml-2 font-mono">mood × template</span>
      </div>

      <div className="p-3.5">
        {/* ─── カテゴリ選択 ─── */}
        {phase === 'select' && (
          <>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {CAT_KEYS.map(cat => (
                <div key={cat}>
                  <label className="text-[10px] text-text2 font-mono mb-1 block">
                    {MOOD_CATEGORIES[cat].label}
                  </label>
                  <select
                    className="w-full bg-bg4 border border-border2 rounded-lg text-text px-2 py-1.5 text-xs outline-none font-sans focus:border-amber"
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

            {/* 数式プレビュー */}
            <div className="bg-bg4 rounded-xl px-3 py-3 mb-3 text-center">
              <div className="flex items-center justify-center gap-1.5 flex-wrap leading-relaxed">
                {CAT_KEYS.map((cat, i) => (
                  <span key={cat} className="flex items-center gap-1.5">
                    {i > 0 && <span className="text-amber font-bold text-xs">×</span>}
                    <span className={`font-sans ${mood[cat] ? 'text-text font-bold text-[14px]' : 'text-text3 text-[12px]'}`}>
                      {mood[cat] || '○'}
                    </span>
                  </span>
                ))}
                <span className="text-amber font-bold text-sm ml-1">=</span>
                <span className="text-amber font-bold text-lg ml-1">{allSelected ? '?' : '...'}</span>
              </div>
            </div>

            <button
              className={`w-full py-2.5 rounded-xl text-sm font-bold font-sans transition-all duration-200
                ${allSelected
                  ? 'bg-amber text-bg cursor-pointer hover:bg-amber2 active:scale-[0.98]'
                  : 'bg-bg4 text-text3 cursor-not-allowed'}`}
              disabled={!allSelected}
              onClick={handleGenerate}
            >
              生成する
            </button>
          </>
        )}

        {/* ─── ローディング ─── */}
        {phase === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="flex items-center gap-1 text-[11px] font-mono text-text3">
              {CAT_KEYS.map((cat, i) => (
                <span key={cat} className="flex items-center gap-1">
                  {i > 0 && <span className="text-amber font-bold">×</span>}
                  <span className="text-text2">{mood[cat]}</span>
                </span>
              ))}
              <span className="text-amber font-bold ml-1">=</span>
            </div>
            <div className="text-sm animate-pulse font-display font-bold text-amber">...</div>
            <div className="text-text3 text-xs font-mono animate-pulse">生成中...</div>
          </div>
        )}

        {/* ─── 結果表示 ─── */}
        {phase === 'result' && result && (
          <div className="space-y-3">
            {/* 選択した雰囲気を大きく表示 */}
            <div className="bg-bg4 rounded-xl px-4 py-4 text-center animate-fi">
              <div className="flex items-center justify-center gap-2 flex-wrap leading-relaxed">
                {CAT_KEYS.map((cat, i) => (
                  <span key={cat} className="flex items-center gap-2">
                    {i > 0 && <span className="text-amber font-bold">×</span>}
                    <span className="text-text font-bold text-[15px] font-sans">{mood[cat]}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* パラメータ */}
            <div className="flex gap-2 flex-wrap">
              <span className="text-[10px] px-2 py-1 rounded-full bg-amber/10 text-amber font-mono border border-amber/30">
                KEY: {result.key}
              </span>
              <span className="text-[10px] px-2 py-1 rounded-full bg-teal/10 text-teal font-mono border border-teal/30">
                BPM: {result.bpm}
              </span>
              <span className="text-[10px] px-2 py-1 rounded-full bg-bg4 text-text2 font-mono border border-border2">
                {result.sections.length}セクション
              </span>
            </div>

            {/* コード進行プレビュー */}
            <div className="space-y-1">
              {result.sections.map((sec, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px]">
                  <span className="text-amber font-mono w-14 shrink-0">{sec.name}</span>
                  <div className="flex gap-1 flex-wrap">
                    {sec.chords.map((c, ci) => (
                      <span key={ci} className="px-1.5 py-0.5 rounded bg-bg4 border border-border2 text-text2 font-mono">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* アクション */}
            <div className="flex gap-2">
              <button
                className="flex-1 py-2 rounded-xl text-sm font-bold bg-amber text-bg hover:bg-amber2 active:scale-[0.98] font-sans"
                onClick={handleApply}
              >
                この曲で始める
              </button>
              <button
                className="py-2 px-4 rounded-xl text-sm border border-border2 text-text2 bg-transparent hover:border-amber hover:text-amber font-sans"
                onClick={handleReset}
              >
                やり直す
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
