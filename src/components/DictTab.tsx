import { useState, useEffect, useCallback } from 'react'
import { playChord } from '../utils/audio'
import { getCustomProgressions, saveCustomProgression, deleteCustomProgression } from '../utils/customDict'
import type { CustomProgression } from '../types'

/* ─── コード辞典データ ─── */
const CHORD_DICT = [
  { name: '王道進行', genre: 'J-POP', mood: '明るい・感動', chords: ['C', 'G', 'Am', 'F'],
    desc: 'Ⅰ→Ⅴ→Ⅵm→Ⅳの流れが感動的でドラマチックな響きを生む。日本のJ-POPで最も使われる黄金進行。',
    ex: ['Story / AI', 'ありがとう / いきものがかり'] },
  { name: '小室進行', genre: 'J-POP', mood: '哀愁・疾走', chords: ['Am', 'F', 'G', 'C'],
    desc: '90年代J-POP黄金期を築いた小室哲哉が多用。Ⅵm→Ⅳ→Ⅴ→Ⅰで哀愁と疾走感が同居する。',
    ex: ['DEPARTURES / globe'] },
  { name: '4-5-3-6進行', genre: 'J-POP', mood: '切ない・ドラマチック', chords: ['F', 'G', 'Em', 'Am'],
    desc: 'Ⅳ→Ⅴ→Ⅲm→Ⅵmの循環。切なくドラマチックで、サビへの盛り上がりに最適。',
    ex: ['世界に一つだけの花 / SMAP'] },
  { name: 'Just The Two of Us', genre: 'J-POP/R&B', mood: 'おしゃれ・洗練', chords: ['FM7', 'Em7', 'Dm7', 'Em7'],
    desc: 'ループ感のあるオシャレな進行。シティポップやNeo Soulで多用される都会的なサウンド。',
    ex: ['丸の内サディスティック / 椎名林檎'] },
  { name: '50年代進行', genre: 'ポップス', mood: '懐かしい・ポップ', chords: ['C', 'Am', 'F', 'G'],
    desc: '1950〜60年代のポップスの定番。Ⅰ→Ⅵm→Ⅳ→Ⅴの安定した循環。',
    ex: ['Stand By Me / Ben E. King'] },
  { name: 'クリシェ（内声下降）', genre: 'ポップス', mood: '叙情的・哀愁', chords: ['Am', 'AmM7', 'Am7', 'Am6'],
    desc: 'ルートはAmのまま内声が半音ずつ下降する技法。シンプルなのに奥深い哀愁が生まれる。',
    ex: ['夜空ノムコウ / SMAP'] },
  { name: 'I-IV-V（ロック基本）', genre: 'ロック', mood: '力強い・シンプル', chords: ['C', 'F', 'G'],
    desc: 'ロックの最も基本的な3コード進行。シンプルだからこそパワーがある。',
    ex: ['Johnny B. Goode / Chuck Berry'] },
  { name: '暗い系（フラメンコ）', genre: 'ロック', mood: 'ダーク・情熱', chords: ['Am', 'G', 'F', 'E'],
    desc: 'Amから半音階的に下降しEで終わる進行。フラメンコ的な緊張感と情熱。',
    ex: ['Hit the Road Jack / Ray Charles'] },
  { name: 'カノン進行', genre: 'クラシック', mood: '壮大・美しい', chords: ['C', 'G', 'Am', 'Em', 'F', 'C', 'F', 'G'],
    desc: 'パッヘルベルのカノンに由来する8小節の循環。バロックから現代ポップスまで幅広く使われる。',
    ex: ['カノン / パッヘルベル', '卒業写真 / 荒井由実'] },
  { name: 'ブルース進行', genre: 'ブルース', mood: '渋い・ソウル', chords: ['C7', 'C7', 'C7', 'C7', 'F7', 'F7', 'C7', 'C7', 'G7', 'F7', 'C7', 'G7'],
    desc: '12小節で構成されるブルースの基本形。I7→IV7→V7の3コードでジャズ・ロックの原点。',
    ex: ['ブルース全般'] },
]

