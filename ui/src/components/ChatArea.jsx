import { useState, useRef, useCallback, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import SourcePreview from './SourcePreview'

const SUGGESTIONS = [
  { team: 'Engineering', color: '#F59E0B', hex: '#F59E0B', icon: '⚙️', question: 'How does our CI/CD pipeline work?', sub: 'DevOps · Infrastructure' },
  { team: 'Data', color: '#3B82F6', hex: '#3B82F6', icon: '📊', question: 'What are our data retention policies?', sub: 'Analytics · Governance' },
  { team: 'CRM', color: '#8B5CF6', hex: '#8B5CF6', icon: '🗂️', question: 'How do we handle customer escalations?', sub: 'Sales · Support' },
  { team: 'Client Success', color: '#10B981', hex: '#10B981', icon: '🤝', question: 'What is the onboarding process for new clients?', sub: 'Onboarding · Retention' },
]


function SuggestionCard({ s, index, onClick }) {
  const cardRef = useRef(null)
  const [glow, setGlow] = useState({ x: 50, y: 50, opacity: 0 })

  const handleMouseMove = useCallback((e) => {
    const rect = cardRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setGlow({ x, y, opacity: 1 })
  }, [])

  const handleMouseLeave = useCallback(() => {
    setGlow(g => ({ ...g, opacity: 0 }))
  }, [])

  return (
    <button
      ref={cardRef}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="suggestion-card"
      style={{
        position: 'relative',
        background: 'var(--surface)',
        border: `1px solid var(--border)`,
        borderRadius: 16,
        padding: '20px 22px',
        textAlign: 'left',
        cursor: 'pointer',
        overflow: 'hidden',
        transition: 'border-color 0.2s, transform 0.2s, box-shadow 0.2s',
        animationDelay: `${index * 80}ms`,
        animationFillMode: 'both',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = s.hex + '66'
        e.currentTarget.style.transform = 'translateY(-3px)'
        e.currentTarget.style.boxShadow = `0 12px 40px ${s.hex}22`
      }}
      onMouseOut={e => {
        if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget)) {
          e.currentTarget.style.borderColor = 'var(--border)'
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = 'none'
        }
      }}
    >
      {/* Spotlight glow */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `radial-gradient(180px circle at ${glow.x}% ${glow.y}%, ${s.hex}18 0%, transparent 70%)`,
        opacity: glow.opacity,
        transition: 'opacity 0.3s',
        borderRadius: 'inherit',
      }} />

      {/* Top accent line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: 2,
        background: `linear-gradient(90deg, transparent, ${s.hex}99, transparent)`,
        borderRadius: '16px 16px 0 0',
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: s.hex + '1a',
            border: `1px solid ${s.hex}33`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, flexShrink: 0,
          }}>{s.icon}</div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: s.hex, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.team}</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1 }}>{s.sub}</div>
          </div>
        </div>
        <span className="card-arrow" style={{
          fontSize: 16, color: s.hex, opacity: 0.5,
          transition: 'opacity 0.2s, transform 0.2s',
        }}>→</span>
      </div>

      <div style={{ fontSize: 13.5, color: 'var(--text1)', lineHeight: 1.55, fontWeight: 500, position: 'relative' }}>
        {s.question}
      </div>
    </button>
  )
}

function EmptyState({ onSuggest }) {
  return (
    <div style={{ width: '100%', minHeight: '100%', background: 'var(--bg)', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 0 80px' }}>

      {/* Ambient background blobs */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
      </div>

      {/* Hero */}
      <div style={{ position: 'relative', width: '100%', textAlign: 'center', padding: '40px 24px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {/* Badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '5px 14px', borderRadius: 999,
          background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.25)',
          marginBottom: 20,
          animation: 'fadeSlideUp 0.5s ease both',
        }}>
          <img src="/ai.png" alt="" style={{ width: 13, height: 13, objectFit: 'contain' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-text)', letterSpacing: '0.04em' }}>AI-Powered Knowledge Layer</span>
        </div>

        {/* Logo + Headline — fully centered */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 16, animation: 'fadeSlideUp 0.5s 0.1s ease both' }}>
          <img src="/axis-logo.png" alt="AXIS" style={{ width: 52, height: 52, borderRadius: 14, objectFit: 'contain', flexShrink: 0 }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'clamp(26px, 3.5vw, 38px)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.04em', color: 'var(--text1)' }}>
              Ask <span className="gradient-text">anything</span> about your team.
            </div>
          </div>
        </div>

        <p style={{ fontSize: 'clamp(13px, 1.4vw, 15px)', color: 'var(--text2)', maxWidth: 480, lineHeight: 1.6, margin: '0 auto 20px', animation: 'fadeSlideUp 0.5s 0.2s ease both' }}>
          AXIS searches all your connected tools and gives you a clear answer with clickable sources.
        </p>

      </div>

      {/* Divider */}
      <div style={{ width: '100%', maxWidth: 800, height: 1, background: 'linear-gradient(90deg, transparent, var(--border), transparent)', margin: '0 auto 24px', position: 'relative' }} />

      {/* Cards grid */}
      <div style={{ position: 'relative', width: '100%', padding: '0 clamp(16px, 4vw, 48px)' }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text3)', textAlign: 'center', marginBottom: 16 }}>
          Try asking
        </div>
        <div className="suggestion-grid">
          {SUGGESTIONS.map((s, i) => (
            <SuggestionCard key={i} s={s} index={i} onClick={() => onSuggest(s.question)} />
          ))}
        </div>
      </div>

      <style>{`
        .blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.07;
          animation: drift 12s ease-in-out infinite alternate;
        }
        .blob-1 {
          width: 500px; height: 500px;
          background: #6366F1;
          top: -120px; left: -100px;
          animation-duration: 14s;
        }
        .blob-2 {
          width: 400px; height: 400px;
          background: #F59E0B;
          top: 0; right: -80px;
          animation-duration: 18s;
          animation-delay: -4s;
        }
        .blob-3 {
          width: 350px; height: 350px;
          background: #10B981;
          bottom: 40px; left: 30%;
          animation-duration: 20s;
          animation-delay: -8s;
        }
        @keyframes drift {
          from { transform: translate(0, 0) scale(1); }
          to { transform: translate(30px, 20px) scale(1.08); }
        }
        .gradient-text {
          background: linear-gradient(135deg, #6366F1, #818CF8, #A78BFA);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.75); }
        }
        .suggestion-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          width: 100%;
          max-width: 1100px;
          margin: 0 auto;
          animation: fadeSlideUp 0.5s 0.35s ease both;
        }
        @media (max-width: 1100px) {
          .suggestion-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 560px) {
          .suggestion-grid { grid-template-columns: 1fr; }
        }
        .suggestion-card:hover .card-arrow {
          opacity: 1 !important;
          transform: translateX(4px);
        }
      `}</style>
    </div>
  )
}

