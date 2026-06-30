import { useState, useRef, useCallback, useEffect } from 'react'

const linkBtn = {
  background: 'none', border: 'none', color: 'var(--accent-text, var(--accent))',
  cursor: 'pointer', fontSize: 13.5, fontWeight: 700, padding: 0, fontFamily: 'Inter, sans-serif',
}

const post = (path, body) =>
  fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

const FEATURES = [
  { iconPaths: ['M13 2L3 14h9l-1 8 10-12h-9l1-8z'], title: 'Understands context, not just keywords', color: '#6366F1',
    desc: 'Ask follow-up questions, reference earlier answers, and get responses that actually understand what you mean. Not just keyword matches.' },
  { iconPaths: ['M12 2L2 7l10 5 10-5-10-5z', 'M2 17l10 5 10-5', 'M2 12l10 5 10-5'], title: 'Smarter search, better results', color: '#8B5CF6',
    desc: 'Uses AI and keyword search together to find the most useful sources every time — not just the ones that match your exact wording.' },
  { iconPaths: ['M9 17H7a5 5 0 0 1 0-10h2', 'M15 7h2a5 5 0 0 1 0 10h-2', 'M11 12h2'], title: 'Every answer is sourced', color: '#3B82F6',
    desc: 'Answers link back to the exact ticket, page, or doc they came from. No guessing, no fabrication.' },
  { iconPaths: ['M3 17l5-5 4 4 8-8', 'M17 7h4v4'], title: 'Gets better with feedback', color: '#10B981',
    desc: 'Rate answers with thumbs up or down. The more your team rates, the better the results get over time.' },
  { iconPaths: ['M23 4v6h-6', 'M1 20v-6h6', 'M3.51 9a9 9 0 0 1 14.85-3.36L23 10', 'M1 14l4.64 4.36A9 9 0 0 0 20.49 15'], title: 'One-click data sync', color: '#F59E0B',
    desc: 'Connect Jira, Confluence, Slack, Notion, and Google Drive via OAuth. AXIS re-indexes every 6 hours so answers stay current.' },
  { iconPaths: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', 'M9 12l2 2 4-4'], title: 'Private by design', color: '#EC4899',
    desc: 'Each team has its own private data store. Your docs are never shared with or visible to anyone else.' },
]

const STEP_ICON_PATHS = [
  ['M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71', 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'],
  ['M11 17a6 6 0 1 0 0-12 6 6 0 0 0 0 12z', 'M21 21l-4.35-4.35'],
  ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M9 15l2 2 4-4'],
]

const STEPS = [
  { n: '01', title: 'Connect your tools', desc: 'Connect Jira, Confluence, Slack, Notion, and Google Drive with one click. AXIS pulls in your content automatically — no scripts needed.' },
  { n: '02', title: 'Ask anything', desc: 'Type your question naturally. AXIS searches all your connected tools at once and picks the most relevant results.' },
  { n: '03', title: 'Get a sourced answer', desc: 'Get a clear answer from your real data with clickable sources. Rate answers to help results improve over time.' },
]

const INTEGRATIONS = [
  { label: 'Jira', color: '#6366F1' },
  { label: 'Confluence', color: '#3B82F6' },
  { label: 'Slack', color: '#8B5CF6' },
  { label: 'Notion', color: '#10B981' },
  { label: 'Google Drive', color: '#F59E0B' },
]

// Scroll-reveal: adds .axis-visible to any .axis-reveal element that enters viewport
function useScrollReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.axis-reveal')
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('axis-visible'); io.unobserve(e.target) } })
    }, { threshold: 0.12 })
    els.forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [])
}

const CYCLE_WORDS = ['AI-powered.', 'always cited.', 'context-aware.', 'always current.']

