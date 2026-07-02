import { useEffect, useState } from 'react'

const TEAM_COLORS = {
  engineering: '#F59E0B', data: '#3B82F6', crm: '#8B5CF6',
  client_success: '#10B981', product: '#EC4899',
}
function getTeamColor(team) {
  if (!team) return '#6366F1'
  return TEAM_COLORS[team.toLowerCase().replace(/\s+/g, '_')] || '#6366F1'
}

const TYPE_META = {
  Fix:          { icon: '🔧', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)',   border: 'rgba(245,158,11,0.25)' },
  Decision:     { icon: '🧭', color: '#6366F1', bg: 'rgba(99,102,241,0.1)',   border: 'rgba(99,102,241,0.25)' },
  Architecture: { icon: '🏗️', color: '#3B82F6', bg: 'rgba(59,130,246,0.1)',   border: 'rgba(59,130,246,0.25)' },
  Process:      { icon: '📋', color: '#10B981', bg: 'rgba(16,185,129,0.1)',   border: 'rgba(16,185,129,0.25)' },
  Learning:     { icon: '💡', color: '#EAB308', bg: 'rgba(234,179,8,0.1)',    border: 'rgba(234,179,8,0.25)' },
  Incident:     { icon: '🚨', color: '#EF4444', bg: 'rgba(239,68,68,0.1)',    border: 'rgba(239,68,68,0.25)' },
}

const FLOW_STEPS = [
  { key: 'problem', label: 'Problem',  color: '#F87171', glow: 'rgba(248,113,113,0.35)', bg: 'rgba(248,113,113,0.07)', border: 'rgba(248,113,113,0.2)' },
  { key: 'action',  label: 'Action',   color: '#FBBF24', glow: 'rgba(251,191,36,0.35)',  bg: 'rgba(251,191,36,0.07)',  border: 'rgba(251,191,36,0.2)' },
  { key: 'outcome', label: 'Outcome',  color: '#34D399', glow: 'rgba(52,211,153,0.35)',  bg: 'rgba(52,211,153,0.07)',  border: 'rgba(52,211,153,0.2)' },
]

function FlowTimeline({ flow }) {
  return (
    <div style={{ position: 'relative', paddingLeft: 28 }}>
      {/* Gradient connector line */}
      <div style={{
        position: 'absolute', left: 7, top: 18, bottom: 18, width: 2,
        background: 'linear-gradient(to bottom, #F87171 0%, #FBBF24 50%, #34D399 100%)',
        borderRadius: 2, opacity: 0.6,
      }} />

      {FLOW_STEPS.map((step, i) => (
        <div key={step.key} style={{ position: 'relative', marginBottom: i < 2 ? 14 : 0 }}>
          {/* Glowing dot */}
          <div style={{
            position: 'absolute', left: -23, top: 16,
            width: 12, height: 12, borderRadius: '50%',
            background: step.color,
            border: '2px solid var(--surface)',
            boxShadow: `0 0 8px ${step.glow}`,
          }} />
          {/* Card */}
          <div style={{
            background: step.bg,
            border: `1px solid ${step.border}`,
            borderRadius: 10, padding: '10px 14px',
          }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: step.color,
              textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5,
            }}>
              {step.label}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text1)', lineHeight: 1.6 }}>
              {flow?.[step.key] || '—'}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function ScopeChips({ scope }) {
  if (!scope?.length) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5 }}>
      <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginRight: 2 }}>
        SCOPE
      </span>
      {scope.map(s => (
        <span key={s} style={{
          padding: '2px 9px', borderRadius: 20,
          background: 'var(--surface2)', border: '1px solid var(--border)',
          fontSize: 11, color: 'var(--text2)',
          fontFamily: 'JetBrains Mono, monospace',
        }}>
          {s}
        </span>
      ))}
    </div>
  )
}

