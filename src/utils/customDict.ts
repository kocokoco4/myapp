/**
 * カスタム辞典 — お気に入りコード進行の保存・取得・削除
 * Firestore: users/{uid}/progressions/{id}
 * localStorage: kch_progressions (オフラインフォールバック)
 */
import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore'
import { db, auth } from '../firebase'
import type { CustomProgression } from '../types'
import { gid } from './id'

const LOCAL_KEY = 'kch_progressions'

function loadLocal(): CustomProgression[] {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]') } catch { return [] }
}

function saveLocal(items: CustomProgression[]): void {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(items))
}

function progressionsCol(uid: string) {
  return collection(db, 'users', uid, 'progressions')
}

/** 全カスタム進行を取得 */
export async function getCustomProgressions(): Promise<CustomProgression[]> {
  const uid = auth.currentUser?.uid
  if (uid) {
    try {
      const snap = await getDocs(progressionsCol(uid))
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as CustomProgression))
      items.sort((a, b) => b.createdAt - a.createdAt)
      saveLocal(items) // sync to local
      return items
    } catch {
      return loadLocal()
    }
  }
  return loadLocal()
}

/** カスタム進行を保存 */
export async function saveCustomProgression(name: string, chords: string[], key?: string, tags?: string[]): Promise<CustomProgression> {
  const item: CustomProgression = {
    id: gid(),
    name,
    chords,
    key,
    tags,
    createdAt: Date.now(),
  }

  // Local
  const local = loadLocal()
  local.unshift(item)
  saveLocal(local)

  // Firestore
  const uid = auth.currentUser?.uid
  if (uid) {
    setDoc(doc(progressionsCol(uid), item.id), item).catch(() => {})
  }

  return item
}

/** カスタム進行を削除 */
export async function deleteCustomProgression(id: string): Promise<void> {
  // Local
  const local = loadLocal().filter(p => p.id !== id)
  saveLocal(local)

  // Firestore
  const uid = auth.currentUser?.uid
  if (uid) {
    deleteDoc(doc(progressionsCol(uid), id)).catch(() => {})
  }
}

/** カスタム進行を更新 */
export async function updateCustomProgression(id: string, updates: Partial<Pick<CustomProgression, 'name' | 'chords' | 'tags'>>): Promise<void> {
  const local = loadLocal()
  const idx = local.findIndex(p => p.id === id)
  if (idx >= 0) {
    Object.assign(local[idx], updates)
    saveLocal(local)
  }

  const uid = auth.currentUser?.uid
  if (uid) {
    setDoc(doc(progressionsCol(uid), id), updates, { merge: true }).catch(() => {})
  }
}
