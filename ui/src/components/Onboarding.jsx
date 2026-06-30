import { useState, useEffect } from 'react'

// Per-provider form fields + guided instructions shown during onboarding.
const PROVIDERS = {
  jira: {
    label: 'Jira', color: 'var(--c-eng)',
    help: 'Create an API token at id.atlassian.com/manage-profile/security/api-tokens.',
    fields: [
      { key: 'base_url', label: 'Site URL', placeholder: 'https://yourorg.atlassian.net' },
      { key: 'email', label: 'Atlassian email', placeholder: 'you@yourorg.com' },
      { key: 'api_token', label: 'API token', placeholder: 'ATATT…', secret: true },
      { key: 'projects', label: 'Project keys', placeholder: 'ENG,DATA,PROD' },
    ],
  },
  confluence: {
    label: 'Confluence', color: 'var(--c-data)',
    help: 'Uses the same Atlassian site, email, and API token as Jira.',
    fields: [
      { key: 'base_url', label: 'Site URL', placeholder: 'https://yourorg.atlassian.net' },
      { key: 'email', label: 'Atlassian email', placeholder: 'you@yourorg.com' },
      { key: 'api_token', label: 'API token', placeholder: 'ATATT…', secret: true },
      { key: 'spaces', label: 'Space keys', placeholder: 'ENG,DATA' },
    ],
  },
  slack: {
    label: 'Slack', color: 'var(--c-prod)',
    help: 'Create a Slack app with a bot token (xoxb-…), scopes channels:history/read + users:read, and invite the bot to each channel.',
    fields: [
      { key: 'bot_token', label: 'Bot token', placeholder: 'xoxb-…', secret: true },
      { key: 'channels', label: 'Channels', placeholder: 'eng-help=Engineering,C0123=Data' },
    ],
  },
  notion: {
    label: 'Notion', color: 'var(--c-cs)',
    help: 'Create an internal integration at notion.so/my-integrations, then connect your pages to it (page ••• → Connections).',
    fields: [
      { key: 'token', label: 'Integration token', placeholder: 'ntn_…', secret: true },
      { key: 'team', label: 'File under team', placeholder: 'Product' },
    ],
  },
  gdrive: {
    label: 'Google Drive', color: 'var(--c-crm)',
    help: 'Create a GCP service account, enable the Drive API, download its JSON key, and share your Docs/folder with the service-account email.',
    fields: [
      { key: 'service_account_json', label: 'Service-account JSON', placeholder: '{ "type": "service_account", … }', textarea: true },
      { key: 'team', label: 'File under team', placeholder: 'Data' },
      { key: 'folder_id', label: 'Folder ID (optional)', placeholder: 'leave blank for all shared Docs' },
    ],
  },
}

const ORDER = ['jira', 'confluence', 'slack', 'notion', 'gdrive']

