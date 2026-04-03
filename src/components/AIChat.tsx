import { useState, useRef, useEffect } from 'react'
import { useStore } from '../store'
import { AI_SUGGESTIONS } from '../constants'
import { callGemini, getGeminiKey } from '../utils/gemini'
import FinchAvatar from './FinchAvatar'

interface Props {
  onOpenSettings: () => void
}

type ChatMode = 'compose' | 'help'

const HELP_SUGGESTIONS = [
  '曲の作り方を教えて',
  'コードの入力方法は？',
  '伴奏の生成方法は？',
  'MIDIの使い方は？',
]

export default function AIChat({ onOpenSettings }: Props) {
  const { currentSong, aiHist, setAiHist } = useStore()
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [mode, setMode] = useState<ChatMode>('compose')
  const msgsRef = useRef<HTMLDivElement>(null)
  const song = currentSong()

  useEffect(() => {
    if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight
  }, [aiHist])

  if (!song) return null

  const hasKey = !!getGeminiKey()

  // [Webhook候補] AI相談イベントを外部に通知できる
  const send = async (text?: string) => {
    if (!hasKey) { onOpenSettings(); return }
    const t = (text || input).trim()
    if (!t || sending) return
    setInput('')
    const newHist = [...aiHist, { role: 'user' as const, content: t }]
    setAiHist(newHist)
    setSending(true)

    const cp = song.sections.map(x => `${x.name}:${x.measures.map(m => m.chord || '–').join('|')}`).join('\n')
    const sys = mode === 'help'
      ? `あなたは「曲帳」アプリの使い方ガイドです。以下の機能を説明できます:
- 曲の作成・管理（サイドバーで曲一覧、タイトル・キー・BPM・拍子の設定）
- コード入力（小節をタップ→コード選択、1小節内に複数コード可、クイック進行ボタン）
- メロディ入力（+ 音ボタン→ボタンモードまたは鍵盤モードで音を選択、休符・三連符対応）
- 歌詞入力（各セクションに歌詞を入力、歌詞をメロディに割当する機能あり）
- 雰囲気から作る（4つのプルダウンで雰囲気を選び、テンプレートでコード進行を自動生成）
- 再生（セクション再生・通し再生、BPMに連動）
- AI伴奏生成（伴奏・スコアタブで楽器を選択→AI伴奏生成）
- 出力（MusicXML→LogicPro、MIDI→GarageBand）
- 設定（テーマ切替、言語切替、プラン管理）
短く丁寧に日本語で答えて。`
      : `J-POP音楽制作アドバイザー。「${song.title}」制作中(${song.status})。Key:${song.key} BPM:${song.tempo}\nコード:\n${cp}\n歌詞:${song.lyrics || '未入力'}\n短く答えて。コード提案はC→Am→F→G形式で。`
    try {
      const resp = await callGemini(sys, newHist, 800)
      setAiHist([...newHist, { role: 'assistant', content: resp }])
    } catch (e) {
      if ((e as Error).message === 'NO_KEY') { onOpenSettings(); return }
      setAiHist([...newHist, { role: 'assistant', content: `⚠️ エラー: ${(e as Error).message}` }])
    }
    setSending(false)
  }

  return (
    <div className="animate-fi flex flex-col h-[calc(100vh-175px)]">
      {!hasKey && (
        <div className="bg-amber/[0.08] border border-amber/30 rounded-[10px] px-3.5 py-3 mb-3 text-xs text-amber">
          ⚠️ AIを使うにはGemini APIキーが必要です。
          <button
            className="ml-2.5 px-2.5 py-1 bg-amber text-bg rounded-lg text-[11px] font-bold cursor-pointer border-none"
            onClick={onOpenSettings}
          >
            設定を開く
          </button>
        </div>
      )}

      {/* Mode toggle */}
      <div className="flex gap-1 mb-2">
        {([['compose', '作曲相談'], ['help', '使い方ガイド']] as const).map(([m, label]) => (
          <button
            key={m}
            className={`text-[12px] px-3 py-1.5 rounded-lg font-sans border transition-colors
              ${mode === m ? 'bg-amber/15 border-amber text-amber font-bold' : 'bg-transparent border-border2 text-text3 hover:border-amber hover:text-amber'}`}
            onClick={() => { setMode(m); setAiHist([]) }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div ref={msgsRef} className="flex-1 overflow-y-auto flex flex-col gap-2.5 pb-2.5">
        {aiHist.length === 0 && (
          <div className="self-start max-w-[84%] flex items-start gap-2">
            <FinchAvatar size={32} mood="wave" className="shrink-0 mt-1" />
            <div className="px-3.5 py-2.5 rounded-[14px] text-[13px] leading-[1.7] bg-bg3 text-text border border-border2 rounded-bl-sm">
              {mode === 'help'
                ? 'Finchantの使い方を聞いてください。機能や操作方法を説明します。'
                : `「${song.title}」の制作サポートします。コード・アレンジ・歌詞など何でもどうぞ`}
            </div>
          </div>
        )}
        {aiHist.map((m, i) => (
          m.role === 'user' ? (
            <div key={i} className="self-end max-w-[84%] px-3.5 py-2.5 rounded-[14px] text-[13px] leading-[1.7] bg-amber text-bg rounded-br-sm font-medium"
              dangerouslySetInnerHTML={{ __html: m.content.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>') }}
            />
          ) : (
            <div key={i} className="self-start max-w-[84%] flex items-start gap-2">
              <FinchAvatar size={28} mood={m.content.includes('?') ? 'thinking' : 'happy'} className="shrink-0 mt-1" />
              <div className="px-3.5 py-2.5 rounded-[14px] text-[13px] leading-[1.7] bg-bg3 text-text border border-border2 rounded-bl-sm"
                dangerouslySetInnerHTML={{ __html: m.content.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>') }}
              />
            </div>
          )
        ))}
        {sending && (
          <div className="self-start flex items-center gap-2">
            <FinchAvatar size={28} mood="thinking" className="shrink-0" />
            <span className="text-text3 text-[12px] font-mono animate-pulse">考え中...</span>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="shrink-0 pt-2.5 border-t border-border">
        <div className="flex gap-1.5 flex-wrap mb-2">
          {(mode === 'help' ? HELP_SUGGESTIONS : AI_SUGGESTIONS).map(sg => (
            <button
              key={sg}
              className="text-[10px] px-2.5 py-1 bg-bg3 border border-border2 rounded-full text-text2 cursor-pointer whitespace-nowrap font-sans hover:border-amber hover:text-amber"
              onClick={() => send(sg)}
            >
              {sg}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className="flex-1 bg-bg4 border border-border2 rounded-3xl text-text px-4 py-2.5 text-base outline-none font-sans focus:border-amber"
            placeholder="コード、アレンジ、メロディなど..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          />
          <button
            className="px-4 py-2 bg-amber text-bg rounded-lg font-bold text-xs cursor-pointer border-none disabled:opacity-40"
            onClick={() => send()}
            disabled={sending}
          >
            送信
          </button>
        </div>
      </div>
    </div>
  )
}
