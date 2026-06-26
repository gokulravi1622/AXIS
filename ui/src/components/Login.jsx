import { useState } from 'react'

const FEATURES = [
  { icon: '🔗', title: 'All your tools, unified', color: 'var(--c-eng)',
    desc: 'Connect Jira, Confluence, Slack, Notion & Google Drive in one click. AXIS reads across all of them so your team stops hunting through tabs.' },
  { icon: '💬', title: 'Answers, not links', color: 'var(--c-prod)',
    desc: 'Ask in plain English. AXIS finds the right context and writes a clear, grounded answer — no keyword guessing.' },
  { icon: '📎', title: 'Every answer is cited', color: 'var(--c-cs)',
    desc: 'Each response links back to the exact ticket, page, Slack message or doc — click through and verify in one tap.' },
  { icon: '📈', title: 'Gets smarter over time', color: 'var(--c-data)',
    desc: 'Thumbs-up / down on answers tunes retrieval, so the most useful sources rise to the top for everyone.' },
  { icon: '🗂️', title: 'Your own workspace', color: 'var(--c-crm)',
    desc: 'Per-organization accounts, saved chat history, and team-scoped knowledge — everyone sees what’s relevant to them.' },
  { icon: '🔒', title: 'Private & secure', color: 'var(--c-eng)',
    desc: 'Connections are authorized via OAuth and stored encrypted. You decide exactly which tools AXIS can read.' },
]

const STEPS = [
  { n: '1', title: 'Connect your tools', desc: 'One-click OAuth for Jira, Confluence, Slack, Notion and Google Drive. No tokens to copy.' },
  { n: '2', title: 'Ask anything', desc: 'Type a question like you would to a teammate. AXIS searches every connected source at once.' },
  { n: '3', title: 'Get cited answers', desc: 'A grounded answer with clickable sources — and it keeps improving from your feedback.' },
]