/* ─── 音楽基礎データ ─── */
const MUSIC_BASICS = [
  { title: '五線譜の仕組み',
    body: '五線譜は5本の横線の上に音符を配置して音の高さを表します。線・線の間のどこに音符があるかで音が決まります。',
    tip: '中央のド（C4）はト音記号では第1線の下に加線1本を引いてその上に書かれます。' },
  { title: 'ト音記号とヘ音記号',
    body: 'ト音記号（𝄞）は高音部記号。第2線がG（ソ）の音を示し、メロディに使います。ヘ音記号（𝄢）は低音部記号で第4線がF（ファ）の音。ベースパートに使います。',
    tip: '伴奏タブで大譜表（ピアノ両手）が表示されます。' },
  { title: '音符の長さ（音価）',
    body: '全音符＝4拍 / 2分音符＝2拍 / 4分音符＝1拍 / 8分音符＝0.5拍 / 16分音符＝0.25拍。4/4拍子では1小節に4分音符が4つ。',
    tip: '音符入力で実際に試してみよう。選んだ音価が五線譜にそのまま表示されます。' },
  { title: '三連符',
    body: '3連符は本来2等分される音価を3等分したリズム。楽譜上は音符の上下に「3」と書いて示します。',
    tip: 'シャッフルやスウィングのグルーヴは3連符から生まれます。' },
  { title: '拍子記号',
    body: '4/4＝4分音符1拍×4拍、3/4＝3拍（ワルツ）、6/8＝8分音符1拍×6拍（複合拍子）。上の数字が拍数、下が1拍の音価。',
    tip: '制作タブで拍子を変更できます。カスタム入力なら7/4・5/8など変拍子も自由！' },
  { title: 'テンポとBPM',
    body: 'BPM（Beats Per Minute）は1分間の拍数。BPM60＝1拍1秒。J-POPサビは120〜140が多く、バラードは60〜80。',
    tip: 'BPMを変えるだけで曲の印象が大きく変わります。' },
  { title: 'コードとは',
    body: '複数の音を同時に鳴らしたもの。基本は根音＋3度＋5度の3音。Cコード＝C・E・G。長3度で明るい「メジャー」、短3度で暗い「マイナー」。',
    tip: 'コードの音をバラバラに弾く奏法を「アルペジオ」といいます。' },
  { title: 'キー（調）',
    body: '曲の音の中心となる音。Cメジャーは白鍵だけで構成。歌手の音域に合わせてキーを上下させることを「移調」といいます。',
    tip: 'スケール音（キーに合う音）は鍵盤モードでハイライト表示されます。' },
  { title: 'ダイアトニックコード',
    body: 'キーのスケール各音を根音にして作ったコード。Cメジャーでは C・Dm・Em・F・G・Am・Bm♭5 の7つ。これらだけで多くの曲が作れます。',
    tip: '王道進行 C→G→Am→F もすべてCメジャーのダイアトニックコード。' },
  { title: 'コードの種類',
    body: 'メジャー（明るい）・マイナー（暗い）に加え、セブンス（ジャズ感：C7）・メジャーセブンス（おしゃれ：CM7）・サスペンデッド（浮遊感：Csus4）など多彩。',
    tip: 'FM7・EM7などのM7はシティポップの定番。使うだけでオシャレに。' },
  { title: 'スケール（音階）',
    body: 'メジャースケール（全全半全全全半）は明るく安定。マイナースケールは暗く情緒的。ペンタトニックは5音構成でブルース・ロック向き。',
    tip: 'スケールを覚えると「キーに合うメロディ」がわかります。' },
]

type SubTab = 'dict' | 'basics' | 'my'

