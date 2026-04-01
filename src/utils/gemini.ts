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
      return (result.data as { text: string }).text
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      // Cloud Functions未デプロイの場合はフォールバック
      if (!msg.includes('NOT_FOUND') && !msg.includes('internal')) throw e
    }
  }

  // フォールバック: ローカルAPIキー（開発用）
  const key = getGeminiKey()
  if (!key) throw new Error('NO_KEY')

  const body = {
    system_instruction: { parts: [{ text: systemText }] },
    contents: messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    generationConfig: { maxOutputTokens: maxTokens },
  }

  for (const model of CONFIG.GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const d = await r.json()
    if (d.error && (d.error.code === 404 || d.error.message?.includes('not found'))) continue
    if (d.error) throw new Error(d.error.message)
    return d.candidates?.[0]?.content?.parts?.[0]?.text || ''
  }
  throw new Error('利用可能なGeminiモデルが見つかりません')
}
