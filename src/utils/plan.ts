/**
 * プラン管理・使用量カウント
 *
 * [ZooLab連携ポイント] プラン情報は将来 ZooLab 共通認証基盤に統合
 * [外部連携候補] Stripe Webhook → plan フィールド更新
 */
import { doc, getDoc, setDoc, increment } from 'firebase/firestore'
import { db } from '../firebase'

export type PlanId = 'free' | 'standard' | 'premium'

export interface PlanDef {
  id: PlanId
  name: string
  nameEn: string
  price: number       // 月額（円）
  priceLabel: string
  features: string[]
  featuresEn: string[]
  limits: {
    proposals: number   // 1日のAI提案回数（-1=無制限）
    accompGen: number   // 1日のAI伴奏カスタマイズ回数（-1=無制限）
  }
  recommended?: boolean
}

export const PLANS: PlanDef[] = [
  {
    id: 'free',
    name: '無料プラン',
    nameEn: 'Free',
    price: 0,
    priceLabel: '¥0',
    features: [
      '曲数 3曲まで',
      '雰囲気テンプレ伴奏 1日2回',
      'AI提案 1日3回',
      'MIDI / MusicXML出力 不可',
    ],
    featuresEn: [
      'Up to 3 songs',
      'Mood template 2/day',
      'AI suggestions 3/day',
      'No MIDI / MusicXML export',
    ],
    limits: { proposals: 3, accompGen: 0 },
  },
  {
    id: 'standard',
    name: 'スタンダード',
    nameEn: 'Standard',
    price: 500,
    priceLabel: '¥500/月',
    features: [
      '曲数無制限',
      '雰囲気テンプレ伴奏 無制限',
      'AI提案 1日20回',
      'AI伴奏カスタマイズ 1日5回',
      'MIDI / MusicXML出力',
      'カスタム拍子',
    ],
    featuresEn: [
      'Unlimited songs',
      'Mood template unlimited',
      'AI suggestions 20/day',
      'AI arrange customize 5/day',
      'MIDI / MusicXML export',
      'Custom time signatures',
    ],
    limits: { proposals: 20, accompGen: 5 },
    recommended: true,
  },
  {
    id: 'premium',
    name: 'プレミアム',
    nameEn: 'Premium',
    price: 980,
    priceLabel: '¥980/月',
    features: [
      '全機能完全無制限',
      '自動バックアップ（週1回）',
      '優先サポート',
    ],
    featuresEn: [
      'Everything unlimited',
      'Auto backup (weekly)',
      'Priority support',
    ],
    limits: { proposals: -1, accompGen: -1 },
  },
]

// ─── Firestore helpers ─── //

function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** ユーザーのプランを取得 */
export async function getUserPlan(uid: string): Promise<PlanId> {
  try {
    const snap = await getDoc(doc(db, 'users', uid))
    return (snap.data()?.plan as PlanId) || 'free'
  } catch {
    return 'free'
  }
}

/** 今日の使用量を取得 */
export async function getTodayUsage(uid: string): Promise<{ proposals: number; accompGen: number }> {
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'usage', todayKey()))
    if (!snap.exists()) return { proposals: 0, accompGen: 0 }
    const d = snap.data()
    return { proposals: d.proposals || 0, accompGen: d.accompGen || 0 }
  } catch {
    return { proposals: 0, accompGen: 0 }
  }
}

/** 使用量をインクリメント */
export async function incrementUsage(uid: string, field: 'proposals' | 'accompGen'): Promise<void> {
  const ref = doc(db, 'users', uid, 'usage', todayKey())
  await setDoc(ref, { [field]: increment(1) }, { merge: true })
}

/** 制限チェック: 使用可能かどうか */
export function canUseFeature(
  planId: PlanId,
  feature: 'proposals' | 'accompGen',
  currentCount: number,
): boolean {
  const plan = PLANS.find(p => p.id === planId)
  if (!plan) return false
  const limit = plan.limits[feature]
  if (limit === -1) return true
  return currentCount < limit
}

/** 残り回数テキスト */
export function remainingText(
  planId: PlanId,
  feature: 'proposals' | 'accompGen',
  currentCount: number,
): string {
  const plan = PLANS.find(p => p.id === planId)
  if (!plan) return ''
  const limit = plan.limits[feature]
  if (limit === -1) return '無制限'
  const remaining = Math.max(0, limit - currentCount)
  return `残り${remaining}/${limit}回`
}

// ─── Stripe mock ─── //
// [ZooLab連携ポイント] Stripe Checkout Session 生成
// 現在はモック。Stripe開通後にここを差し替える

export async function startCheckout(_planId: PlanId): Promise<{ url: string } | null> {
  // TODO: Stripe開通後に以下を実装
  // const res = await fetch('/api/stripe/create-checkout-session', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ planId, uid }),
  // })
  // const { url } = await res.json()
  // return { url }

  // モック: null を返す → UIで「準備中」表示
  return null
}
