import { CONFIG } from '../constants'
import { httpsCallable } from 'firebase/functions'
import { functions, auth } from '../firebase'

// [ZooLab連携ポイント] AI API呼び出しは Cloud Functions 経由
// ログイン済み → Cloud Functions (APIキー不要)
// 未ログイン/開発用 → ローカルAPIキーでフォールバック

export function getGeminiKey(): string {
  return localStorage.getItem(CONFIG.GEMINI_KEY_ST) || ''
}

export function setGeminiKey(key: string): void {
  localStorage.setItem(CONFIG.GEMINI_KEY_ST, key)
}

interface Message {
  role: string
  content: string
}

export async function callGemini(systemText: string, messages: Message[], maxTokens = 800, feature = 'proposals'): Promise<string> {
  // Cloud Functions経由（ログイン済みの場合）
  if (auth.currentUser) {
    try {
      const callAI = httpsCallable(functions, 'callAI')
      const result = await callAI({ systemText, messages, maxTokens, feature })
      const text = (result.data as { text: string }).text
      if (text) return text
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.warn('Cloud Functions callAI failed, falling back to local:', msg)
      // 使用量制限エラーの場合はユーザーに表示
      if (msg.includes('resource-exhausted') || msg.includes('上限')) {
        throw new Error('本日のAI利用回数の上限に達しました。プランをアップグレードしてください')
      }
      // それ以外はローカルフォールバック
    }
  }

  // フォールバック: ローカルAPIキー（動的モデル選択）
  const key = getGeminiKey()
  if (!key) throw new Error('NO_KEY')

  const model = await resolveModel(key)

  const isThinking = model.includes('2.5')
  const genConfig: Record<string, unknown> = {
    maxOutputTokens: isThinking ? Math.max(maxTokens, 8192) : maxTokens,
  }
  if (isThinking) {
    genConfig.thinkingConfig = { thinkingBudget: 1024 }
  }

  const body = {
    system_instruction: { parts: [{ text: systemText }] },
    contents: messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    generationConfig: genConfig,
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const d = await r.json()
  if (d.error) {
    // モデルが死んだらキャッシュクリアして再試行
    localStorage.removeItem(MODEL_CACHE_KEY)
    throw new Error(d.error.message)
  }
  return d.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

// ─── 動的モデル選択（CLAUDE.md 絶対ルール6） ─── //

const MODEL_CACHE_KEY = 'kch_gemini_model'
const MODEL_CACHE_TTL = 24 * 60 * 60 * 1000 // 24h

// 優先順位: 2.5-flash → 2.0-flash-001 → flash-latest
// 注意: gemini-2.0-flash（無印）は除外
const MODEL_PRIORITY = ['gemini-2.5-flash', 'gemini-2.0-flash-001', 'gemini-flash-latest']

async function resolveModel(key: string): Promise<string> {
  // キャッシュ確認
  try {
    const cached = JSON.parse(localStorage.getItem(MODEL_CACHE_KEY) || '{}')
    if (cached.model && cached.ts && Date.now() - cached.ts < MODEL_CACHE_TTL) {
      return cached.model
    }
  } catch { /* ignore */ }

  // Step 1: ListModels APIでgenerateContent対応モデルを取得
  const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
  const listRes = await fetch(listUrl)
  const listData = await listRes.json()
  const available = (listData.models || [])
    .filter((m: { supportedGenerationMethods?: string[] }) =>
      m.supportedGenerationMethods?.includes('generateContent'))
    .map((m: { name: string }) => m.name.replace('models/', ''))

  // Step 2: 優先順位で候補を絞り、テスト呼び出しで検証
  for (const candidate of MODEL_PRIORITY) {
    if (!available.includes(candidate)) continue
    // テスト呼び出し
    const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/${candidate}:generateContent?key=${key}`
    const isThinking = candidate.includes('2.5')
    const testBody: Record<string, unknown> = {
      contents: [{ role: 'user', parts: [{ text: 'test' }] }],
      generationConfig: {
        maxOutputTokens: isThinking ? 8192 : 1,
        ...(isThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      },
    }
    try {
      const testRes = await fetch(testUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testBody),
      })
      const testData = await testRes.json()
      if (!testData.error) {
        // 成功 → キャッシュして返す
        localStorage.setItem(MODEL_CACHE_KEY, JSON.stringify({ model: candidate, ts: Date.now() }))
        return candidate
      }
    } catch { /* next */ }
  }

  throw new Error('利用可能なGeminiモデルが見つかりません')
}
