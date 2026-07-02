import { useState } from 'react'

const TYPE_META = {
  Fix:          { icon: '🔧', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)' },
  Decision:     { icon: '🧭', color: '#6366F1', bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.25)' },
  Architecture: { icon: '🏗️', color: '#3B82F6', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.25)' },
  Process:      { icon: '📋', color: '#10B981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)' },
  Learning:     { icon: '💡', color: '#EAB308', bg: 'rgba(234,179,8,0.1)',   border: 'rgba(234,179,8,0.25)' },
  Incident:     { icon: '🚨', color: '#EF4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.25)' },
}

const FLOW_STEPS = [
  { key: 'problem', label: 'Problem', color: '#F87171', bg: 'rgba(248,113,113,0.07)', border: 'rgba(248,113,113,0.2)', glow: 'rgba(248,113,113,0.35)' },
  { key: 'action',  label: 'Action',  color: '#FBBF24', bg: 'rgba(251,191,36,0.07)',  border: 'rgba(251,191,36,0.2)',  glow: 'rgba(251,191,36,0.35)' },
  { key: 'outcome', label: 'Outcome', color: '#34D399', bg: 'rgba(52,211,153,0.07)',  border: 'rgba(52,211,153,0.2)',  glow: 'rgba(52,211,153,0.35)' },
]

