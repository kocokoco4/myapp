import { useState } from 'react'
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth'
import { auth, googleProvider } from '../firebase'
import FinchAvatar from './FinchAvatar'

type Mode = 'choice' | 'signin' | 'signup' | 'reset'

export default function LoginScreen() {
  const [mode, setMode] = useState<Mode>('choice')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const handleGoogle = async () => {
    setError('')
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (e) {
      setError('ログインに失敗しました')
      console.error(e)
    }
  }

  const mapError = (code: string): string => {
    if (code.includes('wrong-password') || code.includes('invalid-credential')) return 'メールまたはパスワードが違います'
    if (code.includes('user-not-found')) return 'そのメールアドレスは登録されていません'
    if (code.includes('email-already-in-use')) return 'このメールアドレスは既に使われています'
    if (code.includes('weak-password')) return 'パスワードは6文字以上にしてください'
    if (code.includes('invalid-email')) return 'メールアドレスの形式が正しくありません'
    return 'エラーが発生しました'
  }

  const handleSubmit = async () => {
    setError('')
    setInfo('')
    if (!email || !password) { setError('メールとパスワードを入力してください'); return }
    setBusy(true)
    try {
      if (mode === 'signin') {
        await signInWithEmailAndPassword(auth, email, password)
      } else if (mode === 'signup') {
        await createUserWithEmailAndPassword(auth, email, password)
      }
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code || ''
      setError(mapError(code))
    }
    setBusy(false)
  }

  const handleReset = async () => {
    setError('')
    if (!email) { setError('メールアドレスを入力してください'); return }
    setBusy(true)
    try {
      await sendPasswordResetEmail(auth, email)
      setInfo('パスワード再設定のメールを送信しました')
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code || ''
      setError(mapError(code))
    }
    setBusy(false)
  }

  return (
    <div className="h-screen flex items-center justify-center bg-bg overflow-y-auto py-8">
      <div className="text-center max-w-sm px-6 w-full">
        <div className="mb-4"><FinchAvatar size={80} mood="wave" /></div>
        <h1 className="font-display text-3xl font-extrabold text-amber mb-3">Finchant</h1>
        <p className="text-text font-bold text-base mb-3 leading-relaxed">
          あなたのメロディ、逃がさない。
        </p>
        <p className="text-text2 text-sm mb-8 leading-[1.9]">
          思いついた音、気分、言葉。<br />
          そのまま、置いておける場所。
        </p>

        {mode === 'choice' && (
          <div className="space-y-3">
            <button
              className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-bg2 border border-border2 rounded-xl text-text font-bold text-sm cursor-pointer hover:border-amber hover:bg-bg3 transition-colors"
              onClick={handleGoogle}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Googleアカウントでログイン
            </button>

            <div className="flex items-center gap-2 my-4">
              <div className="flex-1 h-px bg-border2" />
              <span className="text-[11px] text-text3 font-sans">または</span>
              <div className="flex-1 h-px bg-border2" />
            </div>

            <button
              className="w-full px-6 py-3 bg-amber text-bg rounded-xl font-bold text-sm cursor-pointer hover:bg-amber2 transition-colors"
              onClick={() => { setMode('signin'); setError(''); setInfo('') }}
            >
              メールでログイン
            </button>
            <button
              className="w-full px-6 py-3 bg-transparent border border-border2 text-text2 rounded-xl font-sans text-sm cursor-pointer hover:border-amber hover:text-amber transition-colors"
              onClick={() => { setMode('signup'); setError(''); setInfo('') }}
            >
              新しくアカウントを作る
            </button>
          </div>
        )}

        {(mode === 'signin' || mode === 'signup' || mode === 'reset') && (
          <div className="space-y-3 text-left">
            <input
              type="email"
              className="w-full bg-bg2 border border-border2 rounded-xl text-text px-4 py-3 text-base outline-none font-sans focus:border-amber"
              placeholder="メールアドレス"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
            {mode !== 'reset' && (
              <input
                type="password"
                className="w-full bg-bg2 border border-border2 rounded-xl text-text px-4 py-3 text-base outline-none font-sans focus:border-amber"
                placeholder="パスワード（6文字以上）"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
              />
            )}

            {error && <div className="text-[12px] text-coral font-sans text-center">{error}</div>}
            {info && <div className="text-[12px] text-teal font-sans text-center">{info}</div>}

            {mode === 'signin' && (
              <>
                <button
                  className="w-full py-3 bg-amber text-bg rounded-xl font-bold text-sm disabled:opacity-50"
                  onClick={handleSubmit}
                  disabled={busy}
                >
                  {busy ? 'ログイン中...' : 'ログイン'}
                </button>
                <button
                  className="w-full text-[12px] text-text3 font-sans underline"
                  onClick={() => { setMode('reset'); setError(''); setInfo('') }}
                >
                  パスワードを忘れた方
                </button>
              </>
            )}

            {mode === 'signup' && (
              <button
                className="w-full py-3 bg-amber text-bg rounded-xl font-bold text-sm disabled:opacity-50"
                onClick={handleSubmit}
                disabled={busy}
              >
                {busy ? '作成中...' : 'アカウントを作る'}
              </button>
            )}

            {mode === 'reset' && (
              <button
                className="w-full py-3 bg-amber text-bg rounded-xl font-bold text-sm disabled:opacity-50"
                onClick={handleReset}
                disabled={busy}
              >
                {busy ? '送信中...' : '再設定メールを送る'}
              </button>
            )}

            <button
              className="w-full text-[12px] text-text3 font-sans"
              onClick={() => { setMode('choice'); setError(''); setInfo(''); setEmail(''); setPassword('') }}
            >
              ← 戻る
            </button>
          </div>
        )}

        <p className="text-text3 text-[11px] mt-6 font-sans">
          ログインするとクラウドに自動保存されます
        </p>
      </div>
    </div>
  )
}