const TEAM_COLORS = {
  engineering: 'var(--c-eng)',
  data: 'var(--c-data)',
  crm: 'var(--c-crm)',
  client_success: 'var(--c-cs)',
  product: 'var(--c-prod)',
}

function getTeamColor(team) {
  if (!team) return 'var(--c-all)'
  return TEAM_COLORS[team.toLowerCase().replace(/\s+/g, '_')] || 'var(--c-all)'
}

function UserMessage({ content }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
      <div style={{
        maxWidth: '68%',
        background: 'var(--user-bg)',
        border: '1px solid var(--user-border)',
        borderRadius: '14px 14px 3px 14px',
        padding: '12px 16px',
        fontSize: 14,
        color: 'var(--text1)',
        lineHeight: 1.6,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {content}
      </div>
    </div>
  )
}

const SOURCE_LABELS = {
  jira: 'Jira',
  confluence: 'Confluence',
  contributed: 'Contributed',
}

function SourceChip({ src, onPreview }) {
  const color = getTeamColor(src.team)
  // relevance is already 0–100 after sigmoid normalisation in the backend
  const rel = src.relevance != null ? Math.round(src.relevance) : null
  const hasContent = Boolean(src.content)

  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '4px 10px 4px 8px',
    background: 'var(--tag-bg)', border: '1px solid var(--border)',
    borderRadius: 20, fontSize: 12, color: 'var(--text2)',
    maxWidth: 260, cursor: 'pointer',
    transition: 'border-color 0.15s, background 0.15s, color 0.15s',
    fontFamily: 'Inter, sans-serif',
  }

  return (
    <button
      style={base}
      title={hasContent ? `Preview: ${src.title}` : src.title}
      onClick={() => onPreview(src)}
      onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--text1)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--tag-bg)'; e.currentTarget.style.color = 'var(--text2)' }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {src.title || src.team}
      </span>
      {rel !== null && <span style={{ color: 'var(--text3)', flexShrink: 0 }}>{rel}%</span>}
      <span style={{ color: 'var(--text3)', flexShrink: 0, fontSize: 10 }}>
        {src.url ? '↗' : hasContent ? '⊞' : ''}
      </span>
    </button>
  )
}

function FeedbackButton({ active, activeColor, onClick, title, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 28, height: 26,
        borderRadius: 7,
        border: `1px solid ${active ? activeColor : 'var(--border)'}`,
        background: active ? `${activeColor}1a` : 'transparent',
        cursor: 'pointer',
        fontSize: 13,
        lineHeight: 1,
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.borderColor = active ? activeColor : 'var(--border2)' }}
      onMouseLeave={e => { e.currentTarget.style.opacity = active ? '1' : '0.65'; e.currentTarget.style.borderColor = active ? activeColor : 'var(--border)' }}
    >
      {children}
    </button>
  )
}

