import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc, writeBatch } from 'firebase/firestore'
import { auth, db } from './firebase'
import type { Song, TabId, ChatMessage, UserLevel } from './types'
import { DEFAULT_SECTIONS, CONFIG } from './constants'
import { gid } from './utils/id'
import { getUserPlan, getTodayUsage, type PlanId } from './utils/plan'
import FinchAvatar from './components/FinchAvatar'

// [ZooLab連携ポイント] データ管理は Firestore 経由
// 将来: POST /api/zoolab/kyokucho/songs

function mkSong(title = '新しい曲'): Song {
  return {
    id: gid(),
    title,
    status: 'アイデア',
    key: 'C',
    tempo: 120,
    lyrics: '',
    memo: '',
    sections: DEFAULT_SECTIONS.map(name => ({
      id: gid(),
      name,
      lyrics: '',
      measures: Array(4).fill(0).map(() => ({ id: gid(), chord: '', melNotes: [] })),
    })),
    selInstrs: ['piano', 'bass', 'drums'],
    accomp: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

function loadLocal(): { songs: Song[]; curId: string | null } {
  try {
    const d = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '{}')
    return { songs: d.songs || [], curId: d.curId || null }
  } catch {
    return { songs: [], curId: null }
  }
}

/* ─── Firestore helpers ─── */

// ユーザーの曲コレクション参照
function songsCol(uid: string) {
  return collection(db, 'users', uid, 'songs')
}

// ユーザーメタ（curId等）参照
function userDoc(uid: string) {
  return doc(db, 'users', uid)
}

// Firestoreから全曲を読み込み
async function loadFromFirestore(uid: string): Promise<{ songs: Song[]; curId: string | null } | null> {
  const metaSnap = await getDoc(userDoc(uid))
  const songsSnap = await getDocs(songsCol(uid))

  if (songsSnap.empty && !metaSnap.exists()) return null

  // 新スキーマ（サブコレクション）にデータがある場合
  if (!songsSnap.empty) {
    const songs = songsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Song))
    songs.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    const curId = metaSnap.exists() ? (metaSnap.data().curId || songs[0]?.id || null) : (songs[0]?.id || null)
    return { songs, curId }
  }

  // 旧スキーマ（単一ドキュメント）からのマイグレーション
  if (metaSnap.exists()) {
    const d = metaSnap.data()
    if (d.songs && Array.isArray(d.songs) && d.songs.length > 0) {
      // 旧データをサブコレクションに移行
      const batch = writeBatch(db)
      for (const s of d.songs) {
        batch.set(doc(songsCol(uid), s.id), s)
      }
      // メタドキュメントを curId のみに更新（songs配列を除去）
      batch.set(userDoc(uid), { curId: d.curId || d.songs[0]?.id || null })
      await batch.commit()
      const songs = d.songs as Song[]
      return { songs, curId: d.curId || songs[0]?.id || null }
    }
  }

  return null
}

// 1曲をFirestoreに保存（debounce用）
const songTimers: Record<string, ReturnType<typeof setTimeout>> = {}

function saveSongToFirestore(uid: string, song: Song) {
  if (songTimers[song.id]) clearTimeout(songTimers[song.id])
  songTimers[song.id] = setTimeout(async () => {
    try {
      await setDoc(doc(songsCol(uid), song.id), song)
    } catch (e) {
      console.error('Firestore save error:', e)
    }
  }, 1000)
}

function saveCurIdToFirestore(uid: string, curId: string | null) {
  // curIdの保存は即座に（軽量なので）
  setDoc(userDoc(uid), { curId }, { merge: true }).catch(e => console.error('Firestore curId save error:', e))
}

/* ─── Store ─── */

interface StoreContextType {
  user: User | null
  authLoading: boolean
  songs: Song[]
  curId: string | null
  curTab: TabId
  aiHist: ChatMessage[]
  theme: string
  plan: PlanId
  level: UserLevel
  setPlan: (p: PlanId) => void
  setLevel: (l: UserLevel) => void
  usage: { proposals: number; accompGen: number }
  refreshUsage: () => void
  currentSong: () => Song | undefined
  addSong: () => void
  deleteSong: (id: string) => void
  selectSong: (id: string) => void
  updateSong: (fn: (s: Song) => void) => void
  saveOnly: (fn: (s: Song) => void) => void
  switchTab: (tab: TabId) => void
  setAiHist: React.Dispatch<React.SetStateAction<ChatMessage[]>>
  toggleTheme: () => void
  toast: (msg: string) => void
}

