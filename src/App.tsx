import { useState, useCallback, useMemo } from 'react'
import { StoreProvider, useStore } from './store'
import { I18nContext, createI18nValue, LANG_STORAGE_KEY, type LangCode } from './i18n'
import FinchAvatar from './components/FinchAvatar'
import LoginScreen from './components/LoginScreen'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import TabsBar from './components/TabsBar'
import FAB from './components/FAB'
import SettingsModal from './components/SettingsModal'
import ComposeTab from './components/ComposeTab'
import ArrangeTab from './components/ArrangeTab'
import AIChat from './components/AIChat'
import DictTab from './components/DictTab'
import BeginnerCompose from './components/BeginnerCompose'
import LevelSelect from './components/LevelSelect'

function AppContent() {
  const { user, currentSong, curTab, addSong, level } = useStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const song = currentSong()

  const toggleSidebar = useCallback(() => setSidebarOpen(v => !v), [])
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])
  const openSettings = useCallback(() => setSettingsOpen(true), [])
  const closeSettings = useCallback(() => setSettingsOpen(false), [])

  const renderTab = () => {
    switch (curTab) {
      case 'compose': return level === 'beginner' ? <BeginnerCompose /> : <ComposeTab />
      case 'arrange': return <ArrangeTab onOpenSettings={openSettings} />
      case 'ai': return <AIChat onOpenSettings={openSettings} />
      case 'dict': return <DictTab />
    }
  }

  // 未ログイン → ログイン画面
  if (!user) return <LoginScreen />

  // レベル未選択 → レベル選択画面
  if (!level) return <LevelSelect />

  return (
    <div className="flex h-screen" id="app">
      <Sidebar open={sidebarOpen} onClose={closeSidebar} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0" id="main">
        {song ? (
          <>
            <TopBar onMenuClick={toggleSidebar} onOpenSettings={openSettings} />
            <TabsBar />
            <div className="flex-1 overflow-y-auto p-4 max-md:p-3 max-md:pb-20">
              {renderTab()}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <FinchAvatar size={64} mood="wave" />
            <div className="text-[13px] font-semibold text-text2">最初の曲を作りましょう</div>
            <button
              className="px-4 py-2 bg-amber text-bg rounded-lg font-bold text-xs cursor-pointer border-none"
              onClick={addSong}
            >
              最初の曲を作る
            </button>
          </div>
        )}
      </div>

      <FAB />
      <div id="toast" />
      <SettingsModal open={settingsOpen} onClose={closeSettings} />
    </div>
  )
}

export default function App() {
  const [lang, setLang] = useState<LangCode>(() => (localStorage.getItem(LANG_STORAGE_KEY) as LangCode) || 'ja')
  const i18n = useMemo(() => createI18nValue(lang, setLang), [lang])

  return (
    <I18nContext.Provider value={i18n}>
      <StoreProvider>
        <AppContent />
      </StoreProvider>
    </I18nContext.Provider>
  )
}
