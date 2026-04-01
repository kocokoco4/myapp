import { useState, useRef } from 'react'
import { useStore } from '../store'
import { getGeminiKey, setGeminiKey } from '../utils/gemini'
import { CONFIG } from '../constants'
import { doc, setDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import PlanModal from './PlanModal'
import { PLANS } from '../utils/plan'
import { useI18n, LANGS } from '../i18n'

interface Props {
  open: boolean
  onClose: () => void
}

export default function SettingsModal({ open, onClose }: Props) {
  const { user, songs, toast, plan, usage, theme, toggleTheme } = useStore()
  const { lang, setLang } = useI18n()
  const [keyInput, setKeyInput] = useState('')
  const [planOpen, setPlanOpen] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const hasGemini = !!getGeminiKey()
  const currentPlanDef = PLANS.find(p => p.id === plan)

  if (!open) return null

  const saveKey = () => {
    const v = keyInput.trim()
    if (v && !v.startsWith('●')) {
      setGeminiKey(v)
      toast('Gemini APIキーを保存しました')
    }
    onClose()
  }

  // 旧アプリからデータをインポート
  const importFromJson = (jsonStr: string) => {
    try {
      const d = JSON.parse(jsonStr)
      const importSongs = d.songs || []
      if (importSongs.length === 0) {
        toast('インポートするデータが見つかりません')
        return
      }
      // localStorageに保存
      localStorage.setItem(CONFIG.STORAGE_KEY, jsonStr)
      // Firestoreにも保存
      if (auth.currentUser) {
        setDoc(doc(db, 'users', auth.currentUser.uid), { songs: importSongs, curId: d.curId || importSongs[0]?.id })
      }
      toast(`${importSongs.length}曲をインポートしました。リロードします...`)
      setTimeout(() => window.location.reload(), 1500)
    } catch {
      toast('データの形式が正しくありません')
    }
  }

  const handlePaste = () => {
    navigator.clipboard.readText().then(text => {
      if (text) importFromJson(text)
    }).catch(() => {
      toast('クリップボードの読み取りに失敗しました')
    })
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') importFromJson(reader.result)
    }
    reader.readAsText(file)
  }

  // 現在のデータをエクスポート
  const exportData = () => {
    const data = JSON.stringify({ songs, curId: null }, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'kyokucho_backup.json'
    a.click()
    URL.revokeObjectURL(url)
    toast('バックアップをダウンロードしました')
  }

  return (
    <div
      className="fixed inset-0 bg-black/75 z-[2000] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-bg2 border border-border2 rounded-[18px] p-5 w-full max-w-[460px] max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <span className="font-display text-base font-extrabold text-amber">設定</span>
          <button className="bg-transparent border-none text-text2 cursor-pointer text-lg p-1" onClick={onClose}>✕</button>
        </div>

        {/* Advanced toggle */}
        <button
          className="w-full text-left text-[11px] text-text3 font-mono mb-2 hover:text-text2"
          onClick={() => setShowAdvanced(v => !v)}
        >
          {showAdvanced ? '▾' : '▸'} 詳細設定（開発者向け）
        </button>

        {showAdvanced && <>
        {/* Data import */}
        <div className="bg-bg4 border border-border2 rounded-[10px] p-3.5 mb-3.5">
          <div className="text-[11px] font-bold text-green font-mono mb-2">データ移行・バックアップ</div>
          <div className="text-[10px] text-text3 leading-[1.8] mb-3">
            旧アプリ（HTML版）のデータをインポートできます。<br />
            旧アプリをブラウザで開き、F12 → Console で以下を実行：<br />
            <code className="bg-bg3 px-1.5 py-0.5 rounded text-teal text-[11px]">
              copy(localStorage.getItem('kch_v4'))
            </code><br />
            コピーされたデータを下のボタンで貼り付け。
          </div>
          <div className="flex gap-2 mb-2">
            <button
              className="flex-1 py-2 bg-teal text-bg rounded-lg font-bold text-xs cursor-pointer border-none"
              onClick={handlePaste}
            >
              クリップボードから貼り付け
            </button>
          </div>
          <div className="flex gap-2">
            <button
              className="flex-1 py-2 border border-border2 rounded-lg text-text2 text-xs cursor-pointer bg-transparent hover:border-amber hover:text-amber"
              onClick={() => fileRef.current?.click()}
            >
              ファイルから読み込み
            </button>
            <button
              className="flex-1 py-2 border border-border2 rounded-lg text-text2 text-xs cursor-pointer bg-transparent hover:border-amber hover:text-amber"
              onClick={exportData}
            >
              バックアップ保存
            </button>
          </div>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFile} />
        </div>

        {/* Gemini API Key */}
        <div className="bg-bg4 border border-border2 rounded-[10px] p-3.5 mb-3.5">
          <div className="text-[11px] font-bold text-amber font-mono mb-2">Gemini API キー</div>
          <input
            type="password"
            className="bg-bg3 border border-border2 rounded-lg text-text px-2.5 py-2 text-sm outline-none font-sans w-full mb-2 focus:border-amber"
            placeholder="AIzaSy..."
            value={keyInput || (hasGemini ? '●●●●●●●●●●●●' : '')}
            onChange={e => setKeyInput(e.target.value)}
          />
          <button
            className="w-full py-2 bg-amber text-bg rounded-lg font-bold text-xs cursor-pointer border-none"
            onClick={saveKey}
          >
            保存
          </button>
          <div className="text-[10px] text-text3 mt-2 leading-[1.7]">
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener" className="text-teal">
              Google AI Studio
            </a> でAPIキーを取得してください（無料）
          </div>
        </div>

        {/* Cloud sync status */}
        <div className="bg-bg4 border border-border2 rounded-[10px] p-3.5 mb-3.5">
          <div className="text-[11px] font-bold text-teal font-mono mb-2">クラウド同期</div>
          <div className="text-[10px] text-text3 leading-[1.8]">
            {user ? (
              <>✓ Firestore にリアルタイム同期中<br />アカウント: {user.displayName || user.email}</>
            ) : (
              <>ログインするとクラウドに自動保存されます</>
            )}
          </div>
        </div>
        </>}

        {/* Appearance */}
        <div className="bg-bg4 border border-border2 rounded-[10px] p-3.5 mb-3.5">
          <div className="text-[11px] font-bold text-text2 font-mono mb-2">表示設定</div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] text-text font-sans">テーマ</span>
            <button
              className="px-3 py-1.5 border border-border2 rounded-lg text-[11px] font-mono text-text2 bg-transparent hover:border-amber hover:text-amber"
              onClick={toggleTheme}
            >
              {theme === 'dark' ? 'ダーク' : 'ライト'}
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-text font-sans">言語</span>
            <div className="flex gap-1">
              {LANGS.map(l => (
                <button
                  key={l.code}
                  className={`px-2 py-1 rounded text-[11px] font-mono border
                    ${lang === l.code ? 'bg-amber/15 border-amber text-amber' : 'bg-transparent border-border2 text-text3 hover:border-amber hover:text-amber'}`}
                  onClick={() => setLang(l.code)}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Plan */}
        <div className="bg-bg4 border border-border2 rounded-[10px] p-3.5 mb-3.5">
          <div className="text-[11px] font-bold text-amber font-mono mb-2">プラン</div>
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-sm font-bold text-text font-sans">{currentPlanDef?.name || '無料プラン'}</div>
              <div className="text-[10px] text-text3 font-mono">{currentPlanDef?.priceLabel || '¥0'}</div>
            </div>
            <button
              className="px-3 py-1.5 border border-amber rounded-lg text-amber text-[11px] font-bold bg-transparent hover:bg-amber/10"
              onClick={() => setPlanOpen(true)}
            >
              プランを変更
            </button>
          </div>
          {user && (
            <div className="text-[10px] text-text3 font-mono space-y-0.5">
              <div>AI提案: {usage.proposals}/{currentPlanDef?.limits.proposals === -1 ? '∞' : currentPlanDef?.limits.proposals} 回（今日）</div>
              <div>AI伴奏: {usage.accompGen}/{currentPlanDef?.limits.accompGen === -1 ? '∞' : currentPlanDef?.limits.accompGen} 回（今日）</div>
            </div>
          )}
        </div>

        {user && (
          <button
            className="w-full py-2 mb-3 border border-border2 rounded-lg text-[11px] text-text3 bg-transparent hover:border-coral hover:text-coral font-sans"
            onClick={() => { import('firebase/auth').then(m => m.signOut(auth)); onClose() }}
          >
            ログアウト
          </button>
        )}

        <div className="text-[10px] text-text3 text-center font-mono space-y-1">
          <div className="flex gap-3 justify-center">
            <a href="/terms.html" target="_blank" className="text-text3 hover:text-amber">利用規約</a>
            <a href="/privacy.html" target="_blank" className="text-text3 hover:text-amber">プライバシー</a>
            <a href="/legal.html" target="_blank" className="text-text3 hover:text-amber">特商法表記</a>
          </div>
          <div>曲帳 v3.0</div>
        </div>

        <PlanModal open={planOpen} onClose={() => setPlanOpen(false)} currentPlan={plan} />
      </div>
    </div>
  )
}
