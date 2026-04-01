import { useState, useRef, useEffect } from 'react'
import { useStore } from '../store'
import { STATUSES, STATUS_COLORS } from '../constants'
import { Menu, Settings, RefreshCw, Bell } from 'lucide-react'
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore'
import { db } from '../firebase'

interface Props {
  onMenuClick: () => void
  onOpenSettings: () => void
}

export default function TopBar({ onMenuClick, onOpenSettings }: Props) {
  const { currentSong, saveOnly, updateSong } = useStore()
  const [dropOpen, setDropOpen] = useState(false)
  const [hasUpdate, setHasUpdate] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [announcements, setAnnouncements] = useState<{ id: string; title: string; body: string; date: string }[]>([])
  const [bellOpen, setBellOpen] = useState(false)
  const [bellRead, setBellRead] = useState(() => localStorage.getItem('kch_bell_read') || '')
  const dropRef = useRef<HTMLDivElement>(null)
  const bellRef = useRef<HTMLDivElement>(null)
  const song = currentSong()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropOpen(false)
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  // Load announcements from Firestore
  useEffect(() => {
    getDocs(query(collection(db, 'announcements'), orderBy('date', 'desc'), limit(5)))
      .then(snap => {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as { id: string; title: string; body: string; date: string }))
        setAnnouncements(items)
      })
      .catch(() => {})
  }, [])

  // Check for new version every 60s by fetching index.html and comparing ETag
  useEffect(() => {
    let etag = ''
    const check = async () => {
      try {
        const res = await fetch('/', { method: 'HEAD', cache: 'no-cache' })
        const newEtag = res.headers.get('etag') || ''
        if (etag && newEtag && etag !== newEtag) setHasUpdate(true)
        if (newEtag) etag = newEtag
      } catch { /* offline */ }
    }
    check()
    const id = setInterval(check, 60_000)
    return () => clearInterval(id)
  }, [])

  if (!song) return null

  return (
    <div className="px-3.5 py-2.5 border-b border-border flex items-center gap-2.5 bg-bg2 shrink-0">
      <button
        className="p-1.5 text-sm border border-border2 rounded-lg text-text2 bg-transparent hover:border-amber hover:text-amber shrink-0"
        onClick={onMenuClick}
      >
        <Menu size={16} />
      </button>

      <input
        className="bg-transparent border-none text-text font-display text-base font-bold flex-1 outline-none min-w-0"
        placeholder="曲タイトル"
        value={song.title}
        onChange={e => saveOnly(s => { s.title = e.target.value })}
      />

      {/* Status dropdown */}
      <div className="relative shrink-0" ref={dropRef}>
        <button
          className="px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer border font-mono whitespace-nowrap"
          style={{
            background: STATUS_COLORS[song.status] + '22',
            borderColor: STATUS_COLORS[song.status] + '66',
            color: STATUS_COLORS[song.status],
          }}
          onClick={() => setDropOpen(!dropOpen)}
        >
          {song.status}
        </button>
        {dropOpen && (
          <div className="absolute right-0 top-[calc(100%+5px)] bg-bg3 border border-border2 rounded-[10px] z-[300] overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.6)] min-w-24">
            {STATUSES.map(st => (
              <div
                key={st}
                className="px-3.5 py-2 cursor-pointer text-[11px] font-bold font-mono hover:bg-bg4"
                style={{ color: STATUS_COLORS[st] }}
                onClick={() => { updateSong(s => { s.status = st }); setDropOpen(false) }}
              >
                {st}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Announcements bell */}
      <div className="relative shrink-0" ref={bellRef}>
        <button
          className="p-1.5 text-sm border border-border2 rounded-lg text-text2 bg-transparent hover:border-amber hover:text-amber relative"
          onClick={() => {
            setBellOpen(v => !v)
            if (announcements[0]) {
              localStorage.setItem('kch_bell_read', announcements[0].id)
              setBellRead(announcements[0].id)
            }
          }}
        >
          <Bell size={14} />
          {announcements.length > 0 && bellRead !== announcements[0]?.id && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-coral rounded-full border-2 border-bg2" />
          )}
        </button>
        {bellOpen && (
          <div className="absolute right-0 top-[calc(100%+5px)] bg-bg3 border border-border2 rounded-xl z-[300] shadow-[0_12px_40px_rgba(0,0,0,0.6)] w-[260px] max-h-[300px] overflow-y-auto">
            {announcements.length === 0 ? (
              <div className="px-4 py-6 text-center text-text3 text-[12px] font-sans">お知らせはありません</div>
            ) : announcements.map(a => (
              <div key={a.id} className="px-3.5 py-2.5 border-b border-border last:border-none">
                <div className="text-[12px] font-bold text-text font-sans">{a.title}</div>
                <div className="text-[11px] text-text3 font-sans mt-0.5 leading-relaxed">{a.body}</div>
                <div className="text-[10px] text-text3/50 font-mono mt-1">{a.date}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        className={`p-1.5 text-sm border rounded-lg bg-transparent shrink-0 relative
          ${hasUpdate
            ? 'border-teal text-teal hover:bg-teal/10'
            : 'border-border2 text-text3 hover:border-text2 hover:text-text2'}`}
        onClick={() => { setRefreshing(true); location.reload() }}
        title={hasUpdate ? '新しいバージョンがあります — タップで更新' : 'アプリを更新'}
      >
        <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
        {hasUpdate && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-teal rounded-full border-2 border-bg2 animate-pulse" />
        )}
      </button>

      <button
        className="p-1.5 text-sm border border-border2 rounded-lg text-text2 bg-transparent hover:border-amber hover:text-amber shrink-0"
        onClick={onOpenSettings}
        title="設定"
      >
        <Settings size={16} />
      </button>
    </div>
  )
}