const SOURCES = [
  { label: 'Jira', color: 'var(--c-eng)' },
  { label: 'Confluence', color: 'var(--c-data)' },
  { label: 'Slack', color: 'var(--c-prod)' },
  { label: 'Notion', color: 'var(--c-cs)' },
  { label: 'Google Drive', color: 'var(--c-crm)' },
]

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

  const goAuth = (m) => { setMode(m); setError(null); setStep('credentials')
    document.getElementById('auth')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    if (isSignup && form.password !== form.password_confirm) { setError('Passwords do not match.'); return }
    setLoading(true)
    try {
      if (isSignup) {
        const res = await post('/api/auth/register', {
          email: form.email, name: form.name, password: form.password,
          password_confirm: form.password_confirm, org_name: form.org_name,
        })
        const data = await res.json()
        if (!res.ok) { setError(data.detail || 'Something went wrong.'); return }
        setDevCode(data.dev_code || null); setStep('otp')
      } else {
        const res = await post('/api/auth/login', { email: form.email, password: form.password })
        const data = await res.json()
        if (!res.ok) { setError(data.detail || 'Something went wrong.'); return }
        onAuth(data.token, data.user, data.org)
      }
    } catch { setError('Could not reach the server. Is the API running?') }
    finally { setLoading(false) }
  }

  const verify = async (e) => {
    e.preventDefault(); setError(null); setLoading(true)
    try {
      const res = await post('/api/auth/verify-otp', { email: form.email, code: otp })
      const data = await res.json()
      if (!res.ok) { setError(data.detail || 'Verification failed.'); return }
      onAuth(data.token, data.user, data.org)
    } catch { setError('Could not reach the server.') }
    finally { setLoading(false) }
  }

  const resend = async () => {
    setError(null)
    try {
      const res = await post('/api/auth/resend-otp', { email: form.email })
      const data = await res.json()
      if (res.ok) { setDevCode(data.dev_code || null); setOtp('') } else setError(data.detail || 'Could not resend.')
    } catch { setError('Could not reach the server.') }
  }

  // ── shared styles ──
  const input = {
    width: '100%', height: 42, background: 'var(--surface2)', border: '1px solid var(--border)',
    borderRadius: 10, color: 'var(--text1)', fontSize: 14, padding: '0 14px',
    fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box',
  }
  const primaryBtn = {
    height: 44, background: 'var(--accent)', border: 'none', borderRadius: 10, color: '#fff',
    fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.7 : 1, fontFamily: 'Inter, sans-serif', marginTop: 4,
  }
  const navBtn = (filled) => ({
    height: 36, padding: '0 16px', borderRadius: 9, fontSize: 13.5, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
    border: filled ? 'none' : '1px solid var(--border)',
    background: filled ? 'var(--accent)' : 'transparent',
    color: filled ? '#fff' : 'var(--text1)',
  })
  const sectionTitle = { fontSize: 30, fontWeight: 800, color: 'var(--text1)', letterSpacing: '-0.03em', textAlign: 'center' }
  const sectionSub = { fontSize: 15, color: 'var(--text2)', textAlign: 'center', maxWidth: 560, margin: '10px auto 0', lineHeight: 1.6 }

  const errorBox = error && (
    <div style={{ fontSize: 12.5, color: '#F87171', background: 'rgba(248,113,113,0.08)', borderRadius: 8, padding: '8px 10px' }}>{error}</div>
  )

  const authCard = (
    <div id="auth" style={{
      width: '100%', maxWidth: 380, background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 16, padding: '28px 26px', boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
    }}>
      <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--text1)', letterSpacing: '-0.02em' }}>
        {step === 'otp' ? 'Verify your email' : isSignup ? 'Create your account' : 'Welcome back'}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4, marginBottom: 18 }}>
        {step === 'otp' ? `Enter the 6-digit code sent to ${form.email}`
          : isSignup ? 'Start centralizing your team’s knowledge' : 'Sign in to your AXIS workspace'}
      </div>

      {step === 'credentials' && (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {isSignup && <input placeholder="Full name" value={form.name} required style={input}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />}
          {isSignup && <input placeholder="Organization name (e.g. Acme Inc)" value={form.org_name} style={input}
            onChange={e => setForm(f => ({ ...f, org_name: e.target.value }))} />}
          <input type="email" placeholder="Work email" value={form.email} required style={input}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          <input type="password" placeholder={isSignup ? 'Password (min 6 characters)' : 'Password'} value={form.password} required style={input}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          {isSignup && <input type="password" placeholder="Confirm password" value={form.password_confirm} required
            style={{ ...input, borderColor: form.password_confirm && form.password !== form.password_confirm ? '#F87171' : 'var(--border)' }}
            onChange={e => setForm(f => ({ ...f, password_confirm: e.target.value }))} />}
          {errorBox}
          <button type="submit" disabled={loading} style={primaryBtn}>
            {loading ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'}
          </button>
        </form>
      )}

      {step === 'otp' && (
        <form onSubmit={verify} style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {devCode && (
            <div style={{ fontSize: 12, color: 'var(--text2)', background: 'var(--accent-dim)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
              Dev mode — your code is <b style={{ color: 'var(--text1)' }}>{devCode}</b>
            </div>
          )}
          <input inputMode="numeric" maxLength={6} placeholder="6-digit code" value={otp} required autoFocus
            onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            style={{ ...input, textAlign: 'center', letterSpacing: '0.4em', fontSize: 18, fontWeight: 600 }} />
          {errorBox}
          <button type="submit" disabled={loading || otp.length !== 6} style={{ ...primaryBtn, opacity: (loading || otp.length !== 6) ? 0.6 : 1 }}>
            {loading ? 'Verifying…' : 'Verify & continue'}
          </button>
          <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text3)' }}>
            <button type="button" onClick={resend} style={linkBtn}>Resend code</button>{'  ·  '}
            <button type="button" onClick={() => { setStep('credentials'); setError(null); setOtp('') }} style={{ ...linkBtn, color: 'var(--text3)' }}>Back</button>
          </div>
        </form>
      )}

      {step === 'credentials' && (
        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--text3)' }}>
          {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button onClick={() => { setMode(isSignup ? 'login' : 'signup'); setError(null) }} style={linkBtn}>
            {isSignup ? 'Sign in' : 'Sign up'}
          </button>
        </div>
      )}
    </div>
  )

  return (
    <div style={{ height: '100vh', width: '100vw', overflowY: 'auto', background: 'var(--bg)' }}>
      <style>{`html{scroll-behavior:smooth}`}</style>

      {/* ── Navbar ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50, height: 60, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 6vw', background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/axis-logo.png" alt="AXIS" style={{ width: 30, height: 30, borderRadius: 8, objectFit: 'contain' }} />
          <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--text1)', letterSpacing: '-0.02em' }}>AXIS</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <a href="#features" style={navLink}>Features</a>
          <a href="#how" style={navLink}>How it works</a>
          <a href="#sources" style={navLink}>Sources</a>
          <button onClick={() => goAuth('login')} style={navBtn(false)}>Sign in</button>
          <button onClick={() => goAuth('signup')} style={navBtn(true)}>Get started</button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{
        display: 'flex', flexWrap: 'wrap', gap: 48, alignItems: 'center', justifyContent: 'center',
        padding: '72px 6vw 80px', maxWidth: 1200, margin: '0 auto',
        background: 'radial-gradient(1100px 460px at 18% -10%, var(--accent-dim), transparent)',
      }}>
        <div style={{ flex: '1 1 380px', maxWidth: 560 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 12px', borderRadius: 20, background: 'var(--accent-dim)', border: '1px solid var(--border)', fontSize: 12.5, fontWeight: 600, color: 'var(--accent-text, var(--accent))', marginBottom: 20 }}>
            ✦ One source of truth for every team
          </div>
          <h1 style={{ fontSize: 46, lineHeight: 1.08, fontWeight: 850, color: 'var(--text1)', letterSpacing: '-0.04em', margin: 0 }}>
            Your team’s knowledge,<br />instantly answerable.
          </h1>
          <p style={{ fontSize: 16.5, color: 'var(--text2)', lineHeight: 1.65, marginTop: 18, maxWidth: 500 }}>
            AXIS connects Jira, Confluence, Slack, Notion and Google Drive into one place — so anyone
            can ask a question in plain English and get an accurate, source-cited answer in seconds.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 22 }}>
            {['Connect your tools in one click — no tokens to copy',
              'Ask in plain English, get grounded answers',
              'Every answer links back to the original source'].map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 14, color: 'var(--text2)' }}>
                <span style={{ color: '#10B981', fontWeight: 800 }}>✓</span> {t}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
            <button onClick={() => goAuth('signup')} style={{ ...navBtn(true), height: 46, padding: '0 24px', fontSize: 15 }}>Get started free</button>
            <a href="#how" style={{ ...navBtn(false), height: 46, padding: '0 22px', fontSize: 15, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>See how it works</a>
          </div>
        </div>
        <div style={{ flex: '0 1 380px', display: 'flex', justifyContent: 'center' }}>{authCard}</div>
      </section>

      {/* ── What is AXIS / Features ── */}
      <section id="features" style={{ padding: '64px 6vw', maxWidth: 1120, margin: '0 auto' }}>
        <h2 style={sectionTitle}>What is AXIS?</h2>
        <p style={sectionSub}>
          AXIS is a centralized knowledge layer for your organization. Instead of digging through five
          different tools, your team asks AXIS — and gets a trustworthy, cited answer drawn from all of them.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18, marginTop: 40 }}>
          {FEATURES.map((f, i) => (
            <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '22px 20px' }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, border: `1px solid ${f.color}55`, marginBottom: 14 }}>{f.icon}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text1)', marginBottom: 7 }}>{f.title}</div>
              <div style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" style={{ padding: '64px 6vw', background: 'var(--surface)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <h2 style={sectionTitle}>How it works</h2>
          <p style={sectionSub}>From scattered tools to answers in three steps.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, marginTop: 40 }}>
            {STEPS.map((s) => (
              <div key={s.n} style={{ textAlign: 'center', padding: '0 8px' }}>
                <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 19, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>{s.n}</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text1)', marginBottom: 8 }}>{s.title}</div>
                <div style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Sources ── */}
      <section id="sources" style={{ padding: '64px 6vw', textAlign: 'center' }}>
        <h2 style={sectionTitle}>Connects the tools you already use</h2>
        <p style={sectionSub}>One-click, OAuth-secured connections — your data stays yours.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center', marginTop: 36 }}>
          {SOURCES.map((s) => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 15, fontWeight: 600, color: 'var(--text1)' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color }} /> {s.label}
            </div>
          ))}
        </div>
        <button onClick={() => goAuth('signup')} style={{ ...navBtn(true), height: 48, padding: '0 28px', fontSize: 15, marginTop: 44 }}>
          Bring your team’s knowledge together →
        </button>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)', padding: '40px 6vw' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: 24, justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/axis-logo.png" alt="AXIS" style={{ width: 26, height: 26, borderRadius: 7, objectFit: 'contain' }} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text1)' }}>AXIS</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>Centralized knowledge layer</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
            <a href="#features" style={navLink}>Features</a>
            <a href="#how" style={navLink}>How it works</a>
            <a href="#sources" style={navLink}>Sources</a>
            <button onClick={() => goAuth('signup')} style={linkBtn}>Get started</button>
          </div>
        </div>
        <div style={{ maxWidth: 1120, margin: '24px auto 0', paddingTop: 18, borderTop: '1px solid var(--border)', fontSize: 12.5, color: 'var(--text3)', textAlign: 'center' }}>
          © {new Date().getFullYear()} AXIS — one source of truth for every team.
        </div>
      </footer>
    </div>
  )
}

const navLink = { fontSize: 13.5, color: 'var(--text2)', textDecoration: 'none', fontWeight: 500, fontFamily: 'Inter, sans-serif' }
const linkBtn = { background: 'none', border: 'none', color: 'var(--accent-text, var(--accent))', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0, fontFamily: 'Inter, sans-serif' }
