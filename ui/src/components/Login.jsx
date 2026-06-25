import { useState } from 'react'

export default function Login({ onAuth }) {
  const [mode, setMode] = useState('login')        // 'login' | 'signup'
  const [step, setStep] = useState('credentials')  // 'credentials' | 'otp'
  const [form, setForm] = useState({ email: '', name: '', password: '', password_confirm: '', org_name: '' })
  const [otp, setOtp] = useState('')
  const [devCode, setDevCode] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const isSignup = mode === 'signup'

  const post = (path, body) =>
    fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

  const submit = async (e) => {
    e.preventDefault()
    setError(null)

    if (isSignup && form.password !== form.password_confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      if (isSignup) {
        const res = await post('/api/auth/register', {
          email: form.email, name: form.name, password: form.password,
          password_confirm: form.password_confirm, org_name: form.org_name,
        })
        const data = await res.json()
        if (!res.ok) { setError(data.detail || 'Something went wrong.'); return }
        setDevCode(data.dev_code || null)
        setStep('otp')
      } else {
        const res = await post('/api/auth/login', { email: form.email, password: form.password })
        const data = await res.json()
        if (!res.ok) { setError(data.detail || 'Something went wrong.'); return }
        onAuth(data.token, data.user, data.org)
      }
    } catch {
      setError('Could not reach the server. Is the API running?')
    } finally {
      setLoading(false)
    }
  }

  const verify = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await post('/api/auth/verify-otp', { email: form.email, code: otp })
      const data = await res.json()
      if (!res.ok) { setError(data.detail || 'Verification failed.'); return }
      onAuth(data.token, data.user, data.org)
    } catch {
      setError('Could not reach the server.')
    } finally {
      setLoading(false)
    }
  }

  const resend = async () => {
    setError(null)
    try {
      const res = await post('/api/auth/resend-otp', { email: form.email })
      const data = await res.json()
      if (res.ok) { setDevCode(data.dev_code || null); setOtp('') }
      else setError(data.detail || 'Could not resend.')
    } catch { setError('Could not reach the server.') }
  }

  const inputStyle = {
    width: '100%', height: 42, background: 'var(--surface2)', border: '1px solid var(--border)',
    borderRadius: 10, color: 'var(--text1)', fontSize: 14, padding: '0 14px',
    fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box',
  }
  const primaryBtn = {
    height: 44, background: 'var(--accent)', border: 'none', borderRadius: 10, color: '#fff',
    fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.7 : 1, fontFamily: 'Inter, sans-serif', marginTop: 4,
  }

  const errorBox = error && (
    <div style={{ fontSize: 12.5, color: '#F87171', background: 'rgba(248,113,113,0.08)', borderRadius: 8, padding: '8px 10px' }}>
      {error}
    </div>
  )

  return (
    <div style={{ height: '100vh', width: '100vw', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 380, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '32px 28px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
          <img src="/axis-logo.png" alt="AXIS" style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'contain', marginBottom: 14 }} />
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text1)', letterSpacing: '-0.02em' }}>
            {step === 'otp' ? 'Verify your email' : isSignup ? 'Create your account' : 'Welcome back'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4, textAlign: 'center' }}>
            {step === 'otp'
              ? `Enter the 6-digit code we sent to ${form.email}`
              : isSignup ? 'Join your team on AXIS' : 'Sign in to your AXIS workspace'}
          </div>
        </div>

        {step === 'credentials' && (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {isSignup && (
              <input placeholder="Full name" value={form.name} required style={inputStyle}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            )}
            {isSignup && (
              <input placeholder="Organization name (e.g. Acme Inc)" value={form.org_name} style={inputStyle}
                onChange={e => setForm(f => ({ ...f, org_name: e.target.value }))} />
            )}
            <input type="email" placeholder="Work email" value={form.email} required style={inputStyle}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            <input type="password" placeholder={isSignup ? 'Password (min 6 characters)' : 'Password'}
              value={form.password} required style={inputStyle}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            {isSignup && (
              <input type="password" placeholder="Confirm password" value={form.password_confirm} required
                style={{ ...inputStyle,
                  borderColor: form.password_confirm && form.password !== form.password_confirm ? '#F87171' : 'var(--border)' }}
                onChange={e => setForm(f => ({ ...f, password_confirm: e.target.value }))} />
            )}
            {errorBox}
            <button type="submit" disabled={loading} style={primaryBtn}>
              {loading ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'}
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={verify} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {devCode && (
              <div style={{ fontSize: 12, color: 'var(--text2)', background: 'var(--accent-dim)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
                Dev mode (no email configured) — your code is <b style={{ color: 'var(--text1)' }}>{devCode}</b>
              </div>
            )}
            <input
              inputMode="numeric" maxLength={6} placeholder="6-digit code" value={otp} required autoFocus
              onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              style={{ ...inputStyle, textAlign: 'center', letterSpacing: '0.4em', fontSize: 18, fontWeight: 600 }} />
            {errorBox}
            <button type="submit" disabled={loading || otp.length !== 6} style={{ ...primaryBtn, opacity: (loading || otp.length !== 6) ? 0.6 : 1 }}>
              {loading ? 'Verifying…' : 'Verify & continue'}
            </button>
            <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text3)' }}>
              Didn’t get it?{' '}
              <button type="button" onClick={resend} style={{ background: 'none', border: 'none', color: 'var(--accent-text, var(--accent))', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0, fontFamily: 'Inter, sans-serif' }}>Resend code</button>
              {'  ·  '}
              <button type="button" onClick={() => { setStep('credentials'); setError(null); setOtp('') }} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 13, padding: 0, fontFamily: 'Inter, sans-serif' }}>Back</button>
            </div>
          </form>
        )}

        {step === 'credentials' && (
          <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: 'var(--text3)' }}>
            {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              onClick={() => { setMode(isSignup ? 'login' : 'signup'); setError(null) }}
              style={{ background: 'none', border: 'none', color: 'var(--accent-text, var(--accent))', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0, fontFamily: 'Inter, sans-serif' }}
            >
              {isSignup ? 'Sign in' : 'Sign up'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
