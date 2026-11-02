import { useState } from 'react'
import { login, register, errorMessage } from '../api'

const MIN_PASSWORD = 8

export default function AuthPage({ onSignedIn }) {
  const [mode, setMode]         = useState('login')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState(null)
  const [busy, setBusy]         = useState(false)
  const isRegister = mode === 'register'

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      onSignedIn(await (isRegister ? register : login)(email, password))
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  function switchMode() {
    setMode(isRegister ? 'login' : 'register')
    setError(null)
  }

  return (
    <div className="page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1 className="auth-title">{isRegister ? 'Create your account' : 'Sign in'}</h1>
        <p className="auth-sub">Your interviews, scores and progress are saved to your account.</p>

        <label className="auth-label" htmlFor="auth-email">Email</label>
        <input
          id="auth-email"
          className="config-input"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
        />

        <label className="auth-label" htmlFor="auth-password">Password</label>
        <input
          id="auth-password"
          className="config-input"
          type="password"
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          required
          minLength={isRegister ? MIN_PASSWORD : undefined}
          maxLength={128}
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        {isRegister && <div className="tailor-note">At least {MIN_PASSWORD} characters.</div>}

        {error && <div className="tailor-note error" role="alert">{error}</div>}

        <button className="btn btn-primary auth-submit" type="submit" disabled={busy}>
          {busy ? 'One moment...' : isRegister ? 'Create account' : 'Sign in'}
        </button>
        <button className="auth-switch" type="button" onClick={switchMode}>
          {isRegister ? 'Already have an account? Sign in' : 'New here? Create an account'}
        </button>
      </form>
    </div>
  )
}
