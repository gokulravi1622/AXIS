import { useState, useEffect, useCallback } from 'react'

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
  ['jira', 'Jira', '/jira.png'],
  ['confluence', 'Confluence', '/confluence.png'],
  ['slack', 'Slack', '/slack.png'],
  ['notion', 'Notion', '/notion.png'],
  ['gdrive', 'Drive', '/gdrive.png'],
]

export default function Sidebar({ teamFilter, setTeamFilter, theme, setTheme, onSyncDone, onClearChat, addToast, token,
  conversations = [], currentConvId, onNewChat, onSelectConversation, onDeleteConversation, onManageConnections }) {
  const [syncLoading, setSyncLoading] = useState({})
  const [syncResults, setSyncResults] = useState({})
  const [syncLogOpen, setSyncLogOpen] = useState(false)
  const [syncLog, setSyncLog] = useState([])
  const [form, setForm] = useState({ team: 'engineering', name: '', title: '', content: '', tags: '' })
  const [formStatus, setFormStatus] = useState(null)
  const [formLoading, setFormLoading] = useState(false)
  const [attachedFile, setAttachedFile] = useState(null)
  const [openMenu, setOpenMenu] = useState(null) // { id, x, y }
  const [hoveredConvId, setHoveredConvId] = useState(null)
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')

  useEffect(() => {
    if (!openMenu) return
    const close = () => setOpenMenu(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [openMenu])
  const [schedulerStatus, setSchedulerStatus] = useState(null)
  const [countdown, setCountdown] = useState(null)
  const [connections, setConnections] = useState([])

  // Which sources this org connected during onboarding
  const loadConnections = useCallback(() => {
    if (!token) return
    fetch('/api/connections', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setConnections(d.connections || []))
      .catch(() => {})
  }, [token])

  useEffect(() => { loadConnections() }, [loadConnections])

  // Show only the sources this org connected; if none, fall back to all.
  const connectedKeys = connections.filter(c => c.connected).map(c => c.provider)
  const displaySources = connectedKeys.length
    ? SYNC_SOURCES.filter(([k]) => connectedKeys.includes(k))
    : SYNC_SOURCES


  // Build the Workspace (team) filter from the connected sources' teams.
  const TEAM_BY_LABEL = Object.fromEntries(TEAMS.filter(t => t.id).map(t => [t.label, t]))
  const connectedTeamLabels = [...new Set(
    connections.filter(c => c.connected).flatMap(c => c.teams || [])
  )]
  const workspaceTeams = connectedTeamLabels.length
    ? [TEAMS[0], ...connectedTeamLabels.map(l =>
        TEAM_BY_LABEL[l] || { id: l.toLowerCase().replace(/\s+/g, '_'), label: l, color: 'var(--c-all)' }
      )]
    : [TEAMS[0]]

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
      // Start background job — returns immediately with job_id
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ target }),
      })
      const data = await res.json()
      const job_id = data.job_id
      if (!job_id) throw new Error(data.detail || data.error || 'Sync did not return a job ID')

      // Poll job status until done or error
      let pollCount = 0
      const poll = async () => {
        if (pollCount++ > 120) return // safety: stop after 3 min of polling
        const statusRes = await fetch(`/api/sync/job/${job_id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (!statusRes.ok) return // stop polling on unexpected errors
        const job = await statusRes.json()
        if (job.log?.length) setSyncLog(job.log)
        if (job.status === 'done') {
          setSyncResults(prev => ({ ...prev, [target]: job.result }))
          setSyncLoading(prev => ({ ...prev, [target]: false }))
          if (onSyncDone) onSyncDone(job.log || [])
          if (addToast) {
            const result = job.result || {}
            const counts = Object.entries(result)
              .filter(([k, v]) => v != null && k !== 'errors')
              .map(([k, v]) => `${k}: ${v}`)
              .join(' · ')
            addToast({ type: 'manual_sync', message: `Sync complete — ${counts || '0 docs'}`, timestamp: new Date().toISOString() })
          }
        } else if (job.status === 'error') {
          setSyncResults(prev => ({ ...prev, [target]: { error: job.error } }))
          setSyncLoading(prev => ({ ...prev, [target]: false }))
          if (addToast) addToast({ type: 'error', message: `${target} sync failed: ${job.error}`, timestamp: new Date().toISOString() })
        } else {
          // still queued or running — check again in 1.5s
          setTimeout(poll, 1500)
        }
      }
      setTimeout(poll, 800)
    } catch (err) {
      const msg = err?.message || 'Sync failed'
      setSyncResults(prev => ({ ...prev, [target]: { error: msg } }))
      setSyncLoading(prev => ({ ...prev, [target]: false }))
      if (addToast) addToast({ type: 'error', message: msg, timestamp: new Date().toISOString() })
    }
  }

  const handleContribute = async (e) => {
    e.preventDefault()
    setFormLoading(true)
    setFormStatus(null)
    try {
      let res
      if (attachedFile) {
        const fd = new FormData()
        fd.append('team', form.team)
        fd.append('title', form.title)
        fd.append('author', form.name || '')
        fd.append('tags', form.tags)
        fd.append('file', attachedFile)
        res = await fetch('/api/contribute/file', { method: 'POST', body: fd })
      } else {
        const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean)
        res = await fetch('/api/contribute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ team: form.team, title: form.title, content: form.content, author: form.name || 'Anonymous', tags }),
        })
      }
      const data = await res.json()
      if (!res.ok) {
        setFormStatus({ ok: false, msg: data.detail || 'Failed to add context.' })
      } else {
        const msg = attachedFile
          ? `"${data.title}" added (${data.chars?.toLocaleString()} chars)`
          : 'Context added successfully!'
        setFormStatus({ ok: true, msg })
        setForm({ team: 'engineering', name: '', title: '', content: '', tags: '' })
        setAttachedFile(null)
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
      width: 300,
      minWidth: 300,
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
        {/* Chats */}
        <div style={sectionLabel}>Chats</div>
        <div style={{ padding: '0 8px' }}>
          <button
            onClick={onNewChat}
            style={{
              width: '100%', height: 34, borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--surface2)', color: 'var(--text1)', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'Inter, sans-serif', display: 'flex',
              alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border2)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
          >
            + New chat
          </button>
          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 220, overflowY: 'auto' }}>
            {conversations.length === 0 && (
              <div style={{ fontSize: 11.5, color: 'var(--text3)', padding: '6px 10px' }}>No chats yet</div>
            )}
            {conversations.map(c => {
              const active = c.id === currentConvId
              const menuOpen = openMenu?.id === c.id
              const isRenaming = renamingId === c.id
              return (
                <div key={c.id} style={{ position: 'relative' }}
                  onMouseEnter={() => setHoveredConvId(c.id)}
                  onMouseLeave={() => { if (!menuOpen) setHoveredConvId(null) }}
                >
                  <div
                    onClick={() => { if (!isRenaming) onSelectConversation(c.id) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: isRenaming ? '4px 8px 4px 10px' : '7px 8px 7px 10px',
                      borderRadius: 8, cursor: isRenaming ? 'default' : 'pointer', marginBottom: 1,
                      background: active ? 'var(--accent-dim)' : 'transparent',
                      border: active ? '1px solid var(--accent)' : '1px solid transparent',
                    }}
                    onMouseEnter={e => { if (!active && !isRenaming) e.currentTarget.style.background = 'var(--surface2)' }}
                    onMouseLeave={e => { if (!active && !isRenaming) e.currentTarget.style.background = 'transparent' }}
                  >
                    {isRenaming ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onBlur={() => setRenamingId(null)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') setRenamingId(null)
                          if (e.key === 'Escape') setRenamingId(null)
                        }}
                        onClick={e => e.stopPropagation()}
                        style={{ flex: 1, fontSize: 12.5, background: 'var(--surface2)', border: '1px solid var(--accent)', borderRadius: 5, color: 'var(--text1)', padding: '3px 7px', outline: 'none', fontFamily: 'Inter, sans-serif' }}
                      />
                    ) : (
                      <span style={{ flex: 1, fontSize: 12.5, color: active ? 'var(--text1)' : 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.title}>
                        {c.title}
                      </span>
                    )}
                    {!isRenaming && (hoveredConvId === c.id || menuOpen) && (
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          if (menuOpen) { setOpenMenu(null); return }
                          const rect = e.currentTarget.getBoundingClientRect()
                          setOpenMenu({ id: c.id, title: c.title, x: rect.right, y: rect.bottom + 4 })
                        }}
                        style={{ border: 'none', background: 'none', color: menuOpen ? 'var(--text1)' : 'var(--text3)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 3px', flexShrink: 0, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22 }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--text1)'; e.currentTarget.style.background = 'var(--surface2)' }}
                        onMouseLeave={e => { e.currentTarget.style.color = menuOpen ? 'var(--text1)' : 'var(--text3)'; e.currentTarget.style.background = 'none' }}
                      >⋮</button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Workspace */}
        <div style={sectionLabel}>Workspace</div>
        <div style={{ padding: '0 8px' }}>
          {workspaceTeams.map(team => {
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

        {!connectedTeamLabels.length && (
          <div style={{ margin: '4px 8px 0', fontSize: 11, color: 'var(--text3)', padding: '6px 10px', background: 'var(--surface2)', borderRadius: 8, lineHeight: 1.5 }}>
            Teams appear after your first sync
          </div>
        )}

        {/* Data Sync */}
        <div style={sectionLabel}>Data Sync</div>
        <div style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button
            onClick={onManageConnections}
            style={{
              width: '100%', height: 34, borderRadius: 8, border: '1px solid var(--accent)',
              background: 'var(--accent-dim)', color: 'var(--accent-text, var(--accent))',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              marginBottom: 2,
            }}
          >
            + Connect a tool
          </button>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {displaySources.map(([target, label, icon]) => (
              <button
                key={target}
                onClick={() => handleSync(target)}
                disabled={syncLoading[target]}
                style={{ ...btnBase, flex: '1 1 30%', minWidth: 76, opacity: syncLoading[target] ? 0.7 : 1 }}
              >
                {syncLoading[target] ? (
                  <span style={{ display: 'inline-block', width: 10, height: 10, border: '2px solid var(--border2)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                ) : (
                  <img src={icon} alt={label} style={{ width: 14, height: 14, objectFit: 'contain' }} />
                )}
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
              placeholder={attachedFile ? 'Title (optional — defaults to filename)' : 'Title *'}
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              required={!attachedFile}
              style={inputStyle}
            />

            {/* File attach or text content */}
            {attachedFile ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 8 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
                <span style={{ fontSize: 11.5, color: 'var(--text2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachedFile.name}</span>
                <span style={{ fontSize: 10.5, color: 'var(--text3)', flexShrink: 0 }}>{(attachedFile.size / 1024).toFixed(0)} KB</span>
                <button type="button" onClick={() => setAttachedFile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 14, lineHeight: 1, padding: '0 2px', flexShrink: 0 }}
                  onMouseEnter={e => e.currentTarget.style.color = '#F87171'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text3)'}
                >×</button>
              </div>
            ) : (
              <textarea
                placeholder="Details / content *"
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                required
                rows={4}
                style={{ ...inputStyle, height: 'auto', padding: '8px 10px', resize: 'vertical' }}
              />
            )}

            <input
              placeholder="Tags (comma-separated)"
              value={form.tags}
              onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
              style={inputStyle}
            />

            {/* Hidden file input */}
            <input
              id="ctx-file-input"
              type="file"
              accept=".pdf,.docx,.txt,.md,.csv"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) setAttachedFile(f); e.target.value = '' }}
            />

            {formStatus && (
              <div style={{ fontSize: 12, color: formStatus.ok ? 'var(--c-cs)' : '#F87171', padding: '4px 6px', background: formStatus.ok ? 'rgba(16,185,129,0.08)' : 'rgba(248,113,113,0.08)', borderRadius: 6 }}>
                {formStatus.msg}
              </div>
            )}

            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                title="Attach a file (PDF, DOCX, TXT, MD)"
                onClick={() => document.getElementById('ctx-file-input').click()}
                style={{ height: 34, width: 36, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'border-color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.42 16.41a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                </svg>
              </button>
              <button
                type="submit"
                disabled={formLoading}
                style={{ flex: 1, height: 34, background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: formLoading ? 'not-allowed' : 'pointer', opacity: formLoading ? 0.7 : 1, fontFamily: 'Inter, sans-serif' }}
              >
                {formLoading ? 'Adding…' : 'Add Context'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Conversation context menu — rendered at fixed position to escape overflow:hidden */}
      {openMenu && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed', left: openMenu.x - 152, top: openMenu.y, zIndex: 9999,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 10, boxShadow: '0 8px 28px rgba(0,0,0,0.35)',
            padding: 4, minWidth: 152,
          }}
        >
          <button
            onClick={() => { setRenameValue(openMenu.title); setRenamingId(openMenu.id); setOpenMenu(null) }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 11px', borderRadius: 7, border: 'none', background: 'none', color: 'var(--text1)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter, sans-serif', textAlign: 'left' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Rename
          </button>
          <div style={{ height: 1, background: 'var(--border)', margin: '3px 4px' }} />
          <button
            onClick={() => { const id = openMenu.id; setOpenMenu(null); setHoveredConvId(null); onDeleteConversation(id) }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 11px', borderRadius: 7, border: 'none', background: 'none', color: '#F87171', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter, sans-serif', textAlign: 'left' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,113,113,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            Delete
          </button>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        select option { background: var(--surface2); color: var(--text1); }
      `}</style>
    </div>
  )
}