function EnrichedView({ enriched, content }) {
  const [showRaw, setShowRaw] = useState(false)
  const typeMeta = enriched.type ? TYPE_META[enriched.type] : null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {typeMeta && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, alignSelf: 'flex-start', padding: '3px 10px', borderRadius: 20, background: typeMeta.bg, border: `1px solid ${typeMeta.border}`, fontSize: 11.5, fontWeight: 700, color: typeMeta.color }}>
          {typeMeta.icon} {enriched.type}
        </span>
      )}
      {enriched.summary && (
        <div style={{ fontSize: 13, color: 'var(--text2)', fontStyle: 'italic', lineHeight: 1.6, padding: '9px 12px', background: 'var(--surface2)', border: `1px solid ${typeMeta?.border || 'var(--border)'}`, borderRadius: 9, borderLeft: `3px solid ${typeMeta?.color || 'var(--accent)'}` }}>
          {enriched.summary}
        </div>
      )}
      {enriched.flow && (
        <div style={{ position: 'relative', paddingLeft: 26 }}>
          <div style={{ position: 'absolute', left: 5, top: 16, bottom: 16, width: 2, background: 'linear-gradient(to bottom, #F87171, #FBBF24, #34D399)', borderRadius: 2, opacity: 0.6 }} />
          {FLOW_STEPS.map((step, i) => (
            <div key={step.key} style={{ position: 'relative', marginBottom: i < 2 ? 10 : 0 }}>
              <div style={{ position: 'absolute', left: -21, top: 14, width: 11, height: 11, borderRadius: '50%', background: step.color, border: '2px solid var(--surface)', boxShadow: `0 0 7px ${step.glow}` }} />
              <div style={{ background: step.bg, border: `1px solid ${step.border}`, borderRadius: 8, padding: '9px 12px' }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: step.color, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{step.label}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text1)', lineHeight: 1.6 }}>{enriched.flow[step.key] || '—'}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {enriched.scope?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5, padding: '8px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 9 }}>
          <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginRight: 2 }}>SCOPE</span>
          {enriched.scope.map(s => (
            <span key={s} style={{ padding: '2px 8px', borderRadius: 20, background: 'var(--bg)', border: '1px solid var(--border)', fontSize: 11, color: 'var(--text2)', fontFamily: 'JetBrains Mono, monospace' }}>{s}</span>
          ))}
        </div>
      )}
      {content && (
        <div>
          <button onClick={() => setShowRaw(r => !r)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text3)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif', transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <span style={{ display: 'inline-block', transition: 'transform 0.2s', transform: showRaw ? 'rotate(90deg)' : 'none' }}>▶</span>
            {showRaw ? 'Hide' : 'View'} full content
          </button>
          {showRaw && (
            <div style={{ marginTop: 8, padding: '12px', borderRadius: 9, background: 'var(--surface2)', border: '1px solid var(--border)', fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {content}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const TEAM_OPTIONS = ['Engineering', 'Data', 'CRM', 'Client Success', 'Product']

function timeAgo(iso) {
  if (!iso) return ''
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const TEAM_COLORS = {
  Engineering: 'var(--c-eng)',
  Data: 'var(--c-data)',
  CRM: 'var(--c-crm)',
  'Client Success': 'var(--c-cs)',
  Product: 'var(--c-prod)',
}

export default function ContributionModal({ contribution, token, onClose, onUpdated, onDeleted }) {
  const [mode, setMode] = useState('view') // 'view' | 'edit' | 'confirmDelete' | 'share'
  const [form, setForm] = useState({
    title: contribution.title,
    team: contribution.team,
    content: contribution.content,
    tags: (contribution.tags || []).join(', '),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [shareEmail, setShareEmail] = useState('')
  const [shareState, setShareState] = useState('idle') // 'idle' | 'loading' | 'done' | 'error'
  const [shareError, setShareError] = useState('')

  const handleShare = async () => {
    if (!shareEmail.trim() || !shareEmail.includes('@')) {
      setShareError('Enter a valid email address.')
      return
    }
    setShareState('loading')
    setShareError('')
    try {
      const res = await fetch(`/api/contributions/${contribution.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ recipient_email: shareEmail.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.detail || 'Share failed.')
      setShareState('done')
    } catch (e) {
      setShareError(e.message)
      setShareState('error')
    }
  }

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      setError('Title and content are required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/contributions/${contribution.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: form.title.trim(),
          content: form.content.trim(),
          tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        }),
      })
      if (!res.ok) throw new Error((await res.json()).detail || 'Update failed.')
      onUpdated({ ...contribution, ...form, tags: form.tags.split(',').map(t => t.trim()).filter(Boolean) })
      setMode('view')
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/contributions/${contribution.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.detail || 'Delete failed.')
        setSaving(false)
        return
      }
      onDeleted(contribution.id)
      onClose()
    } catch {
      setError('Delete failed.')
      setSaving(false)
    }
  }

  const teamColor = TEAM_COLORS[contribution.team] || 'var(--text3)'

  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    background: 'var(--surface2)', border: '1px solid var(--border)',
    borderRadius: 9, color: 'var(--text1)', fontSize: 13,
    padding: '9px 12px', fontFamily: 'Inter, sans-serif',
    outline: 'none', transition: 'border-color 0.15s',
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 18, width: '100%', maxWidth: 520,
          maxHeight: '85vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
          animation: 'modal-in 0.18s ease',
        }}
      >
        <style>{`@keyframes modal-in { from { opacity:0; transform:scale(0.96) translateY(10px) } to { opacity:1; transform:scale(1) translateY(0) } }`}</style>

        {/* Header */}
        <div style={{ padding: '18px 20px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 12, flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {mode === 'edit' ? (
              <input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                style={{ ...inputStyle, fontSize: 15, fontWeight: 700, padding: '6px 10px' }}
                onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
                placeholder="Title"
              />
            ) : (
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text1)', letterSpacing: '-0.01em', lineHeight: 1.3 }}>
                {contribution.title}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '2px 8px', borderRadius: 999,
                background: teamColor + '18', border: `1px solid ${teamColor}44`,
                fontSize: 11, fontWeight: 600, color: teamColor,
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: teamColor }} />
                {contribution.team}
              </span>
              {contribution.contributed_at && (
                <span style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  {timeAgo(contribution.contributed_at)}
                </span>
              )}
              {(contribution.tags || []).length > 0 && (
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                  {contribution.tags.join(', ')}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', flexShrink: 0, transition: 'border-color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--text3)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {mode === 'share' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {shareState === 'done' ? (
                <div style={{ textAlign: 'center', padding: '28px 0' }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text1)', marginBottom: 6 }}>Shared!</div>
                  <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.6 }}>
                    <strong style={{ color: 'var(--text2)' }}>{shareEmail}</strong> has been notified and can now search this context.
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
                    Enter a teammate's AXIS email to give them immediate access to <strong style={{ color: 'var(--text1)' }}>"{contribution.title}"</strong>.
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>
                      Teammate's email
                    </label>
                    <input
                      autoFocus
                      type="email"
                      value={shareEmail}
                      onChange={e => { setShareEmail(e.target.value); setShareError('') }}
                      placeholder="colleague@company.com"
                      onKeyDown={e => e.key === 'Enter' && handleShare()}
                      style={{ width: '100%', boxSizing: 'border-box', height: 40, background: 'var(--surface2)', border: `1.5px solid ${shareError ? '#F87171' : 'var(--border)'}`, borderRadius: 9, color: 'var(--text1)', fontSize: 13, padding: '0 12px', fontFamily: 'Inter, sans-serif', outline: 'none', transition: 'border-color 0.15s' }}
                      onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                      onBlur={e => e.currentTarget.style.borderColor = shareError ? '#F87171' : 'var(--border)'}
                    />
                  </div>
                  {shareError && (
                    <div style={{ fontSize: 12, color: '#F87171', padding: '6px 10px', background: 'rgba(248,113,113,0.08)', borderRadius: 7 }}>{shareError}</div>
                  )}
                  <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>
                    They'll receive an in-app notification and can immediately search for this content.
                  </div>
                </>
              )}
            </div>
          ) : mode === 'confirmDelete' ? (

            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, margin: '0 auto 16px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text1)', marginBottom: 8 }}>Delete this contribution?</div>
              <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.6 }}>
                This will permanently remove <strong style={{ color: 'var(--text2)' }}>{contribution.title}</strong> from the knowledge base and it will no longer be searchable.
              </div>
            </div>
          ) : mode === 'edit' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Team</label>
                <select
                  value={form.team}
                  onChange={e => setForm(f => ({ ...f, team: e.target.value }))}
                  style={{ ...inputStyle }}
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                  onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  {TEAM_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Content</label>
                <textarea
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  rows={8}
                  style={{ ...inputStyle, height: 'auto', resize: 'vertical', lineHeight: 1.6 }}
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                  onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
                  placeholder="Content"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Tags</label>
                <input
                  value={form.tags}
                  onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                  style={inputStyle}
                  placeholder="tag1, tag2, tag3"
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                  onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
                />
              </div>
              {error && <div style={{ fontSize: 12, color: '#F87171', padding: '6px 10px', background: 'rgba(248,113,113,0.08)', borderRadius: 7 }}>{error}</div>}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {contribution.enriched ? (
                <EnrichedView enriched={contribution.enriched} content={contribution.content} />
              ) : (
                <>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Content</label>
                  <div style={{
                    fontSize: 13, color: 'var(--text2)', lineHeight: 1.7,
                    background: 'var(--surface2)', border: '1px solid var(--border)',
                    borderRadius: 10, padding: '12px 14px',
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  }}>
                    {contribution.content}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexShrink: 0 }}>
          {mode === 'view' && (
            <>
              <button
                onClick={() => setMode('confirmDelete')}
                style={{ height: 38, padding: '0 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: '#F87171', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif', transition: 'border-color 0.15s, background 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#F87171'; e.currentTarget.style.background = 'rgba(248,113,113,0.08)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'transparent' }}
              >Delete</button>
              <button
                onClick={() => { setMode('share'); setShareState('idle'); setShareEmail(''); setShareError('') }}
                style={{ flex: 1, height: 38, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text1)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'border-color 0.15s, background 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-dim)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface2)' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
                Share
              </button>
              <button
                onClick={() => setMode('edit')}
                style={{ flex: 1, height: 38, borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
              >Edit</button>
            </>
          )}
          {mode === 'share' && (
            <>
              <button
                onClick={() => { setMode('view'); setShareState('idle') }}
                style={{ flex: 1, height: 38, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
              >{shareState === 'done' ? 'Close' : 'Cancel'}</button>
              {shareState !== 'done' && (
                <button
                  onClick={handleShare}
                  disabled={shareState === 'loading'}
                  style={{ flex: 1, height: 38, borderRadius: 10, border: 'none', background: shareState === 'loading' ? 'var(--accent-dim)' : 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: shareState === 'loading' ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif', opacity: shareState === 'loading' ? 0.7 : 1 }}
                >{shareState === 'loading' ? 'Sharing…' : 'Send'}</button>
              )}
            </>
          )}
          {mode === 'edit' && (
            <>
              <button
                onClick={() => { setMode('view'); setError('') }}
                style={{ flex: 1, height: 38, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
              >Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{ flex: 1, height: 38, borderRadius: 10, border: 'none', background: saving ? 'var(--accent-dim)' : 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif', opacity: saving ? 0.7 : 1 }}
              >{saving ? 'Saving…' : 'Save changes'}</button>
            </>
          )}
          {mode === 'confirmDelete' && (
            <>
              <button
                onClick={() => setMode('view')}
                style={{ flex: 1, height: 38, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
              >Cancel</button>
              <button
                onClick={handleDelete}
                disabled={saving}
                style={{ flex: 1, height: 38, borderRadius: 10, border: 'none', background: '#EF4444', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif', boxShadow: '0 4px 14px rgba(239,68,68,0.3)', opacity: saving ? 0.7 : 1 }}
              >{saving ? 'Deleting…' : 'Yes, delete'}</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
