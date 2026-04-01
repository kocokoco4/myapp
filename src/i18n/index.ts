import { createContext, useContext } from 'react'
import ja from './ja.json'
import en from './en.json'
import ko from './ko.json'
import zhTW from './zh-TW.json'

export const LANGS = [
  { code: 'ja', label: '日本語' },
  { code: 'en', label: 'English' },
  { code: 'ko', label: '한국어' },
  { code: 'zh-TW', label: '中文' },
] as const

export type LangCode = (typeof LANGS)[number]['code']

const MESSAGES: Record<string, Record<string, unknown>> = { ja, en, ko, 'zh-TW': zhTW }

export const LANG_STORAGE_KEY = 'kch_lang'

/** Dot-path accessor: t('compose.addNote') → '+ 音' */
function resolve(obj: Record<string, unknown>, path: string): string {
  const parts = path.split('.')
  let cur: unknown = obj
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return path
    cur = (cur as Record<string, unknown>)[p]
  }
  return typeof cur === 'string' ? cur : Array.isArray(cur) ? JSON.stringify(cur) : path
}

export interface I18nContextType {
  lang: LangCode
  t: (key: string) => string
  ta: (key: string) => string[]
  setLang: (lang: LangCode) => void
}

export const I18nContext = createContext<I18nContextType>({
  lang: 'ja',
  t: (key: string) => key,
  ta: () => [],
  setLang: () => {},
})

export function useI18n() {
  return useContext(I18nContext)
}

export function createI18nValue(lang: LangCode, setLang: (l: LangCode) => void): I18nContextType {
  const msgs = MESSAGES[lang] || MESSAGES.ja
  return {
    lang,
    t: (key: string) => resolve(msgs as Record<string, unknown>, key),
    ta: (key: string) => {
      const parts = key.split('.')
      let cur: unknown = msgs
      for (const p of parts) {
        if (cur == null || typeof cur !== 'object') return []
        cur = (cur as Record<string, unknown>)[p]
      }
      return Array.isArray(cur) ? cur as string[] : []
    },
    setLang: (l: LangCode) => {
      localStorage.setItem(LANG_STORAGE_KEY, l)
      setLang(l)
    },
  }
}
