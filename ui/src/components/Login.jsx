import { useState } from 'react'

export default function Login({ onAuth }) {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [form, setForm] = useState({ email: '', name: '', password: '', org_name: '' })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const isSignup = mode === 'signup'

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const endpoint = isSignup ? '/api/auth/register' : '/api/auth/login'
      const body = isSignup
        ? { email: form.email, name: form.name, password: form.password, org_name: form.org_name }
        : { email: form.email, password: form.password }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.detail || 'Something went wrong.')
        return
      }
      onAuth(data.token, data.user, data.org)
    } catch {
      setError('Could not reach the server. Is the API running?')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%',
    height: 42,
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    color: 'var(--text1)',
    fontSize: 14,
    padding: '0 14px',
    fontFamily: 'Inter, sans-serif',
    outline: 'none',
    boxSizing: 'border-box',
  }

  return (
    <div style={{
      height: '100vh',
      width: '100vw',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 380,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '32px 28px',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
          <img src="/axis-logo.png" alt="AXIS" style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'contain', marginBottom: 14 }} />
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text1)', letterSpacing: '-0.02em' }}>
            {isSignup ? 'Create your account' : 'Welcome back'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>
            {isSignup ? 'Join your team on AXIS' : 'Sign in to your AXIS workspace'}
          </div>
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {isSignup && (
            <input
              placeholder="Full name"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
              style={inputStyle}
            />
          )}
          {isSignup && (
            <input
              placeholder="Organization name (e.g. Acme Inc)"
              value={form.org_name}
              onChange={e => setForm(f => ({ ...f, org_name: e.target.value }))}
              style={inputStyle}
            />
          )}
          <input
            type="email"
            placeholder="Work email"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            required
            style={inputStyle}
          />
          <input
            type="password"
            placeholder={isSignup ? 'Password (min 6 characters)' : 'Password'}
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            required
            style={inputStyle}
          />

          {error && (
            <div style={{ fontSize: 12.5, color: '#F87171', background: 'rgba(248,113,113,0.08)', borderRadius: 8, padding: '8px 10px' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              height: 44,
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 10,
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              fontFamily: 'Inter, sans-serif',
              marginTop: 4,
            }}
          >
            {loading ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: 'var(--text3)' }}>
          {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => { setMode(isSignup ? 'login' : 'signup'); setError(null) }}
            style={{ background: 'none', border: 'none', color: 'var(--accent-text, var(--accent))', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0, fontFamily: 'Inter, sans-serif' }}
          >
            {isSignup ? 'Sign in' : 'Sign up'}
          </button>
        </div>
      </div>
    </div>
  )
}
