import { useState } from 'react'

export default function McpSetup({ token, onClose }) {
  const [tab, setTab] = useState('code')          // 'code' | 'desktop' | 'web'
  const [step, setStep] = useState(1)             // 1 | 2 | 3
  const [ccState, setCcState] = useState('idle')  // idle | loading | done | error
  const [desktopState, setDesktopState] = useState('idle')  // idle | loading | done | error
  const [ngrokUrl, setNgrokUrl] = useState('')
  const [ngrokToken, setNgrokToken] = useState('')
  const [copied, setCopied] = useState('')

  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  const baseUrl = isLocalhost
    ? (ngrokUrl.trim().replace(/\/$/, ''))
    : window.location.origin
  const mcpUrl = baseUrl + '/mcp'
  const webSteps = isLocalhost ? 3 : 2

  const copy = (text, key) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(''), 2000)
  }

  const installClaudeCode = async () => {
    if (!token) { setCcState('error'); return }
    setCcState('loading')
    try {
      const res = await fetch('/api/mcp/install-claude-code', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      setCcState('done')
    } catch {
      setCcState('error')
    }
  }

  const installClaudeDesktop = async () => {
    if (!token) { setDesktopState('error'); return }
    setDesktopState('loading')
    try {
      const res = await fetch('/api/mcp/install-claude-desktop', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      setDesktopState('done')
    } catch {
      setDesktopState('error')
    }
  }

  const switchTab = (t) => { setTab(t); setStep(1); setCcState('idle'); setDesktopState('idle'); setNgrokUrl(''); setNgrokToken(''); setCopied('') }

  const downloadBridgeScript = async () => {
    try {
      const res = await fetch('/api/mcp/bridge-script', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'axis_mcp_bridge.py'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Failed to download bridge script — please make sure you are signed in.')
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, width: '100%', maxWidth: 440, boxShadow: '0 24px 64px rgba(0,0,0,0.4)', animation: 'modal-in 0.18s ease', overflow: 'hidden' }}
      >
        <style>{`
          @keyframes modal-in { from { opacity:0; transform:scale(0.96) translateY(8px) } to { opacity:1; transform:scale(1) translateY(0) } }
          @keyframes spin { to { transform: rotate(360deg) } }
        `}</style>

        {/* Header */}
        <div style={{ padding: '18px 18px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 18 }}>⚡</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text1)', flex: 1 }}>Connect AXIS to Claude</div>
          <button onClick={onClose} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, padding: '14px 18px 0' }}>
          {[
            { key: 'code',    label: 'Claude Code' },
            { key: 'desktop', label: 'Desktop App' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => switchTab(t.key)}
              style={{
                flex: 1, height: 38, borderRadius: 10,
                border: tab === t.key ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                background: tab === t.key ? 'var(--accent-dim)' : 'transparent',
                color: tab === t.key ? 'var(--accent-text)' : 'var(--text3)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                transition: 'all 0.15s',
              }}
            >
              <img src="/claude.png" alt="Claude" style={{ width: 16, height: 16, objectFit: 'contain' }} /> {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: 18 }}>

          {/* ── CLAUDE CODE ── */}
          {tab === 'code' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {isLocalhost ? (
                /* localhost: one-click auto-install */
                ccState === 'done' ? (
                  <div style={{ textAlign: 'center', padding: '24px 0' }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text1)', marginBottom: 6 }}>All set!</div>
                    <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 18 }}>
                      Run <code style={mono}>{'  /mcp  '}</code> in Claude Code to activate — no restart needed.
                    </div>
                    <div style={{ padding: '12px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
                      Then try:<br />
                      <strong style={{ color: 'var(--text1)' }}>"Share my current work context to AXIS"</strong>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
                      Automatically writes the MCP config into <code style={mono}>~/.claude/settings.json</code> so Claude Code can call AXIS tools directly.
                    </div>
                    {ccState === 'error' && (
                      <div style={{ fontSize: 12, color: '#F87171', padding: '8px 12px', background: 'rgba(248,113,113,0.08)', borderRadius: 8 }}>
                        Install failed — make sure the AXIS backend is running on port 8000, then retry.
                      </div>
                    )}
                    <BigBtn color="var(--accent)" onClick={installClaudeCode} disabled={ccState === 'loading'}>
                      {ccState === 'loading' ? <Spin text="Installing…" /> : ccState === 'error' ? 'Retry' : <><img src="/claude.png" alt="" style={{ width: 16, height: 16, objectFit: 'contain' }} /> Install for Claude Code</>}
                    </BigBtn>
                  </>
                )
              ) : (
                /* hosted: manual config paste */
                <>
                  <StepHead emoji="1️⃣" title="Add to ~/.claude/settings.json" sub="Paste this config into your Claude Code settings" />
                  <LabeledCopy
                    label="Config JSON"
                    text={JSON.stringify({ mcpServers: { axis: { type: 'http', url: mcpUrl, headers: { Authorization: `Bearer ${token ?? ''}` } } } }, null, 2)}
                    copied={copied === 'ccjson'}
                    onCopy={() => copy(JSON.stringify({ mcpServers: { axis: { type: 'http', url: mcpUrl, headers: { Authorization: `Bearer ${token ?? ''}` } } } }, null, 2), 'ccjson')}
                  />
                  <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>
                    Open <code style={mono}>~/.claude/settings.json</code>, merge the <code style={mono}>mcpServers</code> block in, then run <code style={mono}>/mcp</code> in Claude Code to activate.
                  </div>
                  <div style={{ padding: '12px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, marginTop: 4 }}>
                    Then try: <strong style={{ color: 'var(--text1)' }}>"Share my current work context to AXIS"</strong>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── CLAUDE DESKTOP ── */}
          {tab === 'desktop' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {isLocalhost ? (
                desktopState === 'done' ? (
                  <div style={{ textAlign: 'center', padding: '24px 0' }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text1)', marginBottom: 6 }}>All set!</div>
                    <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 18 }}>
                      Restart Claude Desktop to activate — then try in any chat:
                    </div>
                    <div style={{ padding: '12px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
                      <strong style={{ color: 'var(--text1)' }}>"Share my current work context to AXIS"</strong>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
                      Installs AXIS into the <strong style={{ color: 'var(--text1)' }}>Claude Desktop app</strong> — so you can share context and search AXIS from regular chat, not just the terminal.
                    </div>
                    {desktopState === 'error' && (
                      <div style={{ fontSize: 12, color: '#F87171', padding: '8px 12px', background: 'rgba(248,113,113,0.08)', borderRadius: 8 }}>
                        Install failed — make sure the AXIS backend is running on port 8000, then retry.
                      </div>
                    )}
                    <BigBtn color="var(--accent)" onClick={installClaudeDesktop} disabled={desktopState === 'loading'}>
                      {desktopState === 'loading' ? <Spin text="Installing…" /> : desktopState === 'error' ? 'Retry' : <><img src="/claude.png" alt="" style={{ width: 16, height: 16, objectFit: 'contain' }} /> Install for Claude Desktop</>}
                    </BigBtn>
                  </>
                )
              ) : (
                /* hosted: one-click deep link + manual fallback */
                <>
                  {/* One-click install */}
                  <div style={{ textAlign: 'center', padding: '6px 0 2px' }}>
                    <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 14 }}>
                      Click below — Claude Desktop opens and adds AXIS automatically.
                    </div>
                    <BigBtn
                      color="var(--accent)"
                      onClick={() => {
                        const params = new URLSearchParams({
                          name: 'AXIS',
                          url: mcpUrl,
                          type: 'http',
                          'header_Authorization': `Bearer ${token ?? ''}`,
                        })
                        window.location.href = `claude://add-mcp?${params.toString()}`
                      }}
                    >
                      <img src="/claude.png" alt="" style={{ width: 16, height: 16, objectFit: 'contain' }} />
                      Add AXIS to Claude Desktop
                    </BigBtn>
                  </div>

                  {/* Divider */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '2px 0' }}>
                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                    <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>OR MANUALLY</span>
                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  </div>

                  {/* Manual fallback — 2 steps, no bridge script */}
                  <StepHead emoji="1️⃣" title="Paste into claude_desktop_config.json" sub="Mac: ~/Library/Application Support/Claude/" />
                  <LabeledCopy
                    label="Config JSON"
                    text={JSON.stringify({ mcpServers: { axis: { type: 'http', url: mcpUrl, headers: { Authorization: `Bearer ${token ?? ''}` } } } }, null, 2)}
                    copied={copied === 'dtjson'}
                    onCopy={() => copy(JSON.stringify({ mcpServers: { axis: { type: 'http', url: mcpUrl, headers: { Authorization: `Bearer ${token ?? ''}` } } } }, null, 2), 'dtjson')}
                  />

                  <StepHead emoji="2️⃣" title="Restart Claude Desktop" sub="Quit completely (Cmd+Q), then reopen" />
                  <div style={{ padding: '12px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
                    Then try: <strong style={{ color: 'var(--text1)' }}>"Share my current work context to AXIS"</strong>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── CLAUDE.AI ── */}
          {tab === 'web' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Progress dots */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                {Array.from({ length: webSteps }, (_, i) => i + 1).map(n => (
                  <div key={n} style={{ width: n === step ? 20 : 8, height: 8, borderRadius: 4, background: n === step ? 'var(--accent)' : n < step ? '#10B981' : 'var(--border)', transition: 'all 0.2s' }} />
                ))}
              </div>

              {/* STEP 1 (localhost only) — ngrok auth + run */}
              {isLocalhost && step === 1 && (
                <>
                  <StepHead emoji="1️⃣" title="Set up ngrok" sub="Free account needed — takes 30 seconds" />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

                    {/* 1a — sign up */}
                    <SubLabel text="Sign up for a free ngrok account" />
                    <BigBtn color="var(--surface2)" onClick={() => window.open('https://dashboard.ngrok.com/signup', '_blank')}>
                      <span style={{ color: 'var(--accent-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        Open ngrok signup →
                      </span>
                    </BigBtn>

                    {/* 1b — paste auth token */}
                    <SubLabel text="Paste your authtoken from the dashboard" />
                    <input
                      value={ngrokToken}
                      onChange={e => setNgrokToken(e.target.value)}
                      placeholder="2abc123_xxxxxxxxxxxxxxxxxxxx"
                      style={{ width: '100%', boxSizing: 'border-box', height: 40, background: 'var(--surface2)', border: `1.5px solid ${ngrokToken.length > 10 ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 10, color: 'var(--text1)', fontSize: 13, padding: '0 12px', fontFamily: 'JetBrains Mono, monospace', outline: 'none', transition: 'border-color 0.15s' }}
                    />

                    {/* 1c — run auth command */}
                    <SubLabel text="Run this in your terminal" />
                    <CopyBox
                      text={ngrokToken.length > 10 ? `ngrok config add-authtoken ${ngrokToken}` : 'ngrok config add-authtoken YOUR_TOKEN'}
                      copied={copied === 'auth'}
                      disabled={ngrokToken.length <= 10}
                      onCopy={() => copy(`ngrok config add-authtoken ${ngrokToken}`, 'auth')}
                    />

                    {/* 1d — start tunnel */}
                    <SubLabel text="Then start the tunnel" />
                    <CopyBox text="ngrok http 8000" copied={copied === 'ngrok'} onCopy={() => copy('ngrok http 8000', 'ngrok')} />
                  </div>

                  <BigBtn color="var(--accent)" onClick={() => setStep(2)} disabled={ngrokToken.length <= 10}>
                    Done — Next →
                  </BigBtn>
                </>
              )}

              {/* STEP 2 (localhost) / STEP 1 (prod) — paste URL / confirm URL */}
              {((isLocalhost && step === 2) || (!isLocalhost && step === 1)) && (
                <>
                  {isLocalhost ? (
                    <>
                      <StepHead emoji="2️⃣" title="Paste your ngrok URL" sub="Copy the https:// URL from your terminal" />
                      <input
                        autoFocus
                        value={ngrokUrl}
                        onChange={e => setNgrokUrl(e.target.value)}
                        placeholder="https://abc-123.ngrok-free.app"
                        style={{ width: '100%', boxSizing: 'border-box', height: 42, background: 'var(--surface2)', border: `1.5px solid ${ngrokUrl.startsWith('http') ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 10, color: 'var(--text1)', fontSize: 14, padding: '0 14px', fontFamily: 'Inter, sans-serif', outline: 'none', transition: 'border-color 0.15s' }}
                      />
                      <BigBtn color="var(--accent)" onClick={() => ngrokUrl.startsWith('http') && setStep(3)} disabled={!ngrokUrl.startsWith('http')}>
                        Next →
                      </BigBtn>
                    </>
                  ) : (
                    <>
                      <StepHead emoji="1️⃣" title="Your AXIS server URL" sub="Already public — no extra setup needed" />
                      <CopyBox text={mcpUrl} copied={copied === 'url'} onCopy={() => copy(mcpUrl, 'url')} />
                      <BigBtn color="var(--accent)" onClick={() => setStep(2)}>
                        Copied → Next
                      </BigBtn>
                    </>
                  )}
                </>
              )}

              {/* STEP 3 (localhost) / STEP 2 (prod) — copy + open Claude.ai */}
              {((isLocalhost && step === 3) || (!isLocalhost && step === 2)) && (
                <>
                  <StepHead emoji={isLocalhost ? '3️⃣' : '2️⃣'} title="Add the connector in Claude.ai" sub="Customize → Connectors → +" />

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {isLocalhost && (
                      <LabeledCopy label="Server URL" text={mcpUrl} copied={copied === 'url'} onCopy={() => copy(mcpUrl, 'url')} />
                    )}
                    <LabeledCopy label="Token (paste when Claude.ai asks)" text={token ?? ''} copied={copied === 'token'} onCopy={() => copy(token ?? '', 'token')} />
                  </div>

                  <BigBtn color="#FB923C" onClick={() => window.open('https://claude.ai/settings/integrations', '_blank')}>
                    Open Claude.ai Connectors →
                  </BigBtn>
                  <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', lineHeight: 1.5 }}>
                    In Claude.ai: <strong style={{ color: 'var(--text2)' }}>Customize → Connectors → +</strong><br />paste the server URL, then the token when prompted
                  </div>
                </>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── helpers ── */

function BigBtn({ color, onClick, disabled = false, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ width: '100%', height: 44, borderRadius: 12, border: 'none', background: disabled ? 'var(--surface2)' : color, color: disabled ? 'var(--text3)' : '#fff', fontSize: 14, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: disabled ? 0.5 : 1, transition: 'opacity 0.15s' }}
    >
      {children}
    </button>
  )
}

function CopyBox({ text, copied, onCopy, disabled = false }) {
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ background: 'var(--surface2)', border: `1px solid ${copied ? '#10B98166' : 'var(--border)'}`, borderRadius: 10, padding: '11px 52px 11px 14px', fontSize: 13, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text1)', wordBreak: 'break-all', lineHeight: 1.5, transition: 'border-color 0.15s' }}>
        {text}
      </div>
      <button
        onClick={onCopy}
        disabled={disabled}
        style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', height: 28, padding: '0 10px', borderRadius: 7, border: `1px solid ${copied ? '#10B98166' : 'var(--border)'}`, background: copied ? 'rgba(16,185,129,0.1)' : 'var(--surface)', color: copied ? '#10B981' : 'var(--text3)', fontSize: 12, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif', transition: 'all 0.15s', whiteSpace: 'nowrap', opacity: disabled ? 0.4 : 1 }}
      >
        {copied ? '✓ Copied' : 'Copy'}
      </button>
    </div>
  )
}

function LabeledCopy({ label, text, copied, onCopy }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>{label}</div>
      <CopyBox text={text} copied={copied} onCopy={onCopy} />
    </div>
  )
}

function SubLabel({ text }) {
  return <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{text}</div>
}

function StepHead({ emoji, title, sub }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ fontSize: 22, flexShrink: 0 }}>{emoji}</div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text1)' }}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{sub}</div>
      </div>
    </div>
  )
}

function Spin({ text }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
      {text}
    </span>
  )
}

const mono = { fontFamily: 'JetBrains Mono, monospace', fontSize: 12, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 6px' }
