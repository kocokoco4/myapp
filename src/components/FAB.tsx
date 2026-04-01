import { useState, useRef, useEffect } from 'react'
import { useStore } from '../store'
import { TABS } from '../constants'
import type { TabId } from '../types'

export default function FAB() {
  const { curTab, switchTab } = useStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  return (
    <div
      ref={ref}
      className="md:hidden fixed bottom-[calc(20px+env(safe-area-inset-bottom,0px))] right-4 z-[600]"
    >
      {open && (
        <div className="absolute bottom-[60px] right-0 bg-bg2 border border-border2 rounded-[14px] p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] min-w-[150px]">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`
                flex items-center gap-2.5 px-3.5 py-2.5 rounded-[9px] cursor-pointer text-[13px]
                font-sans border-none w-full whitespace-nowrap
                ${t.id === curTab
                  ? 'bg-bg4 text-amber'
                  : 'bg-transparent text-text2 active:bg-bg4 active:text-amber'}
              `}
              onClick={() => { switchTab(t.id as TabId); setOpen(false) }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      )}
      <button
        className="w-[52px] h-[52px] rounded-full bg-amber border-none text-bg cursor-pointer shadow-[0_4px_16px_rgba(0,0,0,0.4)] flex items-center justify-center active:scale-90 transition-transform"
        onClick={() => setOpen(!open)}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="14" y2="18"/></svg>
      </button>
    </div>
  )
}
