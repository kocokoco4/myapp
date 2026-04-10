import { useState } from 'react'
import { useStore } from '../store'
import { useI18n } from '../i18n'
import { INSTRUMENTS } from '../constants'
import { callGemini, getGeminiKey } from '../utils/gemini'
import { exportMusicXML } from '../utils/musicxml'
import { downloadMidi } from '../utils/midi'
import { singleStaffSVG, grandStaffSVG, drumStaffSVG } from '../utils/staff'

interface Props {
  onOpenSettings: () => void
}

type SubView = 'accomp' | 'chart'

export default function ArrangeTab({ onOpenSettings }: Props) {
  const { currentSong, updateSong, toast, level } = useStore()
  const { t } = useI18n()
  const isAdv = level === 'advanced'
  const [generating, setGenerating] = useState(false)
  const [subView, setSubView] = useState<SubView>('accomp')
  const song = currentSong()
  if (!song) return null

  const ac = song.accomp

  const toggleInstr = (k: string) => {
    updateSong(s => {
      const i = (s.selInstrs || []).indexOf(k)
      if (i >= 0) s.selInstrs.splice(i, 1)
      else s.selInstrs.push(k)
    })
  }

  // [Webhook候補] 伴奏生成イベントを外部に通知できる
  const generateAccomp = async () => {
    if (!getGeminiKey()) { onOpenSettings(); return }
    setGenerating(true)
    const cp = song.sections.map(x => `${x.name}:${x.measures.map(m => m.chord || '-').join('|')}`).join('\n')
    const instrs = song.selInstrs || ['piano', 'bass', 'drums']
    const sys = `音楽アレンジャー。コード進行に合わせたJ-POP系伴奏をJSONのみで返す。説明・コードブロック不要。
フォーマット(選択楽器のみ):
{"piano":{"sections":[{"sectionName":"Aメロ","measures":[{"chord":"C","rh":[{"pitch":"E4","startBeat":0,"duration":"h"},{"pitch":"G4","startBeat":2,"duration":"h"}],"lh":[{"pitch":"C3","startBeat":0,"duration":"q"},{"pitch":"G3","startBeat":1,"duration":"q"},{"pitch":"C3","startBeat":2,"duration":"q"},{"pitch":"G3","startBeat":3,"duration":"q"}]}]}]},
"bass":{"sections":[{"sectionName":"Aメロ","measures":[{"chord":"C","notes":[{"pitch":"C2","startBeat":0,"duration":"h"},{"pitch":"G2","startBeat":2,"duration":"q"},{"pitch":"E2","startBeat":3,"duration":"q"}]}]}]},
"guitar":{"sections":[{"sectionName":"Aメロ","measures":[{"chord":"C","notes":[{"pitch":"E3","startBeat":0,"duration":"q"},{"pitch":"G3","startBeat":1,"duration":"q"},{"pitch":"B3","startBeat":2,"duration":"q"},{"pitch":"G3","startBeat":3,"duration":"q"}]}]}]},
"drums":{"sections":[{"sectionName":"Aメロ","measures":[{"chord":"C","pattern":{"HH":[1,1,1,1,1,1,1,1],"SD":[0,0,0,0,1,0,0,0],"BD":[1,0,0,0,1,0,0,0],"CY":[1,0,0,0,0,0,0,0]}}]}]}}
ルール:piano rh=C4以上,lh=C3以下。bass=C1-C3,guitar=E2-E5。startBeat=0〜3,duration=w/h/q/8/16。各小節合計4拍。drums=8拍8要素 0/1。各セクション2小節。楽器:${instrs.join(',')}`

    try {
      const raw = await callGemini(sys, [{ role: 'user', content: `${song.title} Key:${song.key} BPM:${song.tempo}\n${cp}` }], 1200)
      const t = raw.replace(/```json|```/g, '').trim()
      const p = JSON.parse(t)
      updateSong(s => { s.accomp = p })
      toast('伴奏譜面を生成しました！')
    } catch (e) {
      if ((e as Error).message === 'NO_KEY') onOpenSettings()
      else alert('生成失敗。コード進行を入力してから再試行してください。')
    }
    setGenerating(false)
  }

  const printScore = () => {
    const w = window.open('', '_blank')
    if (!w) return
    const esc = (s: string) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    w.document.write(`<html><head><title>${esc(song.title)}</title><style>body{font-family:'Helvetica Neue',Arial,sans-serif;padding:32px;max-width:720px;margin:0 auto;color:#111}h1{font-size:24px;font-weight:800;margin-bottom:4px}.meta{color:#888;font-size:12px;font-family:monospace;margin-bottom:24px}.sec{margin-bottom:20px}.sn{font-weight:700;font-size:12px;color:#7c3aed;margin-bottom:8px;padding-bottom:3px;border-bottom:2px solid #7c3aed22;font-family:monospace}.cs{display:flex;flex-wrap:wrap;gap:6px}.c{text-align:center}.cn{font-size:9px;color:#bbb;margin-bottom:2px;font-family:monospace}.ch{border:1px solid #ddd;border-radius:7px;padding:7px 12px;font-size:16px;font-weight:700;color:#7c3aed;min-width:52px;font-family:monospace;text-align:center}.lyr{margin-top:26px;padding-top:20px;border-top:2px solid #eee}pre{line-height:2.2;font-size:14px;white-space:pre-wrap;font-family:inherit}</style></head><body>
    <h1>${esc(song.title)}</h1><div class="meta">Key: ${song.key} · BPM: ${song.tempo}</div>
    ${song.sections.map(sec => `<div class="sec"><div class="sn">${esc(sec.name)}</div><div class="cs">${sec.measures.map((m, i) => `<div class="c"><div class="cn">${i + 1}</div><div class="ch">${m.chord || '-'}</div></div>`).join('')}</div></div>`).join('')}
    ${song.sections.some(sec => sec.lyrics) ? `<div class="lyr"><h3 style="font-size:13px;color:#888;margin-bottom:10px">歌詞</h3>${song.sections.filter(sec => sec.lyrics).map(sec => `<div style="margin-bottom:12px"><div style="font-size:11px;font-weight:700;color:#7c3aed;margin-bottom:4px">${esc(sec.name)}</div><pre>${esc(sec.lyrics)}</pre></div>`).join('')}</div>` : ''}
    </body></html>`)
    w.document.close()
    setTimeout(() => w.print(), 400)
  }

  return (
    <div className="animate-fi">
      {/* Sub-view toggle */}
      <div className="flex gap-1 mb-3.5 bg-bg2 rounded-lg p-1 w-fit">
        <button
          className={`text-[12px] px-3.5 py-1.5 rounded-md font-sans transition-colors
            ${subView === 'accomp' ? 'bg-bg4 text-amber font-bold' : 'bg-transparent text-text2 hover:text-text'}`}
          onClick={() => setSubView('accomp')}
        >
          {t('arrange.accomp')}
        </button>
        <button
          className={`text-[12px] px-3.5 py-1.5 rounded-md font-sans transition-colors
            ${subView === 'chart' ? 'bg-bg4 text-amber font-bold' : 'bg-transparent text-text2 hover:text-text'}`}
          onClick={() => setSubView('chart')}
        >
          {t('arrange.chart')}
        </button>
      </div>

      {subView === 'accomp' ? (
        <>
          {/* Instrument selection */}
          <div className="mb-3">
            <label className="text-[10px] text-text2 font-bold block mb-1 font-mono tracking-wider">{t('arrange.instruments')}</label>
            <div className="flex gap-1.5 flex-wrap">
              {Object.entries(INSTRUMENTS).map(([k, v]) => {
                const on = (song.selInstrs || []).includes(k)
                return (
                  <button
                    key={k}
                    className="px-3 py-1.5 rounded-full border text-[11px] cursor-pointer font-mono font-bold"
                    style={{
                      borderColor: on ? v.color : v.color + '33',
                      color: on ? v.color : 'var(--color-text3)',
                      background: on ? v.color + '18' : 'transparent',
                    }}
                    onClick={() => toggleInstr(k)}
                  >
                    {v.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Generate / Export buttons */}
          <div className="flex gap-2 flex-wrap items-center mb-4">
            <button
              className="px-4 py-2 bg-amber text-bg rounded-lg font-bold text-xs cursor-pointer border-none disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={generateAccomp}
              disabled={generating}
            >
              {generating ? t('arrange.generating') : t('arrange.generate')}
            </button>
            {ac && (
              <>
                {isAdv && (
                  <button
                    className="px-4 py-2 bg-teal text-bg rounded-lg font-bold text-xs cursor-pointer border-none"
                    onClick={() => { exportMusicXML(song); toast(t('arrange.musicxmlHint')) }}
                  >
                    {t('arrange.musicxml')}
                  </button>
                )}
                <button
                  className="px-4 py-2 bg-amber text-bg rounded-lg font-bold text-xs cursor-pointer border-none"
                  onClick={() => { downloadMidi(song); toast(t('arrange.midiHint')) }}
                >
                  {t('arrange.midi')}
                </button>
              </>
            )}
          </div>

          {/* Score display */}
          {!ac ? (
            <div className="text-center py-11">
              <div className="text-lg mb-3 opacity-30 font-display font-bold text-text3">Score</div>
              <div className="text-text3 text-xs leading-[2] font-mono">
                楽器を選んで、伴奏を生成。<br />
                <span className="text-[10px]">制作タブでコード進行を入れておくと精度UP</span>
              </div>
            </div>
          ) : (
            Object.entries(INSTRUMENTS)
              .filter(([k]) => ac[k as keyof typeof ac])
              .map(([k, v]) => {
                const data = ac[k as keyof typeof ac]!
                return (
                  <div key={k} className="mb-5">
                    <div className="text-[11px] font-bold font-mono mb-1.5" style={{ color: v.color }}>
                      {v.label}
                    </div>
                    {data.sections?.map((sec, si) => (
                      <div key={si} className="mb-3">
                        <div className="text-[10px] font-bold text-purple font-mono tracking-wider mb-2 px-2 py-0.5 bg-purple/10 rounded inline-block">
                          {sec.sectionName || sec.name || 'SEC'}
                        </div>
                        <div
                          className="staff-block"
                          dangerouslySetInnerHTML={{
                            __html: k === 'piano'
                              ? grandStaffSVG(sec.measures as never, v.color)
                              : k === 'drums'
                              ? drumStaffSVG(sec.measures as never)
                              : singleStaffSVG(sec.measures as never, k === 'bass' ? 'bass' : 'treble', v.color)
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )
              })
          )}
        </>
      ) : (
        /* ─── Chart sub-view ─── */
        <>
          <div className="flex justify-end mb-3">
            <button
              className="text-[11px] px-3 py-1.5 border border-border2 rounded-lg text-text2 bg-transparent hover:border-amber hover:text-amber font-sans"
              onClick={printScore}
            >
              PDF保存
            </button>
          </div>

          <div className="bg-bg3 border border-border rounded-2xl p-5">
            <div className="font-display text-[22px] font-extrabold text-text mb-1">{song.title}</div>
            <div className="text-[11px] text-text3 font-mono mb-4">Key: {song.key} · BPM: {song.tempo}</div>

            {song.sections.map(sec => (
              <div key={sec.id} className="mb-4">
                <div className="text-[11px] font-bold text-amber font-mono mb-2 flex items-center gap-2">
                  {sec.name}
                  <span className="flex-1 h-px bg-border" />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {sec.measures.map((m, i) => (
                    <div key={m.id}>
                      <div className="text-[11px] text-text3 mb-0.5 font-mono">{i + 1}</div>
                      <div className={`bg-bg4 border rounded-lg px-3 py-2 text-[15px] font-bold font-mono min-w-[52px] text-center
                        ${m.chord ? 'border-amber/40 text-amber' : 'border-border text-text3'}`}>
                        {m.chord || '-'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Lyrics */}
            {song.sections.some(sec => sec.lyrics) && (
              <div className="mt-4 pt-4 border-t border-border2">
                <div className="text-[10px] text-text2 font-bold font-mono tracking-wider mb-2">LYRICS</div>
                {song.sections.filter(sec => sec.lyrics).map(sec => (
                  <div key={sec.id} className="mb-2.5">
                    <div className="text-[10px] font-bold text-amber font-mono mb-1">{sec.name}</div>
                    <pre className="text-text2 text-[13px] leading-[2.1] whitespace-pre-wrap font-sans">{sec.lyrics}</pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
