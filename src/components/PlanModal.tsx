import { useState } from 'react'
import { PLANS, startCheckout, type PlanId } from '../utils/plan'

interface Props {
  open: boolean
  onClose: () => void
  currentPlan: PlanId
}

export default function PlanModal({ open, onClose, currentPlan }: Props) {
  const [loading, setLoading] = useState<PlanId | null>(null)
  const [showComingSoon, setShowComingSoon] = useState(false)

  if (!open) return null

  const handleUpgrade = async (planId: PlanId) => {
    if (planId === 'free' || planId === currentPlan) return
    setLoading(planId)
    const result = await startCheckout(planId)
    setLoading(null)
    if (result?.url) {
      window.location.href = result.url
    } else {
      // Stripe未開通 → 準備中モーダル
      setShowComingSoon(true)
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-bg2 border border-border2 rounded-2xl max-w-[440px] w-full mx-3 shadow-[0_24px_64px_rgba(0,0,0,0.7)] max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-base font-display font-bold text-text">プランを選ぶ</h2>
            <p className="text-[10px] text-text3 font-mono mt-0.5">Choose your plan</p>
          </div>
          <button className="bg-transparent border-none text-text3 cursor-pointer text-lg" onClick={onClose}>✕</button>
        </div>

        {/* Plans */}
        <div className="p-4 space-y-3">
          {PLANS.map(plan => {
            const isCurrent = plan.id === currentPlan
            const isRecommended = plan.recommended
            return (
              <div
                key={plan.id}
                className={`relative rounded-xl border p-4 transition-all
                  ${isRecommended
                    ? 'border-amber bg-amber/[0.04] shadow-[0_0_20px_rgba(232,160,32,0.1)]'
                    : isCurrent
                      ? 'border-teal bg-teal/[0.04]'
                      : 'border-border2 bg-bg3'}`}
              >
                {isRecommended && (
                  <span className="absolute -top-2.5 left-4 px-2 py-0.5 bg-amber text-bg text-[11px] font-bold rounded-full font-mono">
                    おすすめ / RECOMMENDED
                  </span>
                )}
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="text-sm font-bold text-text font-sans">{plan.name}</div>
                    <div className="text-[10px] text-text3 font-mono">{plan.nameEn}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-bold font-mono ${isRecommended ? 'text-amber' : 'text-text'}`}>
                      {plan.price === 0 ? '無料' : plan.priceLabel}
                    </div>
                  </div>
                </div>

                <ul className="space-y-1 mb-3">
                  {plan.features.map((f, i) => (
                    <li key={i} className="text-[11px] text-text2 font-sans flex items-start gap-1.5">
                      <span className="text-teal mt-0.5 shrink-0">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <div className="text-center py-1.5 text-[11px] text-teal font-mono font-bold border border-teal/30 rounded-lg bg-teal/5">
                    現在のプラン
                  </div>
                ) : plan.id === 'free' ? null : (
                  <button
                    className={`w-full py-2.5 rounded-lg text-sm font-bold font-sans transition-all active:scale-[0.98]
                      ${isRecommended
                        ? 'bg-amber text-bg hover:bg-amber2'
                        : 'bg-bg4 border border-border2 text-text2 hover:border-amber hover:text-amber'}`}
                    disabled={loading !== null}
                    onClick={() => handleUpgrade(plan.id)}
                  >
                    {loading === plan.id ? '処理中...' : 'アップグレード'}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-5 pb-4 space-y-2">
          {currentPlan !== 'free' && (
            <button
              className="w-full py-2 rounded-lg text-[11px] border border-border2 text-text3 bg-transparent hover:border-coral hover:text-coral font-sans"
              onClick={() => setShowComingSoon(true)}
            >
              プランを解約する
            </button>
          )}
          <div className="text-[11px] text-text3 font-mono text-center">
            解約はいつでも可能 · 日本円決済 · Stripe経由
          </div>
        </div>

        {/* Coming soon overlay */}
        {showComingSoon && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50" onClick={() => setShowComingSoon(false)}>
            <div className="bg-bg3 border border-border2 rounded-2xl p-6 max-w-[280px] w-full text-center shadow-lg" onClick={e => e.stopPropagation()}>
              <div className="text-sm mb-3 font-display font-bold text-amber">Coming Soon</div>
              <div className="text-text font-bold text-sm mb-2 font-sans">決済機能は準備中です</div>
              <div className="text-text3 text-xs mb-4 font-sans leading-relaxed">
                Stripe決済の開通準備を進めています。<br/>もう少しお待ちください。
              </div>
              <button
                className="px-4 py-2 bg-amber text-bg rounded-lg text-sm font-bold font-sans"
                onClick={() => setShowComingSoon(false)}
              >
                OK
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
