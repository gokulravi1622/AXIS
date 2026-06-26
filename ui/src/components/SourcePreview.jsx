import { useEffect } from 'react'

const TEAM_COLORS = {
  engineering: '#F59E0B', data: '#3B82F6', crm: '#8B5CF6',
  client_success: '#10B981', product: '#EC4899',
}
function getTeamColor(team) {
  if (!team) return '#6366F1'
  return TEAM_COLORS[team.toLowerCase().replace(/\s+/g, '_')] || '#6366F1'
}

export default function SourcePreview({ source, onClose }) {
  const color = getTeamColor(source?.team)

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  if (!source) return null

  const rel = source.relevance != null ? Math.round(source.relevance) : null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(2px)',
          animation: 'fadeIn 0.2s ease',
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 'clamp(320px, 40vw, 520px)',
        background: 'var(--surface)',
        borderLeft: '1px solid var(--border)',
        zIndex: 1001,
        display: 'flex', flexDirection: 'column',
        animation: 'slideInRight 0.25s cubic-bezier(0.16,1,0.3,1)',
        boxShadow: '-16px 0 48px rgba(0,0,0,0.3)',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 20px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'flex-start', gap: 12,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: color + '1a', border: `1px solid ${color}33`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16,
          }}>
            {{ Engineering: '⚙️', Data: '📊', CRM: '🗂️', 'Client Success': '🤝', Product: '🧭' }[source.team] || '📄'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>
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
        <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {rel !== null && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '3px 10px', borderRadius: 20,
              background: color + '15', border: `1px solid ${color}33`,
              fontSize: 12, fontWeight: 600, color,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: color }} />
              {rel}% relevance
            </div>
          )}
          {source.source && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '3px 10px', borderRadius: 20,
              background: 'var(--surface2)', border: '1px solid var(--border)',
              fontSize: 12, color: 'var(--text2)',
            }}>
              {source.source === 'jira' ? '🎯 Jira' : source.source === 'confluence' ? '📝 Confluence' : '✍️ Contributed'}
            </div>
          )}
          {source.url && (
            <a
              href={source.url} target="_blank" rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 10px', borderRadius: 20,
                background: 'var(--accent-dim)', border: '1px solid rgba(99,102,241,0.3)',
                fontSize: 12, fontWeight: 500, color: 'var(--accent-text)',
                textDecoration: 'none', transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              Open ↗
            </a>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {source.content ? (
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
          )}
        </div>

        {/* Footer hint */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text3)', textAlign: 'center' }}>
          Press <kbd style={{ padding: '1px 5px', borderRadius: 4, background: 'var(--surface2)', border: '1px solid var(--border)', fontSize: 10 }}>Esc</kbd> to close
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0 }
          to { transform: translateX(0); opacity: 1 }
        }
      `}</style>
    </>
  )
}