export default function DictTab() {
  const [sub, setSub] = useState<SubTab>('dict')
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  const [myProgs, setMyProgs] = useState<CustomProgression[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [addName, setAddName] = useState('')
  const [addChords, setAddChords] = useState('')

  const loadMyProgs = useCallback(async () => {
    const items = await getCustomProgressions()
    setMyProgs(items)
  }, [])

  useEffect(() => { loadMyProgs() }, [loadMyProgs])

  const handleAddProg = async () => {
    const name = addName.trim()
    const chords = addChords.split(/[,\s|→]+/).map(c => c.trim()).filter(Boolean)
    if (!name || chords.length === 0) return
    await saveCustomProgression(name, chords)
    setAddName('')
    setAddChords('')
    setShowAdd(false)
    loadMyProgs()
  }

  const handleDeleteProg = async (id: string) => {
    await deleteCustomProgression(id)
    loadMyProgs()
  }

  return (
    <div className="animate-fi">
      {/* Sub tabs */}
      <div className="flex gap-2 mb-4">
        {([['my', 'マイ進行'], ['dict', 'コード辞典'], ['basics', '音楽の基礎']] as const).map(([id, label]) => (
          <button
            key={id}
            className={`text-[13px] px-4 py-2 rounded-lg font-sans border transition-colors
              ${sub === id ? 'bg-amber/15 border-amber text-amber font-bold' : 'bg-transparent border-border2 text-text3 hover:border-amber hover:text-amber'}`}
            onClick={() => { setSub(id); setOpenIdx(null) }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* マイ進行 */}
      {sub === 'my' && (
        <div className="space-y-3">
          {/* Add button */}
          {!showAdd ? (
            <button
              className="w-full py-3 rounded-xl border border-dashed border-border2 text-text3 text-[13px] font-sans hover:border-amber hover:text-amber transition-colors"
              onClick={() => setShowAdd(true)}
            >
              + マイ進行を追加
            </button>
          ) : (
            <div className="bg-bg3 border border-border2 rounded-xl p-4">
              <div className="text-[13px] font-bold text-amber font-sans mb-3">新しいコード進行を追加</div>
              <input
                className="w-full bg-bg4 border border-border2 rounded-lg text-text px-3 py-2 text-sm outline-none font-sans mb-2 focus:border-amber"
                placeholder="名前（例: サビの定番）"
                value={addName}
                onChange={e => setAddName(e.target.value)}
              />
              <input
                className="w-full bg-bg4 border border-border2 rounded-lg text-text px-3 py-2 text-sm outline-none font-sans mb-3 focus:border-amber"
                placeholder="コード（例: Am F G C）"
                value={addChords}
                onChange={e => setAddChords(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddProg() }}
              />
              <div className="text-[10px] text-text3 mb-3 font-sans">スペース、カンマ、→、| で区切れます</div>
              <div className="flex gap-2">
                <button
                  className="flex-1 py-2 bg-amber text-bg rounded-lg text-sm font-bold font-sans"
                  onClick={handleAddProg}
                >
                  保存
                </button>
                <button
                  className="py-2 px-4 border border-border2 rounded-lg text-text3 text-sm font-sans hover:text-text2"
                  onClick={() => { setShowAdd(false); setAddName(''); setAddChords('') }}
                >
                  キャンセル
                </button>
              </div>
            </div>
          )}

          {/* List */}
          {myProgs.length === 0 && !showAdd && (
            <div className="text-center py-8 text-text3 text-[13px] font-sans">
              お気に入りのコード進行を保存しましょう。<br/>
              制作タブからも保存できます。
            </div>
          )}
          {myProgs.map((prog, i) => (
            <div key={prog.id} className="bg-bg3 border border-border2 rounded-xl overflow-hidden">
              <button
                className="w-full px-4 py-3 flex items-center gap-3 text-left"
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
              >
                <div className="flex-1">
                  <div className="text-[13px] font-bold text-text font-sans">{prog.name}</div>
                  {prog.key && <span className="text-[10px] text-text3 font-mono">Key: {prog.key}</span>}
                </div>
                <div className="flex gap-1 flex-wrap">
                  {prog.chords.slice(0, 4).map((c, ci) => (
                    <span key={ci} className="text-[11px] px-1.5 py-0.5 rounded bg-bg4 text-text2 font-mono border border-border2">{c}</span>
                  ))}
                  {prog.chords.length > 4 && <span className="text-[10px] text-text3">+{prog.chords.length - 4}</span>}
                </div>
                <span className="text-text3 text-[12px]">{openIdx === i ? '▾' : '▸'}</span>
              </button>
              {openIdx === i && (
                <div className="px-4 pb-3 border-t border-border">
                  <div className="flex gap-1.5 flex-wrap mt-2 mb-2">
                    {prog.chords.map((c, ci) => (
                      <button
                        key={ci}
                        className="px-2.5 py-1.5 rounded-lg text-[12px] font-mono border border-amber/40 text-amber bg-amber/5 hover:bg-amber/15 active:scale-95"
                        onClick={() => playChord(c)}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="text-[11px] px-3 py-1.5 border border-coral/40 rounded-lg text-coral bg-transparent hover:bg-coral/10 font-sans"
                      onClick={() => handleDeleteProg(prog.id)}
                    >
                      削除
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* コード辞典 */}
      {sub === 'dict' && (
        <div className="space-y-2">
          {CHORD_DICT.map((item, i) => (
            <div key={i} className="bg-bg3 border border-border2 rounded-xl overflow-hidden">
              <button
                className="w-full px-4 py-3 flex items-center gap-3 text-left"
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
              >
                <div className="flex-1">
                  <div className="text-[13px] font-bold text-text font-sans">{item.name}</div>
                  <div className="flex gap-1.5 mt-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber/10 text-amber font-mono border border-amber/30">{item.genre}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg4 text-text3 font-mono border border-border2">{item.mood}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  {item.chords.slice(0, 4).map((c, ci) => (
                    <span key={ci} className="text-[11px] px-1.5 py-0.5 rounded bg-bg4 text-text2 font-mono border border-border2">{c}</span>
                  ))}
                  {item.chords.length > 4 && <span className="text-[10px] text-text3">+{item.chords.length - 4}</span>}
                </div>
                <span className="text-text3 text-[12px]">{openIdx === i ? '▾' : '▸'}</span>
              </button>
              {openIdx === i && (
                <div className="px-4 pb-3 border-t border-border">
                  <p className="text-[12px] text-text2 leading-relaxed mt-2 font-sans">{item.desc}</p>
                  <div className="flex gap-1.5 flex-wrap mt-2">
                    {item.chords.map((c, ci) => (
                      <button
                        key={ci}
                        className="px-2.5 py-1.5 rounded-lg text-[12px] font-mono border border-amber/40 text-amber bg-amber/5 hover:bg-amber/15 active:scale-95"
                        onClick={() => playChord(c)}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  {item.ex.length > 0 && (
                    <div className="mt-2 text-[11px] text-text3 font-sans">
                      使用曲: {item.ex.join(' / ')}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 音楽の基礎 */}
      {sub === 'basics' && (
        <div className="space-y-2">
          {MUSIC_BASICS.map((item, i) => (
            <div key={i} className="bg-bg3 border border-border2 rounded-xl overflow-hidden">
              <button
                className="w-full px-4 py-3 flex items-center gap-3 text-left"
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
              >
                <div className="text-[13px] font-bold text-text font-sans flex-1">{item.title}</div>
                <span className="text-text3 text-[12px]">{openIdx === i ? '▾' : '▸'}</span>
              </button>
              {openIdx === i && (
                <div className="px-4 pb-3 border-t border-border">
                  <p className="text-[12px] text-text2 leading-[1.8] mt-2 font-sans">{item.body}</p>
                  <div className="mt-2 px-3 py-2 bg-amber/5 border border-amber/20 rounded-lg">
                    <span className="text-[11px] text-amber font-sans">{item.tip}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
