export interface MelNote {
  pitch: string
  duration: string
  startBeat: number
  syllable?: string
}

export interface Measure {
  id: string
  chord: string
  melNotes: MelNote[]
}

export interface Section {
  id: string
  name: string
  lyrics: string
  measures: Measure[]
}

export interface DrumPattern {
  HH?: number[]
  SD?: number[]
  BD?: number[]
  CY?: number[]
}

export interface DrumMeasure {
  chord?: string
  pattern: DrumPattern
}

export interface AccompMeasure {
  chord?: string
  notes?: MelNote[]
  rh?: MelNote[]
  lh?: MelNote[]
}

export interface AccompSection {
  sectionName?: string
  name?: string
  measures: (AccompMeasure | DrumMeasure)[]
}

export interface AccompInstrument {
  sections: AccompSection[]
}

export interface Accomp {
  piano?: AccompInstrument
  bass?: AccompInstrument
  guitar?: AccompInstrument
  drums?: AccompInstrument
}

export interface TimeSignature {
  beats: number   // 分子（1小節の拍数）
  value: number   // 分母（1拍の音価: 4=四分, 8=八分）
}

export interface Song {
  id: string
  title: string
  status: string
  key: string
  tempo: number
  timeSig?: TimeSignature
  lyrics: string
  memo: string
  sections: Section[]
  selInstrs: string[]
  accomp: Accomp | null
  createdAt: number
  updatedAt: number
}

export type TabId = 'compose' | 'arrange' | 'ai' | 'dict'

export type UserLevel = 'beginner' | 'intermediate' | 'advanced'

export interface CustomProgression {
  id: string
  name: string
  chords: string[]
  key?: string
  tags?: string[]
  createdAt: number
}

export interface TabDef {
  id: TabId
  label: string
  icon: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}