export default function Onboarding({ token, orgName, onComplete }) {
  const [step, setStep] = useState('select')          // 'select' | 'connect'
  const [selected, setSelected] = useState([])
  const [configs, setConfigs] = useState({})           // provider -> { field: value }
  const [status, setStatus] = useState({})             // provider -> { connected, message, loading }
  const [oauthProviders, setOauthProviders] = useState([])  // providers with one-click Connect

  const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  // On load: learn which providers support OAuth + reflect already-connected ones
  // (so returning from an OAuth redirect shows them connected).
  useEffect(() => {
    fetch('/api/connections', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        setOauthProviders(d.oauth || [])
        // Only consider providers we know how to render (ignore legacy/unknown ones)
        const connected = (d.connections || [])
          .filter(c => c.connected && PROVIDERS[c.provider])
          .map(c => c.provider)
        if (connected.length) {
          setStatus(prev => {
            const next = { ...prev }
            connected.forEach(p => { next[p] = { connected: true, message: 'Connected' } })
            return next
          })
          setSelected(prev => [...new Set([...prev, ...connected])])
          setStep('connect')
        }
      })
      .catch(() => {})
  }, [token])

  const startOAuth = (p) => {
    window.location.href = `/api/connect/${p}/start?token=${encodeURIComponent(token)}`
  }

  // Hide pure-OAuth providers (no manual fields) until the server says they're configured.
  const visibleProviders = ORDER.filter(p => oauthProviders.includes(p) || PROVIDERS[p].fields.length > 0)

  const toggle = (p) =>
    setSelected(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])

  const setField = (p, key, val) =>
    setConfigs(prev => ({ ...prev, [p]: { ...(prev[p] || {}), [key]: val } }))

  const connect = async (p) => {
    setStatus(prev => ({ ...prev, [p]: { ...prev[p], loading: true, message: null } }))
    try {
      const res = await fetch('/api/connections', {
        method: 'PUT', headers: authHeaders,
        body: JSON.stringify({ provider: p, config: configs[p] || {} }),
      })
      const data = await res.json()
      setStatus(prev => ({ ...prev, [p]: { connected: data.connected, message: data.message, loading: false } }))
    } catch {
      setStatus(prev => ({ ...prev, [p]: { connected: false, message: 'Network error', loading: false } }))
    }
  }

  const finish = async () => {
    await fetch('/api/onboarding/complete', { method: 'POST', headers: authHeaders })
    onComplete()
  }

  const connectedCount = ORDER.filter(p => status[p]?.connected).length

  const input = {
    width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
    borderRadius: 8, color: 'var(--text1)', fontSize: 13, padding: '9px 11px',
    fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{ minHeight: '100vh', width: '100vw', background: 'var(--bg)', overflowY: 'auto' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '48px 24px 80px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
          <img src="/axis-logo.png" alt="AXIS" style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'contain', marginBottom: 14 }} />
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text1)', letterSpacing: '-0.02em' }}>
            {step === 'select' ? `Set up ${orgName || 'your workspace'}` : 'Connect your tools'}
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--text3)', marginTop: 6, textAlign: 'center', maxWidth: 440, lineHeight: 1.6 }}>
            {step === 'select'
              ? 'Which tools should AXIS pull knowledge from? Pick any — you can add more later.'
              : "Enter your details for each tool and connect it. Skip any you’re not ready for yet."}
          </div>
        </div>

        {step === 'select' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {visibleProviders.map(p => {
                const on = selected.includes(p)
                const meta = PROVIDERS[p]
                return (
                  <button key={p} onClick={() => toggle(p)} style={{
                    display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                    padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                    background: on ? 'var(--accent-dim)' : 'var(--surface)',
                    border: `1px solid ${on ? meta.color : 'var(--border)'}`,
                    transition: 'all 0.15s',
                  }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text1)', flex: 1 }}>{meta.label}</span>
                    <span style={{ fontSize: 16, color: on ? meta.color : 'var(--text3)' }}>{on ? '✓' : '+'}</span>
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button onClick={finish} style={{
                flex: 1, height: 44, borderRadius: 10, border: '1px solid var(--border)',
                background: 'var(--surface2)', color: 'var(--text2)', fontSize: 14, fontWeight: 500,
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}>Skip for now</button>
              <button
                onClick={() => setStep('connect')}
                disabled={selected.length === 0}
                style={{
                  flex: 2, height: 44, borderRadius: 10, border: 'none',
                  background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 600,
                  cursor: selected.length ? 'pointer' : 'not-allowed', opacity: selected.length ? 1 : 0.5,
                  fontFamily: 'Inter, sans-serif',
                }}>Continue ({selected.length})</button>
            </div>
          </>
        )}

        {step === 'connect' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {selected.map(p => {
                const meta = PROVIDERS[p]
                if (!meta) return null
                const st = status[p] || {}
                return (
                  <div key={p} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: meta.color }} />
                      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text1)' }}>{meta.label}</span>
                      {st.connected && <span style={{ fontSize: 12, color: '#10B981', fontWeight: 600 }}>✓ connected</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12, lineHeight: 1.5 }}>
                      {oauthProviders.includes(p)
                        ? (p === 'slack'
                            ? 'Click connect and authorize Slack, then invite the bot to the channels you want synced.'
                            : `Click connect and authorize ${meta.label} — no tokens to copy.`)
                        : meta.help}
                    </div>

                    {oauthProviders.includes(p) ? (
                      // One-click OAuth — sends the user to the provider to authorize
                      <button onClick={() => startOAuth(p)} style={{
                        height: 40, padding: '0 18px', borderRadius: 8, border: 'none',
                        background: st.connected ? 'var(--surface2)' : meta.color,
                        color: st.connected ? 'var(--text2)' : '#fff', fontSize: 13.5, fontWeight: 700,
                        cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                      }}>
                        {st.connected ? `✓ ${meta.label} connected — reconnect` : `Connect with ${meta.label}`}
                      </button>
                    ) : (
                      <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {meta.fields.map(f => (
                            <div key={f.key}>
                              <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 3 }}>{f.label}</label>
                              {f.textarea ? (
                                <textarea rows={4} placeholder={f.placeholder}
                                  value={(configs[p] || {})[f.key] || ''}
                                  onChange={e => setField(p, f.key, e.target.value)}
                                  style={{ ...input, resize: 'vertical', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }} />
                              ) : (
                                <input type={f.secret ? 'password' : 'text'} placeholder={f.placeholder}
                                  value={(configs[p] || {})[f.key] || ''}
                                  onChange={e => setField(p, f.key, e.target.value)}
                                  style={input} />
                              )}
                            </div>
                          ))}
                        </div>
                        {st.message && (
                          <div style={{ fontSize: 12, marginTop: 10, padding: '6px 9px', borderRadius: 6,
                            color: st.connected ? '#10B981' : '#F87171',
                            background: st.connected ? 'rgba(16,185,129,0.08)' : 'rgba(248,113,113,0.08)' }}>
                            {st.message}
                          </div>
                        )}
                        <button onClick={() => connect(p)} disabled={st.loading} style={{
                          marginTop: 12, height: 36, padding: '0 16px', borderRadius: 8, border: 'none',
                          background: st.connected ? 'var(--surface2)' : 'var(--accent)',
                          color: st.connected ? 'var(--text2)' : '#fff', fontSize: 13, fontWeight: 600,
                          cursor: st.loading ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif',
                        }}>
                          {st.loading ? 'Testing…' : st.connected ? 'Reconnect' : 'Connect'}
                        </button>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button onClick={() => setStep('select')} style={{
                flex: 1, height: 44, borderRadius: 10, border: '1px solid var(--border)',
                background: 'var(--surface2)', color: 'var(--text2)', fontSize: 14, fontWeight: 500,
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}>Back</button>
              <button onClick={finish} style={{
                flex: 2, height: 44, borderRadius: 10, border: 'none',
                background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}>
                {connectedCount > 0 ? `Go to dashboard (${connectedCount} connected)` : 'Go to dashboard'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
