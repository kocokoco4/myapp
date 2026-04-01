/**
 * 雰囲気ベース伴奏テンプレート
 * 4つのカテゴリの組み合わせからBPM・キー・コード進行・リズム感を決定する
 */

export const MOOD_CATEGORIES = {
  emotion: {
    label: '感情',
    options: ['泣きたい夜', '前を向く朝', '胸がざわざわする', 'ほっとする', 'ときめいてる', '怒ってる'],
  },
  scene: {
    label: '景色',
    options: ['雨の窓際', '夏の終わり', '冬の帰り道', '夜の街', '朝の光', '懐かしい場所'],
  },
  energy: {
    label: 'テンション',
    options: ['静かに燃えてる', '叫びたい', 'ゆっくり歌いたい', '踊りたい'],
  },
  relation: {
    label: '関係性',
    options: ['好きな人へ', '遠くなった人へ', '自分へ', '誰かへ'],
  },
} as const

export type MoodCategory = keyof typeof MOOD_CATEGORIES

export interface MoodSelection {
  emotion: string
  scene: string
  energy: string
  relation: string
}

// ─── 雰囲気からパラメータを導出 ─── //

interface TemplateParams {
  bpm: number
  key: string
  style: string
  sections: { name: string; chords: string[] }[]
}

const TEMPO_MAP: Record<string, number> = {
  '静かに燃えてる': 80,
  '叫びたい': 155,
  'ゆっくり歌いたい': 72,
  '踊りたい': 125,
}

const KEY_MAP: Record<string, string[]> = {
  '泣きたい夜': ['Am', 'Dm', 'Em'],
  '前を向く朝': ['C', 'G', 'D'],
  '胸がざわざわする': ['Fm', 'Gm', 'Cm'],
  'ほっとする': ['F', 'C', 'G'],
  'ときめいてる': ['D', 'A', 'E'],
  '怒ってる': ['Em', 'Am', 'Bm'],
}

// コード進行テンプレート（マイナー系/メジャー系）
const PROGRESSIONS_MINOR: Record<string, string[][]> = {
  '泣きたい夜': [
    ['Am', 'F', 'C', 'G'],
    ['Am', 'G', 'F', 'E'],
  ],
  '胸がざわざわする': [
    ['Am', 'B7', 'Em', 'Am'],
    ['Dm', 'Am', 'E', 'Am'],
  ],
  '怒ってる': [
    ['Em', 'C', 'D', 'Em'],
    ['Am', 'G', 'F', 'E'],
  ],
}

const PROGRESSIONS_MAJOR: Record<string, string[][]> = {
  '前を向く朝': [
    ['C', 'G', 'Am', 'F'],
    ['G', 'D', 'Em', 'C'],
  ],
  'ほっとする': [
    ['F', 'C', 'G', 'Am'],
    ['C', 'Am', 'F', 'G'],
  ],
  'ときめいてる': [
    ['D', 'A', 'Bm', 'G'],
    ['A', 'E', 'F#m', 'D'],
  ],
}

// 景色によるコード進行の調整
const SCENE_FLAVOR: Record<string, { addSus?: boolean; addM7?: boolean; darker?: boolean }> = {
  '雨の窓際': { addM7: true, darker: true },
  '夏の終わり': { addM7: true },
  '冬の帰り道': { addSus: true, darker: true },
  '夜の街': { addM7: true },
  '朝の光': { addSus: true },
  '懐かしい場所': { addM7: true },
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function applyFlavor(chord: string, flavor: { addSus?: boolean; addM7?: boolean }): string {
  // Don't modify minor chords or chords that already have extensions
  if (chord.includes('m') || chord.includes('7') || chord.includes('sus') || chord.includes('add')) return chord
  if (flavor.addM7 && Math.random() > 0.5) return chord + 'M7'
  if (flavor.addSus && Math.random() > 0.7) return chord + 'sus4'
  return chord
}

export function generateTemplate(mood: MoodSelection): TemplateParams {
  // BPM: テンション × 景色で微調整
  let bpm = TEMPO_MAP[mood.energy] || 100
  if (mood.scene === '雨の窓際' || mood.scene === '冬の帰り道') bpm = Math.max(65, bpm - 10)
  if (mood.scene === '夏の終わり' || mood.scene === '朝の光') bpm = Math.min(180, bpm + 5)

  // KEY: 感情から候補を選出
  const keyCandidates = KEY_MAP[mood.emotion] || ['C', 'Am']
  const key = pickRandom(keyCandidates)

  // コード進行: 感情（マイナー/メジャー）から選出
  const isMinor = ['泣きたい夜', '胸がざわざわする', '怒ってる'].includes(mood.emotion)
  const progPool = isMinor
    ? PROGRESSIONS_MINOR[mood.emotion] || [['Am', 'F', 'C', 'G']]
    : PROGRESSIONS_MAJOR[mood.emotion] || [['C', 'G', 'Am', 'F']]

  const flavor = SCENE_FLAVOR[mood.scene] || {}
  const baseVerse = pickRandom(progPool).map(c => applyFlavor(c, flavor))
  const baseChorus = pickRandom(progPool).map(c => applyFlavor(c, flavor))

  // セクション構成
  const sections = [
    { name: 'イントロ', chords: baseVerse },
    { name: 'Aメロ', chords: [...baseVerse, ...baseVerse] },
    { name: 'Bメロ', chords: baseChorus.map(c => c.replace('m7', 'm').replace('M7', '')) },
    { name: 'サビ', chords: [...baseChorus, ...baseChorus] },
  ]

  // スタイル（Geminiに渡すヒント）
  const style = `${mood.emotion}・${mood.scene}・${mood.energy}・${mood.relation}`

  return { bpm, key, style, sections }
}

// Geminiに送るプロンプト用の雰囲気テキスト
export function moodPromptText(mood: MoodSelection): string {
  return `この曲の雰囲気: ${mood.emotion}、${mood.scene}、${mood.energy}、${mood.relation}`
}

// タイトル・キャッチコピー生成用のプロンプト
export function titlePrompt(mood: MoodSelection): string {
  return `あなたはJ-POP・邦楽の作詞家です。以下の雰囲気から、日本語の曲タイトルとキャッチコピーを考えてください。

ルール:
- タイトルは3〜8文字程度。直接的すぎない、詩的で余韻のある表現にする
- 雰囲気のキーワードをそのまま使わない（「泣きたい夜」→×「泣きたい夜に」）
- 比喩、情景描写、感覚的な言葉を使う（例：「月が溶ける」「砂時計の午後」「透明な嘘」）
- キャッチコピーは曲の世界観を一文で表現する

雰囲気:
- 感情: ${mood.emotion}
- 景色: ${mood.scene}
- テンション: ${mood.energy}
- 関係性: ${mood.relation}

以下のJSON形式のみで返答してください（説明不要）:
{"title": "曲タイトル", "catchphrase": "一行のキャッチコピー"}`
}
