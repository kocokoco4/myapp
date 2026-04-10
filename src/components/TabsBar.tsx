import { useStore } from '../store'
import { TABS } from '../constants'

export default function TabsBar() {
  const { curTab, switchTab, level } = useStore()
  const visibleTabs = TABS.filter(t => {
    if (level === 'beginner' && (t.id === 'arrange')) return false
    return true
  })

  return (
    <div className="flex border-b border-border bg-bg2 shrink-0 overflow-x-auto max-md:hidden [&::-webkit-scrollbar]:h-0">
      {visibleTabs.map(t => (
        <button
          key={t.id}
          className={`
            px-3 py-2.5 bg-transparent border-none cursor-pointer text-[11px] whitespace-nowrap shrink-0
            border-b-2 transition-colors font-sans
            ${t.id === curTab
              ? 'text-amber border-b-amber font-bold'
              : 'text-text2 border-b-transparent hover:text-text'}
          `}
          onClick={() => switchTab(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