function CyclingWord() {
  const [idx, setIdx] = useState(0)
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    let cancelled = false
    const t = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        if (!cancelled) { setIdx(i => (i + 1) % CYCLE_WORDS.length); setVisible(true) }
      }, 350)
    }, 2800)
    return () => { cancelled = true; clearInterval(t) }
  }, [])
  return (
    <span style={{
      background: 'linear-gradient(135deg, #6366F1, #8B5CF6, #3B82F6)',
      backgroundSize: '200% 200%',
      WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
      animation: 'gradient-x 4s ease infinite',
      willChange: 'background-position', display: 'inline-block',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(8px)',
      transition: 'opacity 0.3s ease, transform 0.3s ease',
    }}>
      {CYCLE_WORDS[idx]}
    </span>
  )
}

function GlowCard({ children, style = {}, onMouseEnter, onMouseLeave }) {
  const ref = useRef(null)
  const [glow, setGlow] = useState({ x: 0, y: 0, opacity: 0 })

  const handleMouseMove = useCallback((e) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    setGlow({ x: e.clientX - r.left, y: e.clientY - r.top, opacity: 1 })
  }, [])

  const handleMouseLeave = useCallback((e) => {
    setGlow(g => ({ ...g, opacity: 0 }))
    onMouseLeave?.(e)
  }, [onMouseLeave])

  const handleMouseEnter = useCallback((e) => {
    onMouseEnter?.(e)
  }, [onMouseEnter])

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ position: 'relative', overflow: 'hidden', ...style }}
    >
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: `radial-gradient(280px circle at ${glow.x}px ${glow.y}px, rgba(99,102,241,0.12), transparent 70%)`,
        opacity: glow.opacity, transition: 'opacity 0.3s ease',
      }} />
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  )
}