const StoreContext = createContext<StoreContextType>(null!)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [data, setData] = useState<{ songs: Song[]; curId: string | null }>({ songs: [], curId: null })
  const [dataLoaded, setDataLoaded] = useState(false)
  const [curTab, setCurTab] = useState<TabId>('compose')
  const [aiHist, setAiHist] = useState<ChatMessage[]>([])
  const [theme, setTheme] = useState(() => localStorage.getItem(CONFIG.THEME_KEY) || 'dark')
  const [plan, setPlanState] = useState<PlanId>('free')
  const [level, setLevelState] = useState<UserLevel>(() => (localStorage.getItem('kch_level') as UserLevel) || 'advanced')
  const [usage, setUsage] = useState({ proposals: 0, accompGen: 0 })

  // Auth state listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setAuthLoading(false)
    })
    return unsub
  }, [])

  // Load data when user changes
  useEffect(() => {
    if (authLoading) return

    const loadData = async () => {
      if (user) {
        // ログイン済み → Firestoreから読み込み
        try {
          const result = await loadFromFirestore(user.uid)
          if (result) {
            setData(result)
          } else {
            // Firestore にデータなし → localStorageからマイグレーション
            const local = loadLocal()
            if (local.songs.length > 0) {
              setData(local)
              // Firestoreにサブコレクションとして保存
              const batch = writeBatch(db)
              for (const s of local.songs) {
                batch.set(doc(songsCol(user.uid), s.id), s)
              }
              batch.set(userDoc(user.uid), { curId: local.curId })
              await batch.commit()
            } else {
              // 新規ユーザー
              const s = mkSong('無題の曲 1')
              const newData = { songs: [s], curId: s.id }
              setData(newData)
              await setDoc(doc(songsCol(user.uid), s.id), s)
              await setDoc(userDoc(user.uid), { curId: s.id })
            }
          }
        } catch (e) {
          console.error('Firestore load error:', e)
          // フォールバック: localStorage
          setData(loadLocal())
        }
      } else {
        // 未ログイン → localStorage
        const local = loadLocal()
        if (local.songs.length === 0) {
          const s = mkSong('無題の曲 1')
          local.songs = [s]
          local.curId = s.id
        }
        setData(local)
      }
      setDataLoaded(true)

      // Load plan & usage
      if (user) {
        getUserPlan(user.uid).then(p => setPlanState(p)).catch(() => {})
        // Load level from Firestore
        getDoc(doc(db, 'users', user.uid)).then(snap => {
          const l = snap.data()?.level as UserLevel | undefined
          if (l) { setLevelState(l); localStorage.setItem('kch_level', l) }
        }).catch(() => {})
        getTodayUsage(user.uid).then(u => setUsage(u)).catch(() => {})
      }
    }

    loadData()
  }, [user, authLoading])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(CONFIG.THEME_KEY, theme)
  }, [theme])

  // [Webhook候補] データ更新イベントを外部に通知できる
  // localStorage保存（オフラインフォールバック）+ 該当曲だけFirestoreに保存
  const saveLocal = useCallback((songs: Song[], curId: string | null) => {
    try { localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify({ songs, curId })) } catch { /* noop */ }
  }, [])

  const saveSong = useCallback((song: Song, curId: string | null, allSongs: Song[]) => {
    saveLocal(allSongs, curId)
    const currentUser = auth.currentUser
    if (currentUser) {
      saveSongToFirestore(currentUser.uid, song)
    }
  }, [saveLocal])

  const currentSong = useCallback(() => data.songs.find(s => s.id === data.curId), [data])

  const addSong = useCallback(() => {
    const s = mkSong()
    const songs = [s, ...data.songs]
    const curId = s.id
    setData({ songs, curId })
    saveLocal(songs, curId)
    const currentUser = auth.currentUser
    if (currentUser) {
      setDoc(doc(songsCol(currentUser.uid), s.id), s).catch(e => console.error('Firestore add error:', e))
      saveCurIdToFirestore(currentUser.uid, curId)
    }
    setCurTab('compose')
    setAiHist([])
  }, [data.songs, saveLocal])

  const deleteSong = useCallback((id: string) => {
    const songs = data.songs.filter(s => s.id !== id)
    const curId = data.curId === id ? (songs[0]?.id || null) : data.curId
    setData({ songs, curId })
    saveLocal(songs, curId)
    const currentUser = auth.currentUser
    if (currentUser) {
      deleteDoc(doc(songsCol(currentUser.uid), id)).catch(e => console.error('Firestore delete error:', e))
      saveCurIdToFirestore(currentUser.uid, curId)
    }
  }, [data, saveLocal])

  const selectSong = useCallback((id: string) => {
    setData(d => ({ ...d, curId: id }))
    saveLocal(data.songs, id)
    const currentUser = auth.currentUser
    if (currentUser) saveCurIdToFirestore(currentUser.uid, id)
    setCurTab('compose')
    setAiHist([])
  }, [data.songs, saveLocal])

  const updateSong = useCallback((fn: (s: Song) => void) => {
    setData(prev => {
      const songs = prev.songs.map(s => {
        if (s.id !== prev.curId) return s
        const copy = structuredClone(s)
        fn(copy)
        copy.updatedAt = Date.now()
        // 変更された曲だけFirestoreに保存
        saveSong(copy, prev.curId, prev.songs.map(x => x.id === copy.id ? copy : x))
        return copy
      })
      return { ...prev, songs }
    })
  }, [saveSong])

  const saveOnly = useCallback((fn: (s: Song) => void) => {
    setData(prev => {
      const songs = prev.songs.map(s => {
        if (s.id !== prev.curId) return s
        const copy = structuredClone(s)
        fn(copy)
        copy.updatedAt = Date.now()
        saveSong(copy, prev.curId, prev.songs.map(x => x.id === copy.id ? copy : x))
        return copy
      })
      return { ...prev, songs }
    })
  }, [saveSong])

  const switchTab = useCallback((tab: TabId) => setCurTab(tab), [])

  const toggleTheme = useCallback(() => {
    setTheme(t => t === 'dark' ? 'light' : 'dark')
  }, [])

  const setPlan = useCallback((p: PlanId) => {
    setPlanState(p)
    const u = auth.currentUser
    if (u) setDoc(doc(db, 'users', u.uid), { plan: p }, { merge: true }).catch(() => {})
  }, [])

  const setLevel = useCallback((l: UserLevel) => {
    setLevelState(l)
    localStorage.setItem('kch_level', l)
    const u = auth.currentUser
    if (u) setDoc(doc(db, 'users', u.uid), { level: l }, { merge: true }).catch(() => {})
  }, [])

  const refreshUsage = useCallback(() => {
    const u = auth.currentUser
    if (u) getTodayUsage(u.uid).then(setUsage).catch(() => {})
  }, [])

  const toast = useCallback((msg: string) => {
    const el = document.getElementById('toast')
    if (!el) return
    el.textContent = msg
    el.classList.add('show')
    setTimeout(() => el.classList.remove('show'), 2600)
  }, [])

  // ロード中は何も表示しない
  if (authLoading || !dataLoaded) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg">
        <div className="text-center">
          <div className="mb-3"><FinchAvatar size={56} mood="thinking" /></div>
          <div className="text-text2 text-sm font-mono">読み込み中...</div>
        </div>
      </div>
    )
  }

  return (
    <StoreContext.Provider value={{
      user, authLoading,
      songs: data.songs, curId: data.curId, curTab, aiHist, theme,
      plan, level, setPlan, setLevel, usage, refreshUsage,
      currentSong, addSong, deleteSong, selectSong, updateSong, saveOnly,
      switchTab, setAiHist, toggleTheme, toast,
    }}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  return useContext(StoreContext)
}
