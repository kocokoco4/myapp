/**
 * Finchant マスコット — ダーウィンフィンチのSVGキャラクター
 * size: アバターサイズ（px）
 * mood: 表情バリエーション
 */
interface Props {
  size?: number
  mood?: 'default' | 'happy' | 'thinking' | 'wave'
  className?: string
}

export default function FinchAvatar({ size = 40, mood = 'default', className = '' }: Props) {
  // Eye variation by mood
  const eyeHighlight = mood === 'happy' ? (
    <>
      <path d="M 56 30 Q 60 25 64 30" fill="none" stroke="#1a1018" strokeWidth="2.5" strokeLinecap="round"/>
    </>
  ) : (
    <>
      <circle cx="58" cy="30" r="5" fill="#1a1018"/>
      <circle cx="59.5" cy="28.5" r="2" fill="#fff"/>
      <circle cx="56.5" cy="31" r="1" fill="#fff" opacity="0.5"/>
    </>
  )

  // Beak open for happy/wave
  const beakOpen = mood === 'happy' || mood === 'wave'

  return (
    <svg
      viewBox="0 0 80 80"
      width={size}
      height={size}
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      {/* Body */}
      <ellipse cx="38" cy="50" rx="22" ry="24" fill="#d4952a"/>
      {/* Belly */}
      <ellipse cx="40" cy="55" rx="14" ry="16" fill="#f5e8c0"/>
      {/* Wing */}
      <path d="M 22 42 Q 16 52 20 64 Q 28 60 34 48 Z" fill="#a07020" opacity="0.8"/>
      {/* Head */}
      <circle cx="45" cy="32" r="18" fill="#daa030"/>
      {/* Cheek */}
      <ellipse cx="52" cy="37" rx="5" ry="4" fill="#f08070" opacity="0.4"/>
      {/* Eye */}
      {eyeHighlight}
      {/* Beak — Darwin's Finch style (thick, strong) */}
      {beakOpen ? (
        <>
          <path d="M 60 33 L 74 36 Q 72 38 68 39 L 60 37 Z" fill="#555" stroke="#444" strokeWidth="0.8"/>
          <path d="M 60 37 L 70 40 Q 68 43 65 44 L 60 41 Z" fill="#666" stroke="#444" strokeWidth="0.8"/>
        </>
      ) : (
        <>
          <path d="M 60 33 L 75 37 Q 73 40 68 41 L 60 38 Z" fill="#555" stroke="#444" strokeWidth="0.8"/>
          <path d="M 60 36 L 72 40 Q 70 42 66 43 L 60 40 Z" fill="#666" stroke="#444" strokeWidth="0.8"/>
          <line x1="60" y1="37.5" x2="73" y2="39" stroke="#444" strokeWidth="0.5"/>
        </>
      )}
      {/* Musical note (small, near beak) */}
      {mood !== 'thinking' && (
        <g transform="translate(72, 28) scale(0.6)" opacity="0.6">
          <ellipse cx="0" cy="0" rx="4" ry="3" fill="#e8a020" transform="rotate(-15)"/>
          <line x1="3.5" y1="-0.5" x2="3.5" y2="-14" stroke="#e8a020" strokeWidth="1.5"/>
          <path d="M 3.5 -14 Q 9 -10 7 -6" stroke="#e8a020" fill="none" strokeWidth="1.5" strokeLinecap="round"/>
        </g>
      )}
      {/* Thinking dots */}
      {mood === 'thinking' && (
        <g fill="#e8a020" opacity="0.5">
          <circle cx="70" cy="24" r="2">
            <animate attributeName="opacity" values="0.3;0.8;0.3" dur="1.2s" repeatCount="indefinite"/>
          </circle>
          <circle cx="74" cy="19" r="1.5">
            <animate attributeName="opacity" values="0.3;0.8;0.3" dur="1.2s" begin="0.3s" repeatCount="indefinite"/>
          </circle>
          <circle cx="76" cy="14" r="1">
            <animate attributeName="opacity" values="0.3;0.8;0.3" dur="1.2s" begin="0.6s" repeatCount="indefinite"/>
          </circle>
        </g>
      )}
      {/* Wave hand */}
      {mood === 'wave' && (
        <g transform="translate(18, 38) rotate(-20)">
          <path d="M 0 0 Q -6 -8 -2 -14" fill="none" stroke="#daa030" strokeWidth="3" strokeLinecap="round">
            <animateTransform attributeName="transform" type="rotate" values="-10;10;-10" dur="0.6s" repeatCount="indefinite"/>
          </path>
        </g>
      )}
      {/* Feet */}
      <g stroke="#777" strokeWidth="1.5" strokeLinecap="round" fill="none">
        <path d="M 32 72 L 28 78 L 24 80"/>
        <path d="M 28 78 L 30 81"/>
        <path d="M 44 72 L 46 78 L 42 80"/>
        <path d="M 46 78 L 48 81"/>
      </g>
    </svg>
  )
}