export default function Login({ onAuth, theme, setTheme }) {
  const [mode, setMode] = useState('login')
  const [step, setStep] = useState('credentials')
  const [form, setForm] = useState({ email: '', name: '', password: '', password_confirm: '', org_name: '' })
  const [otp, setOtp] = useState('')
  const [devCode, setDevCode] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [focusedField, setFocusedField] = useState(null)
  const [pw2Touched, setPw2Touched] = useState(false)
  const [mouse, setMouse] = useState({ x: 0, y: 0 })
  const heroRef = useRef(null)

  useScrollReveal()

  const handleHeroMouseMove = useCallback((e) => {
    const r = heroRef.current?.getBoundingClientRect()
    if (!r) return
    setMouse({ x: (e.clientX - r.left) / r.width - 0.5, y: (e.clientY - r.top) / r.height - 0.5 })
  }, [])

  const isSignup = mode === 'signup'

  const goAuth = (m) => {
    setMode(m); setError(null); setStep('credentials')
    document.getElementById('auth')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const submit = async (e) => {
    e.preventDefault(); setError(null)
    if (isSignup && form.password !== form.password_confirm) { setError('Passwords do not match.'); setPw2Touched(true); return }
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

  const inputStyle = (name) => ({
    width: '100%', height: 46, background: focusedField === name ? 'var(--surface)' : 'rgba(255,255,255,0.03)',
    border: `1.5px solid ${focusedField === name ? 'var(--accent)' : 'var(--border)'}`,
    borderRadius: 12, color: 'var(--text1)', fontSize: 14, padding: '0 16px',
    fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.2s, background 0.2s',
  })

  const authCard = (
    <div id="auth" style={{
      width: '100%', maxWidth: 400,
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 20,
      padding: '32px 28px',
      boxShadow: '0 0 0 1px rgba(99,102,241,0.08), 0 24px 64px rgba(0,0,0,0.32)',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Subtle top glow */}
      <div style={{
        position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)',
        width: 200, height: 120, borderRadius: '50%',
        background: 'radial-gradient(ellipse, rgba(99,102,241,0.18), transparent)',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Card header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <img src="/axis-logo.png" alt="AXIS" style={{ width: 32, height: 32, borderRadius: 9, objectFit: 'contain' }} />
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text1)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              {step === 'otp' ? 'Verify email' : isSignup ? 'Create account' : 'Welcome back'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 1 }}>
              {step === 'otp' ? `Code sent to ${form.email}`
                : isSignup ? 'Start for free. No card needed.'
                : 'Sign in to your workspace'}
            </div>
          </div>
        </div>

        {/* Mode toggle pills (only on credentials step) */}
        {step === 'credentials' && (
          <div style={{
            display: 'flex', background: 'var(--surface2)', borderRadius: 11, padding: 3, marginBottom: 20,
            border: '1px solid var(--border)',
          }}>
            {['login', 'signup'].map(m => (
              <button key={m} type="button" aria-pressed={mode === m} onClick={() => { setMode(m); setError(null) }} style={{
                flex: 1, height: 34, borderRadius: 9, border: 'none', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'Inter, sans-serif', transition: 'all 0.18s',
                background: mode === m ? 'var(--accent)' : 'transparent',
                color: mode === m ? '#fff' : 'var(--text3)',
                boxShadow: mode === m ? '0 2px 8px rgba(99,102,241,0.3)' : 'none',
              }}>
                {m === 'login' ? 'Sign in' : 'Sign up'}
              </button>
            ))}
          </div>
        )}

        {step === 'credentials' && (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {isSignup && (
              <input placeholder="Full name" value={form.name} required style={inputStyle('name')}
                onFocus={() => setFocusedField('name')} onBlur={() => setFocusedField(null)}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            )}
            {isSignup && (
              <input placeholder="Organization name (optional)" value={form.org_name} style={inputStyle('org')}
                autoComplete="organization"
                onFocus={() => setFocusedField('org')} onBlur={() => setFocusedField(null)}
                onChange={e => setForm(f => ({ ...f, org_name: e.target.value }))} />
            )}
            <input type="email" placeholder="Work email" value={form.email} required style={inputStyle('email')}
              autoComplete="email"
              onFocus={() => setFocusedField('email')} onBlur={() => setFocusedField(null)}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            <input type="password" placeholder={isSignup ? 'Password (min 6 chars)' : 'Password'} value={form.password} required style={inputStyle('pw')}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              onFocus={() => setFocusedField('pw')} onBlur={() => setFocusedField(null)}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            {isSignup && (
              <input type="password" placeholder="Confirm password" value={form.password_confirm} required
                autoComplete="new-password"
                style={{ ...inputStyle('pw2'), borderColor: pw2Touched && form.password !== form.password_confirm ? '#F87171' : focusedField === 'pw2' ? 'var(--accent)' : 'var(--border)' }}
                onFocus={() => setFocusedField('pw2')}
                onBlur={() => { setFocusedField(null); setPw2Touched(true) }}
                onChange={e => setForm(f => ({ ...f, password_confirm: e.target.value }))} />
            )}
            {error && (
              <div style={{ fontSize: 12.5, color: '#F87171', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 9, padding: '8px 12px' }}>{error}</div>
            )}
            <button type="submit" disabled={loading} style={{
              height: 46, background: 'var(--accent)', border: 'none', borderRadius: 12, color: '#fff',
              fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1, fontFamily: 'Inter, sans-serif', marginTop: 4,
              boxShadow: '0 4px 16px rgba(99,102,241,0.35)', transition: 'opacity 0.2s, transform 0.1s',
              letterSpacing: '-0.01em',
            }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
            >
              {loading ? 'Please wait…' : isSignup ? 'Create account →' : 'Sign in →'}
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={verify} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {devCode && (
              <div style={{ fontSize: 12, color: '#92400E', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 9, padding: '8px 12px' }}>
                ⚠ Dev mode — OTP bypassed. Code: <b style={{ color: '#F59E0B' }}>{devCode}</b>
              </div>
            )}
            <input aria-label="Verification code" inputMode="numeric" maxLength={6} placeholder="000000" value={otp} required autoFocus
              onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              style={{ ...inputStyle('otp'), textAlign: 'center', letterSpacing: '0.5em', fontSize: 22, fontWeight: 700 }} />
            {error && (
              <div style={{ fontSize: 12.5, color: '#F87171', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 9, padding: '8px 12px' }}>{error}</div>
            )}
            <button type="submit" disabled={loading || otp.length !== 6} style={{
              height: 46, background: 'var(--accent)', border: 'none', borderRadius: 12, color: '#fff',
              fontSize: 14, fontWeight: 700, cursor: (loading || otp.length !== 6) ? 'not-allowed' : 'pointer',
              opacity: (loading || otp.length !== 6) ? 0.5 : 1, fontFamily: 'Inter, sans-serif',
              boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
            }}>
              {loading ? 'Verifying…' : 'Verify & continue →'}
            </button>
            <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>
              <button type="button" onClick={resend} style={linkBtn}>Resend code</button>
              {'  ·  '}
              <button type="button" onClick={() => { setStep('credentials'); setError(null); setOtp('') }} style={{ ...linkBtn, color: 'var(--text3)' }}>Go back</button>
            </div>
          </form>
        )}

        {step === 'credentials' && (
          <div style={{ marginTop: 20, paddingTop: 18, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
            <span style={{ fontSize: 12, color: '#10B981' }}>🔒</span>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>Secure login · no card required · cancel anytime</span>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', width: '100%', overflowX: 'hidden', background: 'var(--bg)', fontFamily: 'Inter, sans-serif' }}>
      <style>{`
        html { scroll-behavior: smooth }
        * { box-sizing: border-box }
        @keyframes float    { 0%,100%{transform:translateY(0)}   50%{transform:translateY(-18px)} }
        @keyframes floatB   { 0%,100%{transform:translateY(0)}   50%{transform:translateY(14px)} }
        @keyframes pulse-ring{ 0%,100%{opacity:.4;transform:scale(1)} 50%{opacity:.7;transform:scale(1.06)} }
        @keyframes gradient-x{ 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
        @keyframes slide-up { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fade-in  { from{opacity:0} to{opacity:1} }
        @keyframes marquee  { from{transform:translateX(0)} to{transform:translateX(-25%)} }
        @keyframes spin-slow { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .axis-nav-link { font-size:13.5px; color:var(--text2); text-decoration:none; font-weight:500; transition:color 0.15s }
        .axis-nav-link:hover { color:var(--text1) }
        .axis-step-card { transition: transform 0.2s, box-shadow 0.2s }
        .axis-step-card:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(0,0,0,0.18) }
        .axis-int-pill { transition: transform 0.15s, box-shadow 0.15s }
        .axis-int-pill:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.18) }
        .axis-reveal { opacity:0; transform:translateY(32px); transition: opacity 0.65s cubic-bezier(0.16,1,0.3,1), transform 0.65s cubic-bezier(0.16,1,0.3,1) }
        .axis-reveal.axis-visible { opacity:1; transform:translateY(0) }
        .hero-badge  { animation: slide-up 0.5s 0.05s ease both }
        .hero-h1     { animation: slide-up 0.6s 0.15s ease both }
        .hero-desc   { animation: slide-up 0.6s 0.25s ease both }
        .hero-ctas   { animation: slide-up 0.6s 0.35s ease both }
        .hero-badges { animation: slide-up 0.6s 0.45s ease both }
        .hero-card   { animation: slide-up 0.7s 0.2s ease both }
        .axis-marquee-track { display:flex; width:max-content; animation: marquee 22s linear infinite; will-change: transform }
        .axis-marquee-track:hover { animation-play-state: paused }
        @media (max-width: 768px) {
          .hero-grid { flex-direction: column !important; padding: 48px 5vw 56px !important }
          .hero-text { max-width: 100% !important; text-align: center !important }
          .hero-ctas { justify-content: center !important }
          .nav-links { display: none !important }
          h1.axis-h1 { font-size: 38px !important }
        }
      `}</style>

      {/* ── Navbar ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100, height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 6vw',
        background: 'var(--surface)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/axis-logo.png" alt="AXIS" style={{ width: 32, height: 32, borderRadius: 9, objectFit: 'contain' }} />
          <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--text1)', letterSpacing: '-0.03em' }}>AXIS</span>
        </div>
        <div className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <a href="#features" className="axis-nav-link">Features</a>
          <a href="#how" className="axis-nav-link">How it works</a>
          <a href="#integrations" className="axis-nav-link">Integrations</a>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => setTheme?.(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color 0.15s, color 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--text1)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text2)' }}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button onClick={() => goAuth('login')} style={{ height: 36, padding: '0 16px', borderRadius: 10, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text1)', fontFamily: 'Inter, sans-serif', transition: 'border-color 0.15s' }}>Sign in</button>
          <button onClick={() => goAuth('signup')} style={{ height: 36, padding: '0 16px', borderRadius: 10, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', border: 'none', background: 'var(--accent)', color: '#fff', fontFamily: 'Inter, sans-serif', boxShadow: '0 2px 10px rgba(99,102,241,0.35)' }}>Get started</button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section ref={heroRef} onMouseMove={handleHeroMouseMove} style={{ position: 'relative', overflow: 'hidden' }}>
        {/* Animated background blobs */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
          <div style={{ position: 'absolute', top: -120, left: '-10%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.13) 0%, transparent 70%)', animation: 'float 8s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', top: 80, right: '-5%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.10) 0%, transparent 70%)', animation: 'floatB 10s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', bottom: -80, left: '30%', width: 500, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)', animation: 'float 12s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)', backgroundSize: '56px 56px', opacity: 0.3 }} />
        </div>

        <div className="hero-grid" style={{ position: 'relative', zIndex: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 48, padding: '72px 8vw 88px', maxWidth: 1600, margin: '0 auto' }}>

          {/* Left: copy */}
          <div className="hero-text" style={{ flex: '1 1 480px' }}>
            <div className="hero-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 13px', borderRadius: 20, background: 'var(--accent-dim)', border: '1px solid rgba(99,102,241,0.3)', fontSize: 12.5, fontWeight: 700, color: 'var(--accent-text, var(--accent))', marginBottom: 28 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse-ring 2s ease-in-out infinite' }} />
              ✦ AI-Powered Knowledge Platform
            </div>

            <h1 className="axis-h1 hero-h1" style={{ fontSize: 68, lineHeight: 1.04, fontWeight: 900, color: 'var(--text1)', letterSpacing: '-0.04em', margin: '0 0 24px' }}>
              Your team's knowledge.{' '}
              <span style={{ display: 'block' }}><CyclingWord /></span>
            </h1>

            <p className="hero-desc" style={{ fontSize: 18, color: 'var(--text2)', lineHeight: 1.65, margin: '0 0 32px' }}>
              Connect Jira, Confluence, Slack, Notion, and Google Drive once. Ask any question and get a clear, sourced answer pulled straight from your team's docs.
            </p>

            <div className="hero-ctas" style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 36 }}>
              <button onClick={() => goAuth('signup')} style={{
                height: 52, padding: '0 32px', borderRadius: 13, border: 'none',
                background: 'var(--accent)', color: '#fff', fontSize: 16, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                boxShadow: '0 6px 24px rgba(99,102,241,0.4)',
                transition: 'transform 0.15s, box-shadow 0.15s', letterSpacing: '-0.01em',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 32px rgba(99,102,241,0.5)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 6px 24px rgba(99,102,241,0.4)' }}
              >
                Get started free →
              </button>
              <a href="#how" style={{
                height: 52, padding: '0 26px', borderRadius: 13, border: '1px solid var(--border)',
                background: 'transparent', color: 'var(--text1)', fontSize: 16, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'Inter, sans-serif', display: 'inline-flex', alignItems: 'center',
                textDecoration: 'none', transition: 'border-color 0.15s, background 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-dim)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'transparent' }}
              >
                See how it works
              </a>
            </div>

            {/* Trust badges */}
            <div className="hero-badges" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {[
                { paths: ['M19 11H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2z', 'M7 11V7a5 5 0 0 1 10 0v4'], label: 'OAuth-secured' },
                { paths: ['M4 7h16', 'M4 12h10', 'M4 17h7'], label: 'Your own private data' },
                { paths: ['M22 11.08V12a10 10 0 1 1-5.93-9.14', 'M22 4L12 14.01l-3-3'], label: 'No card required' },
                { paths: ['M13 2L3 14h9l-1 8 10-12h-9l1-8z'], label: 'Set up in minutes' },
              ].map(b => (
                <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 12.5, fontWeight: 500, color: 'var(--text3)' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {b.paths.map((d, i) => <path key={i} d={d} />)}
                  </svg>
                  {b.label}
                </div>
              ))}
            </div>
          </div>

          {/* Right: auth card with floating UI chips */}
          <div className="hero-card" style={{ flex: '0 0 440px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* Floating source chip — top left, parallax */}
            <div style={{
              position: 'absolute', top: -18, left: -24, zIndex: 10,
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 14px', borderRadius: 12,
              background: 'var(--surface)', border: '1px solid rgba(99,102,241,0.3)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
              transform: `translate(${mouse.x * -14}px, ${mouse.y * -10}px)`,
              transition: 'transform 0.1s ease-out',
              animation: 'float 6s ease-in-out infinite',
            }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><path d="M7 7h.01" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text1)' }}>Jira · 3 tickets</div>
                <div style={{ fontSize: 10, color: '#10B981', fontWeight: 600 }}>● 94% relevant</div>
              </div>
            </div>

            {/* Floating answer chip — bottom right, parallax */}
            <div style={{
              position: 'absolute', bottom: -16, right: -20, zIndex: 10,
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 14px', borderRadius: 12,
              background: 'var(--surface)', border: '1px solid rgba(16,185,129,0.3)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
              transform: `translate(${mouse.x * 14}px, ${mouse.y * 10}px)`,
              transition: 'transform 0.1s ease-out',
              animation: 'floatB 7s ease-in-out infinite',
            }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text1)' }}>Answer ready</div>
                <div style={{ fontSize: 10, color: 'var(--text3)' }}>3 sources cited</div>
              </div>
            </div>

            {authCard}
          </div>
        </div>
      </section>

      {/* ── Integrations strip ── */}
      <div id="integrations" style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '22px 0', background: 'var(--surface)', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 0 }}>
        {/* Fixed label */}
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', flexShrink: 0, padding: '0 28px 0 8vw', whiteSpace: 'nowrap' }}>Connects with</span>
        {/* Fade edges */}
        <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 60, background: 'linear-gradient(to right, var(--surface), transparent)', zIndex: 2, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 60, background: 'linear-gradient(to left, var(--surface), transparent)', zIndex: 2, pointerEvents: 'none' }} />
          <div className="axis-marquee-track">
            {[...INTEGRATIONS, ...INTEGRATIONS, ...INTEGRATIONS, ...INTEGRATIONS].map((s, i) => (
              <div key={i} className="axis-int-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 18px', background: 'var(--surface2)', border: `1px solid ${s.color}33`, borderRadius: 40, fontSize: 14, fontWeight: 600, color: 'var(--text1)', cursor: 'default', marginRight: 14, flexShrink: 0 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, display: 'inline-block', flexShrink: 0 }} />
                {s.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Features ── */}
      <section id="features" style={{ padding: '88px 8vw', maxWidth: 1600, margin: '0 auto' }}>
        <div className="axis-reveal" style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ display: 'inline-block', fontSize: 12, fontWeight: 700, color: 'var(--accent-text, var(--accent))', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12, padding: '4px 12px', background: 'var(--accent-dim)', borderRadius: 20, border: '1px solid rgba(99,102,241,0.25)' }}>Features</div>
          <h2 style={{ fontSize: 38, fontWeight: 900, color: 'var(--text1)', letterSpacing: '-0.03em', margin: '0 0 14px' }}>One place for every answer</h2>
          <p style={{ fontSize: 16, color: 'var(--text2)', maxWidth: 520, margin: '0 auto', lineHeight: 1.65 }}>
            Stop switching between five tools. AXIS connects everything your team knows and gives anyone a fast, sourced answer to any question.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, alignItems: 'stretch' }}>
          {FEATURES.map((f, i) => (
            <div key={i} className="axis-reveal" style={{ transitionDelay: `${i * 0.08}s`, height: '100%' }}><GlowCard style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '26px 24px', cursor: 'default', transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s', height: '100%' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 36px rgba(0,0,0,0.2)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; e.currentTarget.style.borderColor = 'var(--border)' }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 13, background: f.color + '15', border: `1px solid ${f.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={f.color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  {f.iconPaths.map((d, pi) => <path key={pi} d={d} />)}
                </svg>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text1)', marginBottom: 8, letterSpacing: '-0.01em' }}>{f.title}</div>
              <div style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.65 }}>{f.desc}</div>
            </GlowCard></div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" style={{ padding: '88px 8vw', background: 'var(--surface)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <div className="axis-reveal" style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ display: 'inline-block', fontSize: 12, fontWeight: 700, color: 'var(--accent-text, var(--accent))', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12, padding: '4px 12px', background: 'var(--accent-dim)', borderRadius: 20, border: '1px solid rgba(99,102,241,0.25)' }}>How it works</div>
            <h2 style={{ fontSize: 38, fontWeight: 900, color: 'var(--text1)', letterSpacing: '-0.03em', margin: '0 0 14px' }}>Simple to set up. Instant to use.</h2>
            <p style={{ fontSize: 16, color: 'var(--text2)', maxWidth: 480, margin: '0 auto', lineHeight: 1.65 }}>Connect your tools once and your team can start asking questions right away.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
            {STEPS.map((s, i) => (
              <div key={s.n} className="axis-step-card axis-reveal" style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 16, padding: '30px 26px', position: 'relative', overflow: 'hidden', transitionDelay: `${i * 0.12}s` }}>
                <div style={{ position: 'absolute', top: 16, right: 16, fontSize: 52, fontWeight: 900, color: 'var(--border)', lineHeight: 1, pointerEvents: 'none', userSelect: 'none' }}>{s.n}</div>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, boxShadow: '0 4px 16px rgba(99,102,241,0.35)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    {STEP_ICON_PATHS[i].map((d, pi) => <path key={pi} d={d} />)}
                  </svg>
                </div>
                <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text1)', marginBottom: 10, letterSpacing: '-0.01em' }}>{s.title}</div>
                <div style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.65 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA banner ── */}
      <section style={{ padding: '88px 8vw' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(800px at 50% 50%, rgba(99,102,241,0.07), transparent)', pointerEvents: 'none', borderRadius: 24 }} />
          <div style={{ position: 'relative', background: 'var(--surface)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 24, padding: '56px 40px', boxShadow: '0 0 80px rgba(99,102,241,0.06)' }}>
            <h2 style={{ fontSize: 36, fontWeight: 900, color: 'var(--text1)', letterSpacing: '-0.03em', margin: '0 0 14px' }}>
              Stop searching. Start knowing.
            </h2>
            <p style={{ fontSize: 16, color: 'var(--text2)', lineHeight: 1.65, margin: '0 0 32px', maxWidth: 500, marginLeft: 'auto', marginRight: 'auto' }}>
              Set up in minutes. Connect your tools, invite your team, and get sourced answers from your real data without switching tabs.
            </p>
            <button onClick={() => goAuth('signup')} style={{
              height: 52, padding: '0 32px', borderRadius: 14, border: 'none',
              background: 'var(--accent)', color: '#fff', fontSize: 16, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              boxShadow: '0 8px 28px rgba(99,102,241,0.45)',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(99,102,241,0.55)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 8px 28px rgba(99,102,241,0.45)' }}
            >
              Get started free →
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)', padding: '40px 8vw' }}>
        <div style={{ maxWidth: 1600, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: 24, justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/axis-logo.png" alt="AXIS" style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'contain' }} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--text1)', letterSpacing: '-0.02em' }}>AXIS</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>Centralized knowledge layer</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
            <a href="#features" className="axis-nav-link">Features</a>
            <a href="#how" className="axis-nav-link">How it works</a>
            <a href="#integrations" className="axis-nav-link">Integrations</a>
            <button onClick={() => goAuth('signup')} style={linkBtn}>Get started →</button>
          </div>
        </div>
        <div style={{ maxWidth: 1600, margin: '20px auto 0', paddingTop: 18, borderTop: '1px solid var(--border)', fontSize: 12.5, color: 'var(--text3)', textAlign: 'center' }}>
          © {new Date().getFullYear()} AXIS · one source of truth for every team.
        </div>
      </footer>
    </div>
  )
}
