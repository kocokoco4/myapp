import { useState } from 'react'
import { useStore } from '../store'
import { useI18n } from '../i18n'
import { STATUS_COLORS } from '../constants'

interface Props {
  open: boolean
  onClose: () => void
}

export default function Sidebar({ open, onClose }: Props) {
  const { user, songs, curId, addSong, deleteSong, selectSong } = useStore()
  const { t } = useI18n()
  const sorted = [...songs].sort((a, b) => b.updatedAt - a.updatedAt)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  return (
    <>
      {/* Overlay for mobile */}
      <div
        className={`fixed inset-0 bg-black/50 z-[799] md:hidden ${open ? 'block' : 'hidden'}`}
        onClick={onClose}
      />
      <aside
        className={`
          w-[230px] bg-bg2 border-r border-border flex flex-col shrink-0
          pb-[env(safe-area-inset-bottom,0px)]
          max-md:fixed max-md:top-0 max-md:left-0 max-md:h-screen max-md:z-[800]
          max-md:shadow-[4px_0_24px_rgba(0,0,0,0.6)]
          max-md:transition-transform max-md:duration-300 max-md:ease-[cubic-bezier(0.4,0,0.2,1)]
          ${open ? 'max-md:translate-x-0' : 'max-md:-translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="px-3.5 py-4 pb-3 border-b border-border flex items-center gap-2">
          <div>
            <span className="font-display text-[17px] font-extrabold text-amber">{t('app.name')}</span>
            <small className="block text-text2 text-xs -mt-0.5">{t('app.subtitle')}</small>
          </div>
          <button
            className="ml-auto px-2 py-1 text-xs border border-border2 rounded-lg text-text2 bg-transparent hover:border-amber hover:text-amber md:hidden"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* New song button */}
        <button
          className="mx-2.5 my-2.5 py-2 bg-amber text-bg rounded-[10px] font-bold text-xs cursor-pointer font-sans hover:bg-amber2"
          onClick={addSong}
        >
          {t('app.newSong')}
        </button>

        {/* User info */}
        {user && (
          <div className="px-2.5 py-1.5 border-b border-border">
            <span className="text-[11px] text-teal font-mono truncate block">
              {user.displayName || user.email}
            </span>
          </div>
        )}

        {/* Song list */}
        <div className="flex-1 overflow-y-auto px-2 py-1">
          {sorted.length === 0 ? (
            <p className="text-text3 text-[11px] text-center mt-4 font-mono">{t('sidebar.empty')}</p>
          ) : sorted.map(s => (
            <div
              key={s.id}
              className={`
                px-2.5 py-2 rounded-[10px] cursor-pointer relative mb-0.5 border transition-colors
                ${s.id === curId ? 'bg-bg4 border-border2' : 'border-transparent hover:bg-bg3'}
              `}
              onClick={() => { selectSong(s.id); onClose() }}
            >
              <div className={`text-xs font-semibold truncate mb-1 ${s.id === curId ? 'text-text' : 'text-text2'}`}>
                {s.title}
              </div>
              <span
                className="text-[11px] px-1.5 py-px rounded-full font-bold font-mono inline-block"
                style={{
                  background: STATUS_COLORS[s.status] + '18',
                  color: STATUS_COLORS[s.status],
                }}
              >
                {s.status}
              </span>
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-transparent border-none text-text3 cursor-pointer text-sm p-1 opacity-0 hover:opacity-100 group-hover:opacity-100"
                onClick={e => { e.stopPropagation(); setConfirmId(s.id) }}
                style={{ opacity: undefined }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {/* Delete confirmation */}
        {confirmId && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50" onClick={() => setConfirmId(null)}>
            <div className="bg-bg3 border border-border2 rounded-2xl p-5 max-w-[280px] w-full shadow-lg" onClick={e => e.stopPropagation()}>
              <p className="text-text text-sm mb-4 font-sans leading-relaxed">
                「{songs.find(s => s.id === confirmId)?.title}」{t('sidebar.deleteSong')}<br/>{t('sidebar.cannotUndo')}
              </p>
              <div className="flex gap-2">
                <button
                  className="flex-1 py-2 rounded-lg text-sm border border-border2 text-text2 bg-transparent hover:bg-bg4 font-sans"
                  onClick={() => setConfirmId(null)}
                >
                  {t('compose.cancel')}
                </button>
                <button
                  className="flex-1 py-2 rounded-lg text-sm border border-coral text-coral bg-coral/10 hover:bg-coral/20 font-sans font-bold"
                  onClick={() => { deleteSong(confirmId); setConfirmId(null) }}
                >
                  {t('compose.delete')}
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  )
}