export default function SourcePreview({ source, onClose }) {
  const [showRaw, setShowRaw] = useState(false)
  const color = getTeamColor(source?.team)
  const enriched = source?.enriched
  const typeMeta = enriched?.type ? TYPE_META[enriched.type] : null

  useEffect(() => {
    setShowRaw(false)
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose, source])

  if (!source) return null
  const rel = source.relevance != null ? Math.round(source.relevance) : null

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)',
          animation: 'fadeIn 0.2s ease',
        }}
      />

      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 'clamp(340px, 42vw, 540px)',
        background: 'var(--surface)',
        borderLeft: '1px solid var(--border)',
        zIndex: 1001,
        display: 'flex', flexDirection: 'column',
        animation: 'slideInRight 0.25s cubic-bezier(0.16,1,0.3,1)',
        boxShadow: '-16px 0 48px rgba(0,0,0,0.3)',
      }}>

        {/* Header */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            background: color + '1a', border: `1px solid ${color}33`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
          }}>
            {{ Engineering: '⚙️', Data: '📊', CRM: '🗂️', 'Client Success': '🤝', Product: '🧭' }[source.team] || '📄'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>
              {source.team}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text1)', lineHeight: 1.35, wordBreak: 'break-word' }}>
              {source.title}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text3)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, flexShrink: 0, transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--text1)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text3)' }}
          >×</button>
        </div>

        {/* Meta row */}
        <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {rel !== null && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 10px', borderRadius: 20,
              background: color + '15', border: `1px solid ${color}33`,
              fontSize: 11.5, fontWeight: 600, color,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: color }} />
              {rel}% match
            </span>
          )}
          {typeMeta && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '3px 10px', borderRadius: 20,
              background: typeMeta.bg, border: `1px solid ${typeMeta.border}`,
              fontSize: 11.5, fontWeight: 700, color: typeMeta.color,
            }}>
              {typeMeta.icon} {enriched.type}
            </span>
          )}
          {source.source && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 10px', borderRadius: 20,
              background: 'var(--surface2)', border: '1px solid var(--border)',
              fontSize: 11.5, color: 'var(--text2)',
            }}>
              {source.source === 'jira' ? '🎯 Jira' : source.source === 'confluence' ? '📝 Confluence' : '✍️ Contributed'}
            </span>
          )}
          {source.url && (
            <a
              href={source.url} target="_blank" rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 10px', borderRadius: 20,
                background: 'var(--accent-dim)', border: '1px solid rgba(99,102,241,0.3)',
                fontSize: 11.5, fontWeight: 500, color: 'var(--accent-text)',
                textDecoration: 'none', transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >Open ↗</a>
          )}
          {source.shared && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 10px', borderRadius: 20,
              background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)',
              fontSize: 11.5, color: '#10B981',
            }}>
              🤝 Shared by {source.shared_from?.split('@')[0]}
            </span>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {enriched ? (
            <>
              {/* Summary */}
              {enriched.summary && (
                <div style={{
                  fontSize: 13.5, color: 'var(--text2)', fontStyle: 'italic',
                  lineHeight: 1.6, padding: '10px 14px',
                  background: 'var(--surface2)', border: '1px solid var(--border)',
                  borderRadius: 10, borderLeft: `3px solid ${typeMeta?.color || color}`,
                }}>
                  {enriched.summary}
                </div>
              )}

              {/* Flow timeline */}
              {enriched.flow && <FlowTimeline flow={enriched.flow} />}

              {/* Scope chips */}
              {enriched.scope?.length > 0 && (
                <div style={{ padding: '10px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10 }}>
                  <ScopeChips scope={enriched.scope} />
                </div>
              )}

              {/* Collapsible raw content */}
              {source.content && (
                <div>
                  <button
                    onClick={() => setShowRaw(r => !r)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                      padding: '8px 14px', borderRadius: 8,
                      background: 'transparent', border: '1px solid var(--border)',
                      color: 'var(--text3)', fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                      transition: 'background 0.15s, color 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--text2)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text3)' }}
                  >
                    <span style={{ transition: 'transform 0.2s', display: 'inline-block', transform: showRaw ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                    {showRaw ? 'Hide' : 'View'} full content
                  </button>
                  {showRaw && (
                    <div style={{
                      marginTop: 8, padding: '14px', borderRadius: 10,
                      background: 'var(--surface2)', border: '1px solid var(--border)',
                      fontSize: 13, color: 'var(--text2)', lineHeight: 1.7,
                      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      fontFamily: 'Inter, sans-serif',
                      animation: 'fadeIn 0.15s ease',
                    }}>
                      {source.content}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            /* Plain view for non-enriched sources */
            source.content ? (
              <div style={{
                fontSize: 13.5, color: 'var(--text1)', lineHeight: 1.75,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                fontFamily: 'Inter, sans-serif',
              }}>
                {source.content}
              </div>
            ) : (
              <div style={{ color: 'var(--text3)', fontSize: 13, fontStyle: 'italic' }}>
                No preview available for this source.
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text3)', textAlign: 'center' }}>
          Press <kbd style={{ padding: '1px 5px', borderRadius: 4, background: 'var(--surface2)', border: '1px solid var(--border)', fontSize: 10 }}>Esc</kbd> to close
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0 }
          to   { transform: translateX(0);   opacity: 1 }
        }
      `}</style>
    </>
  )
}
