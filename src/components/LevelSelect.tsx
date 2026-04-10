/**
 * LevelSelect — 初回ログイン時のレベル選択画面
 * フィンチが「作曲の経験は？」と聞いてレベルを設定
 */
import { useStore } from '../store'
import type { UserLevel } from '../types'
import FinchAvatar from './FinchAvatar'

const LEVELS: { id: UserLevel; title: string; desc: string }[] = [
  { id: 'beginner', title: 'はじめて作曲する', desc: '歌詞と雰囲気から、ガイド付きで曲を作れます' },
  { id: 'intermediate', title: '少し経験がある', desc: 'コード入力やメロディ入力も使えます' },
  { id: 'advanced', title: '自由に作りたい', desc: '五線譜・拍子カスタム・MusicXMLなど全機能' },
]

export default function LevelSelect() {
  const { setLevel } = useStore()

  return (
    <div className="h-screen flex items-center justify-center bg-bg">
      <div className="text-center max-w-sm px-6 animate-fi">
        <div className="mb-5 animate-bounce-gentle"><FinchAvatar size={80} mood="wave" /></div>
        <h1 className="font-sans text-2xl font-extrabold text-amber mb-2">はじめまして！</h1>
        <p className="text-text2 text-[14px] mb-8 font-sans leading-relaxed">
          作曲の経験に合わせて<br/>画面をカスタマイズします
        </p>
        <div className="space-y-3">
          {LEVELS.map(lv => (
            <button
              key={lv.id}
              className="w-full text-left px-5 py-5 bg-bg3 border border-border2 rounded-3xl hover:border-amber hover:shadow-lg transition-all active:scale-[0.98]"
              onClick={() => setLevel(lv.id)}
            >
              <div className="text-[15px] font-bold text-text font-sans">{lv.title}</div>
              <div className="text-[13px] text-text3 font-sans mt-1">{lv.desc}</div>
            </button>
          ))}
        </div>
        <p className="text-[12px] text-text3 font-sans mt-5">設定からいつでも変更できます</p>
      </div>
    </div>
  )
}
