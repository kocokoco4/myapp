import type { TabDef } from './types'

export const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export const STATUSES = ['アイデア', '作詞中', '作曲中', '録音中', '完成'] as const

export const STATUS_COLORS: Record<string, string> = {
  'アイデア': '#64748b',
  '作詞中': '#3b82f6',
  '作曲中': '#9060e8',
  '録音中': '#e8a020',
  '完成': '#50c878',
}

export const DEFAULT_SECTIONS = ['イントロ', 'Aメロ', 'Bメロ', 'サビ', 'アウトロ']

export const CHORD_LIST = [
  ['C', 'CM7', 'C7', 'Cm', 'Cm7', 'Cadd9'],
  ['D', 'DM7', 'D7', 'Dm', 'Dm7', 'D/F#'],
  ['E', 'EM7', 'E7', 'Em', 'Em7'],
  ['F', 'FM7', 'F7', 'Fm', 'Fm7', 'F/A'],
  ['G', 'GM7', 'G7', 'Gm', 'Gm7', 'G/B'],
  ['A', 'AM7', 'A7', 'Am', 'Am7', 'A/C#'],
  ['B', 'BM7', 'B7', 'Bm', 'Bm7'],
  ['F#', 'F#m', 'Bb', 'Eb', 'Ab', 'Db'],
]

export const QUICK_PROGRESSIONS = [
  { label: '王道進行', chords: ['C', 'G', 'Am', 'F'] },
  { label: '小室進行', chords: ['Am', 'F', 'G', 'C'] },
  { label: 'カノン', chords: ['C', 'G', 'Am', 'Em', 'F', 'C', 'F', 'G'] },
  { label: '暗い系', chords: ['Am', 'G', 'F', 'E'] },
  { label: '4-5-3-6', chords: ['F', 'G', 'Em', 'Am'] },
]

export const INSTRUMENTS: Record<string, { label: string; color: string }> = {
  piano: { label: 'ピアノ', color: '#9060e8' },
  bass: { label: 'ベース', color: '#3b82f6' },
  guitar: { label: 'ギター', color: '#e8a020' },
  drums: { label: 'ドラム', color: '#e05050' },
}

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
export const OCTAVES = [3, 4, 5]

export const DURATIONS = [
  { value: 'w', label: '𝅝 全', beats: 4 },
  { value: 'dh', label: '𝅗𝅥· 付2分', beats: 3 },
  { value: 'h', label: '𝅗𝅥 2分', beats: 2 },
  { value: 'dq', label: '♩· 付4分', beats: 1.5 },
  { value: 'q', label: '♩ 4分', beats: 1 },
  { value: 'd8', label: '♪· 付8分', beats: 0.75 },
  { value: '8', label: '♪ 8分', beats: 0.5 },
  { value: '16', label: '♬ 16分', beats: 0.25 },
  { value: '32', label: '𝅘𝅥𝅰 32分', beats: 0.125 },
  { value: 'tq', label: '3連♩', beats: 2 / 3 },
  { value: 't8', label: '3連♪', beats: 1 / 3 },
]

export const DURATION_BEATS: Record<string, number> = {
  w: 4, dh: 3, h: 2, dq: 1.5, q: 1, d8: 0.75, '8': 0.5, '16': 0.25, '32': 0.125, tq: 2 / 3, t8: 1 / 3,
}

export const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11]

export const TIME_SIGNATURES = [
  { label: '4/4', beats: 4, value: 4 },
  { label: '3/4', beats: 3, value: 4 },
  { label: '2/4', beats: 2, value: 4 },
  { label: '5/4', beats: 5, value: 4 },
  { label: '6/8', beats: 6, value: 8 },
  { label: '7/8', beats: 7, value: 8 },
  { label: '12/8', beats: 12, value: 8 },
]

/** 拍子から1小節の拍数（四分音符換算）を算出 */
export function beatsPerMeasure(timeSig?: { beats: number; value: number }): number {
  if (!timeSig) return 4 // デフォルト 4/4
  // value=4 → そのままbeats, value=8 → beats/2 (四分音符換算)
  return timeSig.value === 8 ? timeSig.beats / 2 : timeSig.beats
}

export const TABS: TabDef[] = [
  { id: 'compose', label: '制作', icon: '' },
  { id: 'arrange', label: '伴奏・スコア', icon: '' },
  { id: 'ai', label: 'AI相談', icon: '' },
  { id: 'dict', label: '辞典', icon: '' },
]

export const AI_SUGGESTIONS = [
  'Aメロのコード提案して',
  'サビをドラマチックにして',
  '黄昏コード教えて',
  '伴奏アレンジのアドバイス',
]

// [設定エリア] APIキー・エンドポイントはここに集約する
// [ZooLab連携ポイント] 将来: ZooLab API Gateway 経由
export const CONFIG = {
  API_BASE: '',
  GEMINI_MODELS: ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-1.5-flash'],
  STORAGE_KEY: 'kch_v4',
  THEME_KEY: 'kch_theme',
  GEMINI_KEY_ST: 'songbook_gemini_key',
}