const mdComponents = {
  p: ({ children }) => <p style={{ margin: '0 0 10px', lineHeight: 1.7 }}>{children}</p>,
  strong: ({ children }) => <strong style={{ fontWeight: 600, color: 'var(--text1)' }}>{children}</strong>,
  em: ({ children }) => <em style={{ color: 'var(--text2)', fontStyle: 'italic' }}>{children}</em>,
  code: ({ inline, children }) => inline
    ? <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 5px', color: 'var(--accent-text)' }}>{children}</code>
    : <pre style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', overflowX: 'auto', margin: '10px 0' }}><code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--text1)' }}>{children}</code></pre>,
  ul: ({ children }) => <ul style={{ paddingLeft: 18, margin: '6px 0 10px' }}>{children}</ul>,
  ol: ({ children }) => <ol style={{ paddingLeft: 18, margin: '6px 0 10px' }}>{children}</ol>,
  li: ({ children }) => <li style={{ marginBottom: 4, lineHeight: 1.6 }}>{children}</li>,
  h2: ({ children }) => <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text1)', margin: '14px 0 6px', letterSpacing: '-0.02em' }}>{children}</h2>,
  h3: ({ children }) => <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text1)', margin: '10px 0 4px' }}>{children}</h3>,
  blockquote: ({ children }) => <blockquote style={{ borderLeft: '3px solid var(--accent)', paddingLeft: 12, margin: '8px 0', color: 'var(--text2)', fontStyle: 'italic' }}>{children}</blockquote>,
  a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-text)', textDecoration: 'underline', textUnderlineOffset: 2 }}>{children}</a>,
}

function AxisMessage({ msg, onFeedback, onPreview }) {
  const { content, sources, feedback } = msg
  const canVote = Boolean(msg.id && onFeedback)
  const isStreaming = msg.streaming

  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'flex-start' }}>
      <img src="/axis-logo.png" alt="AXIS" style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, marginTop: 2, objectFit: 'contain' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: 'var(--text1)', lineHeight: 1.7 }}>
          {isStreaming && !content ? (
            <StreamingStatus />
          ) : content ? (
            <>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                {content}
              </ReactMarkdown>
              {isStreaming && (
                <span style={{ display: 'inline-block', width: 8, height: 14, background: 'var(--accent)', borderRadius: 2, animation: 'blink 1s step-end infinite', verticalAlign: 'text-bottom', marginLeft: 2 }} />
              )}
            </>
          ) : null}
        </div>
        {sources && sources.length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {sources.map((src, i) => <SourceChip key={i} src={src} onPreview={onPreview} />)}
          </div>
        )}
        {canVote && !isStreaming && (
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>Was this helpful?</span>
            <button type="button" onClick={() => onFeedback(msg, feedback === 1 ? 0 : 1)} title="Helpful" style={{ background: feedback === 1 ? 'rgba(16,185,129,0.12)' : 'transparent', border: `1px solid ${feedback === 1 ? '#10B98166' : 'var(--border)'}`, borderRadius: 7, width: 28, height: 26, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>👍</button>
            <button type="button" onClick={() => onFeedback(msg, feedback === -1 ? 0 : -1)} title="Not helpful" style={{ background: feedback === -1 ? 'rgba(248,113,113,0.12)' : 'transparent', border: `1px solid ${feedback === -1 ? '#F8717166' : 'var(--border)'}`, borderRadius: 7, width: 28, height: 26, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>👎</button>
          </div>
        )}
      </div>
      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
    </div>
  )
}

function StreamingStatus() {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 2px' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 7, height: 7, borderRadius: '50%',
          background: 'var(--text3)',
          display: 'inline-block',
          animation: `axis-dot 1.4s ease-in-out ${i * 0.22}s infinite`,
        }} />
      ))}
      <style>{`
        @keyframes axis-dot {
          0%, 80%, 100% { opacity: 0.25; transform: scale(0.75); }
          40% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  )
}

function ThinkingIndicator() {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'flex-start' }}>
      <img src="/axis-logo.png" alt="AXIS" style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, marginTop: 2, objectFit: 'contain' }} />
      <StreamingStatus sourcesReady={false} />
    </div>
  )
}

export default function ChatArea({ messages, loading, onSuggest, onFeedback }) {
  const [previewSrc, setPreviewSrc] = useState(null)
  const handlePreview = useCallback((src) => {
    if (src.url && !src.content) { window.open(src.url, '_blank'); return }
    setPreviewSrc(src)
  }, [])

  if (messages.length === 0 && !loading) {
    return (
      <div style={{ minHeight: '100%', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
        <EmptyState onSuggest={onSuggest} />
        {previewSrc && <SourcePreview source={previewSrc} onClose={() => setPreviewSrc(null)} />}
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 40px', background: 'var(--bg)', minHeight: '100%' }}>
      {messages.map((msg, i) =>
        msg.role === 'user'
          ? <UserMessage key={i} content={msg.content} />
          : <AxisMessage key={msg.id || i} msg={msg} onFeedback={onFeedback} onPreview={handlePreview} />
      )}
      {loading && !messages.some(m => m.streaming) && <ThinkingIndicator />}
      {previewSrc && <SourcePreview source={previewSrc} onClose={() => setPreviewSrc(null)} />}
    </div>
  )
}
