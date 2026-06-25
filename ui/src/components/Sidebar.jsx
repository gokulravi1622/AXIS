import { useState, useEffect } from 'react'

const TEAMS = [
  { id: null, label: 'All Teams', color: 'var(--c-all)' },
  { id: 'engineering', label: 'Engineering', color: 'var(--c-eng)' },
  { id: 'data', label: 'Data', color: 'var(--c-data)' },
  { id: 'crm', label: 'CRM', color: 'var(--c-crm)' },
  { id: 'client_success', label: 'Client Success', color: 'var(--c-cs)' },
  { id: 'product', label: 'Product', color: 'var(--c-prod)' },
]

const TEAM_OPTIONS = TEAMS.filter(t => t.id !== null)

// [target key, button label] — key matches the count field in the /api/sync response
const SYNC_SOURCES = [
  ['jira', 'Jira'],
  ['confluence', 'Confluence'],
  ['slack', 'Slack'],
  ['notion', 'Notion'],
  ['gdrive', 'Drive'],
]

export default function Sidebar({ teamFilter, setTeamFilter, theme, setTheme, onSyncDone, onClearChat, addToast }) {
  const [stats, setStats] = useState({ total: 0, teams: 0, byTeam: {} })
  const [syncLoading, setSyncLoading] = useState({})
  const [syncResults, setSyncResults] = useState({})
  const [syncLogOpen, setSyncLogOpen] = useState(false)
  const [syncLog, setSyncLog] = useState([])
  const [form, setForm] = useState({ team: 'engineering', name: '', title: '', content: '', tags: '' })
  const [formStatus, setFormStatus] = useState(null)
  const [formLoading, setFormLoading] = useState(false)
  const [schedulerStatus, setSchedulerStatus] = useState(null)
  const [countdown, setCountdown] = useState(null)

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(d => setStats(d))
      .catch(() => {})
  }, [])

  // Fetch scheduler status on mount + every 60s
  useEffect(() => {
    const fetchStatus = () =>
      fetch('/api/scheduler').then(r => r.json()).then(d => {
        setSchedulerStatus(d)
        setCountdown(d.next_sync_in_seconds)
      }).catch(() => {})
    fetchStatus()
    const interval = setInterval(fetchStatus, 60000)
    return () => clearInterval(interval)
  }, [])

  // Tick countdown every second
  useEffect(() => {
    if (countdown === null) return
    const t = setInterval(() => setCountdown(c => (c > 0 ? c - 1 : 0)), 1000)
    return () => clearInterval(t)
  }, [countdown])

  const handleSync = async (target) => {
    setSyncLoading(prev => ({ ...prev, [target]: true }))
    setSyncResults(prev => ({ ...prev, [target]: null }))
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target }),
      })
      const data = await res.json()
      setSyncResults(prev => ({ ...prev, [target]: data }))
      if (data.log) setSyncLog(data.log)
      if (onSyncDone && data.log) onSyncDone(data.log)
      if (addToast) {
        const label = Object.fromEntries(SYNC_SOURCES)
        const message = target === 'both'
          ? 'Synced — ' + SYNC_SOURCES.map(([k, l]) => `${l} ${data[k] ?? 0}`).join(' · ')
          : `${label[target] || target}: ${data[target] ?? 0} synced`
        addToast({ type: 'manual_sync', message, timestamp: new Date().toISOString() })
      }
    } catch {
      setSyncResults(prev => ({ ...prev, [target]: { error: 'Sync failed' } }))
      if (addToast) addToast({ type: 'error', message: `${target} sync failed`, timestamp: new Date().toISOString() })
    } finally {
      setSyncLoading(prev => ({ ...prev, [target]: false }))
    }
  }

  const handleContribute = async (e) => {
    e.preventDefault()
    setFormLoading(true)
    setFormStatus(null)
    try {
      const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean)
      const res = await fetch('/api/contribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team: form.team, title: form.title, content: form.content, author: form.name || 'Anonymous', tags }),
      })
      const data = await res.json()
      if (data.id) {
        setFormStatus({ ok: true, msg: 'Context added successfully!' })
        setForm({ team: 'engineering', name: '', title: '', content: '', tags: '' })
      } else {
        setFormStatus({ ok: false, msg: 'Failed to add context.' })
      }
    } catch {
      setFormStatus({ ok: false, msg: 'Network error.' })
    } finally {
      setFormLoading(false)
    }
  }

  const sectionLabel = {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'var(--text3)',
    padding: '0 16px',
    marginBottom: 6,
    marginTop: 18,
  }

  const inputStyle = {
    width: '100%',
    height: 34,
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text1)',
    fontSize: 13,
    padding: '0 10px',
    fontFamily: 'Inter, sans-serif',
    outline: 'none',
  }

  const btnBase = {
    flex: 1,
    height: 32,
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--surface2)',
    color: 'var(--text2)',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'Inter, sans-serif',
    transition: 'all 0.15s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  }

  return (
    <div style={{
      width: 272,
      minWidth: 272,
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      height: '100%',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>
      {/* Brand */}
      <div style={{ padding: '20px 16px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src="/axis-logo.png" alt="AXIS" style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, objectFit: 'contain' }} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text1)', letterSpacing: '-0.01em' }}>AXIS</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>Knowledge Layer · v1.0</div>
        </div>
      </div>

      <div style={{ padding: '0 0 12px', flex: 1 }}>
        {/* Workspace */}
        <div style={sectionLabel}>Workspace</div>
        <div style={{ padding: '0 8px' }}>
          {TEAMS.map(team => {
            const active = teamFilter === team.id
            return (
              <button
                key={String(team.id)}
                onClick={() => setTeamFilter(team.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: active ? `1px solid ${team.color}66` : '1px solid transparent',
                  background: active ? 'var(--accent-dim)' : 'transparent',
                  cursor: 'pointer',
                  marginBottom: 2,
                  transition: 'all 0.12s',
                  textAlign: 'left',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--surface2)' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: team.color, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? 'var(--text1)' : 'var(--text2)' }}>
                  {team.label}
                </span>
              </button>
            )
          })}
        </div>

        {/* Stats */}
        <div style={sectionLabel}>Overview</div>
        <div style={{ margin: '0 8px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 8px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
          {[
            { label: 'Docs', value: stats.total },
            { label: 'Teams', value: stats.teams },
            { label: 'Queries', value: '—' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16, fontWeight: 600, color: 'var(--text1)' }}>{s.value}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Data Sync */}
        <div style={sectionLabel}>Data Sync</div>
        <div style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {SYNC_SOURCES.map(([target, label]) => (
              <button
                key={target}
                onClick={() => handleSync(target)}
                disabled={syncLoading[target]}
                style={{ ...btnBase, flex: '1 1 30%', minWidth: 76, opacity: syncLoading[target] ? 0.7 : 1 }}
              >
                {syncLoading[target] ? (
                  <span style={{ display: 'inline-block', width: 10, height: 10, border: '2px solid var(--border2)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                ) : null}
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => handleSync('both')}
            disabled={syncLoading['both']}
            style={{ ...btnBase, flex: 'none', width: '100%', background: 'var(--accent-dim)', borderColor: 'var(--accent)', color: 'var(--accent-text)', opacity: syncLoading['both'] ? 0.7 : 1 }}
          >
            {syncLoading['both'] ? (
              <span style={{ display: 'inline-block', width: 10, height: 10, border: '2px solid var(--border2)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            ) : null}
            Sync All
          </button>
          {SYNC_SOURCES.map(([key, label]) =>
            syncResults[key] && !syncResults[key].error ? (
              <div key={key} style={{ fontSize: 11, color: 'var(--c-cs)', padding: '4px 6px', background: 'rgba(16,185,129,0.08)', borderRadius: 6 }}>
                {label}: {syncResults[key][key] ?? 0} synced
              </div>
            ) : null
          )}
          {syncResults['both'] && !syncResults['both'].error && (
            <div style={{ fontSize: 11, color: 'var(--c-cs)', padding: '4px 6px', background: 'rgba(16,185,129,0.08)', borderRadius: 6 }}>
              {SYNC_SOURCES.map(([k, l]) => `${l} ${syncResults['both'][k] ?? 0}`).join(' · ')}
            </div>
          )}
          {syncLog.length > 0 && (
            <div>
              <button onClick={() => setSyncLogOpen(v => !v)} style={{ ...btnBase, flex: 'none', width: '100%', fontSize: 11 }}>
                {syncLogOpen ? '▲' : '▼'} Sync Log ({syncLog.length})
              </button>
              {syncLogOpen && (
                <div style={{ marginTop: 4, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: 8, maxHeight: 120, overflowY: 'auto' }}>
                  {syncLog.map((line, i) => (
                    <div key={i} style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.6 }}>{line}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Scheduler status */}
        {schedulerStatus && (
          <div style={{ margin: '8px 8px 0', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: schedulerStatus.running ? '#10B981' : '#F87171', flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)' }}>
                Auto-Sync {schedulerStatus.running ? 'Active' : 'Stopped'}
              </span>
            </div>
            {schedulerStatus.last_sync && (
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 3 }}>
                Last: {new Date(schedulerStatus.last_sync).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
            {countdown !== null && countdown > 0 && (
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                Next in: {Math.floor(countdown / 3600)}h {Math.floor((countdown % 3600) / 60)}m {countdown % 60}s
              </div>
            )}
          </div>
        )}

        {/* Add Context */}
        <div style={sectionLabel}>Add Context</div>
        <div style={{ padding: '0 8px' }}>
          <form onSubmit={handleContribute} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <select
              value={form.team}
              onChange={e => setForm(f => ({ ...f, team: e.target.value }))}
              style={{ ...inputStyle }}
            >
              {TEAM_OPTIONS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <input
              placeholder="Your name (optional)"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              style={inputStyle}
            />
            <input
              placeholder="Title *"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              required
              style={inputStyle}
            />
            <textarea
              placeholder="Details / content *"
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              required
              rows={4}
              style={{ ...inputStyle, height: 'auto', padding: '8px 10px', resize: 'vertical' }}
            />
            <input
              placeholder="Tags (comma-separated)"
              value={form.tags}
              onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
              style={inputStyle}
            />
            {formStatus && (
              <div style={{ fontSize: 12, color: formStatus.ok ? 'var(--c-cs)' : '#F87171', padding: '4px 6px', background: formStatus.ok ? 'rgba(16,185,129,0.08)' : 'rgba(248,113,113,0.08)', borderRadius: 6 }}>
                {formStatus.msg}
              </div>
            )}
            <button
              type="submit"
              disabled={formLoading}
              style={{ height: 34, background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: formLoading ? 'not-allowed' : 'pointer', opacity: formLoading ? 0.7 : 1, fontFamily: 'Inter, sans-serif' }}
            >
              {formLoading ? 'Adding…' : 'Add Context'}
            </button>
          </form>
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: '1px solid var(--border)', padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button
          onClick={onClearChat}
          style={{ ...btnBase, flex: 'none', width: '100%', justifyContent: 'center' }}
        >
          Clear Chat
        </button>
        <button
          onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
          style={{ ...btnBase, flex: 'none', width: '100%', justifyContent: 'center' }}
        >
          {theme === 'dark' ? '☀ Light Mode' : '☽ Dark Mode'}
        </button>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        select option { background: var(--surface2); color: var(--text1); }
      `}</style>
    </div>
  )
}
