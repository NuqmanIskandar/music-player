import { useEffect, useState } from 'react'
import { api } from '../api'
import { IconMusic } from './Icons'

export default function AuthPage({ onAuthed }) {
  const [mode, setMode] = useState('login') // login | signup
  const [allowSignup, setAllowSignup] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .authConfig()
      .then((c) => setAllowSignup(c.allow_signup))
      .catch(() => {})
  }, [])

  const isSignup = mode === 'signup' && allowSignup

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const s = isSignup ? await api.signup(username.trim(), password) : await api.login(username.trim(), password)
      onAuthed(s)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  const switchMode = (m) => {
    setMode(m)
    setError('')
  }

  return (
    <div className="auth">
      <div className="topline" />
      <form className="auth__card gradient-border" onSubmit={submit}>
        <span className="brand__logo brand__logo--lg">
          <IconMusic size={26} />
        </span>
        <h1>{isSignup ? 'Create your account' : 'Welcome back'}</h1>
        <p className="muted">{isSignup ? 'Your own library and playlists.' : 'Sign in to your music.'}</p>

        {allowSignup && (
          <div className="segmented" role="tablist">
            <button type="button" className={!isSignup ? 'is-on' : ''} onClick={() => switchMode('login')}>
              Sign in
            </button>
            <button type="button" className={isSignup ? 'is-on' : ''} onClick={() => switchMode('signup')}>
              Sign up
            </button>
          </div>
        )}

        <label className="auth__field">
          <span>Username</span>
          <input
            className="field"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            required
          />
        </label>
        <label className="auth__field">
          <span>Password</span>
          <input
            className="field"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            minLength={isSignup ? 8 : undefined}
            required
          />
          {isSignup && <small className="muted">At least 8 characters.</small>}
        </label>

        {error && <p className="form-error">{error}</p>}

        <button className="btn btn--primary btn--block" disabled={busy || !username.trim() || !password}>
          {busy ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
