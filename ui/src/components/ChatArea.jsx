const SUGGESTIONS = [
  { team: 'Engineering', color: 'var(--c-eng)', question: 'How does our CI/CD pipeline work?' },
  { team: 'Data', color: 'var(--c-data)', question: 'What are our data retention policies?' },
  { team: 'CRM', color: 'var(--c-crm)', question: 'How do we handle customer escalations?' },
  { team: 'Client Success', color: 'var(--c-cs)', question: 'What is the onboarding process?' },
]

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

function EmptyState({ onSuggest }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100%', padding: '40px 40px 80px', textAlign: 'center' }}>
      <img src="/axis-logo.png" alt="AXIS" style={{ width: 52, height: 52, borderRadius: 14, objectFit: 'contain', marginBottom: 20 }} />
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text1)', letterSpacing: '-0.03em', marginBottom: 8 }}>
        What do you need to know?
      </div>
      <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 32, maxWidth: 400, lineHeight: 1.6 }}>
        Ask anything about your team's knowledge base. I'll search across Jira, Confluence, and contributed context.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, width: '100%', maxWidth: 560 }}>
        {SUGGESTIONS.map((s, i) => (
          <button
            key={i}
            onClick={() => onSuggest(s.question)}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '14px 16px',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.background = 'var(--surface2)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: s.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.team}</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text1)', lineHeight: 1.45 }}>{s.question}</div>
          </button>
        ))}
      </div>
    </div>
  )
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

function SourceChip({ src }) {
  const color = getTeamColor(src.team)
  const rel = src.relevance ? Math.round(src.relevance * 100) : null
  const hasLink = Boolean(src.url)
  const sourceLabel = SOURCE_LABELS[src.source] || null

  const base = {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '3px 10px 3px 8px',
    background: 'var(--tag-bg)',
    border: '1px solid var(--border)',
    borderRadius: 20,
    fontSize: 12,
    color: 'var(--text2)',
    maxWidth: 260,
    textDecoration: 'none',
    cursor: hasLink ? 'pointer' : 'default',
    transition: 'border-color 0.15s, background 0.15s',
  }

  const inner = (
    <>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {src.title || src.team}
      </span>
      {rel !== null && <span style={{ color: 'var(--text3)', flexShrink: 0 }}>{rel}%</span>}
      {hasLink && (
        <span style={{ color: 'var(--text3)', flexShrink: 0, fontSize: 11 }} aria-hidden="true">↗</span>
      )}
    </>
  )

  if (!hasLink) {
    return <div style={base} title={src.title || src.team}>{inner}</div>
  }

  return (
    <a
      href={src.url}
      target="_blank"
      rel="noopener noreferrer"
      style={base}
      title={sourceLabel ? `Open in ${sourceLabel}` : src.url}
      onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.background = 'var(--surface2)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--tag-bg)' }}
    >
      {inner}
    </a>
  )
}

function FeedbackButton({ active, activeColor, onClick, title, children }) {
  return (
    <button
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
        filter: active ? 'none' : 'grayscale(1)',
        opacity: active ? 1 : 0.65,
      }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.opacity = 1; e.currentTarget.style.borderColor = 'var(--border2)' } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.opacity = 0.65; e.currentTarget.style.borderColor = 'var(--border)' } }}
    >
      {children}
    </button>
  )
}

function AxisMessage({ msg, onFeedback }) {
  const { content, sources, feedback } = msg
  const canVote = Boolean(msg.id && onFeedback)

  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'flex-start' }}>
      <div style={{
        width: 28, height: 28,
        borderRadius: 7,
        flexShrink: 0,
        marginTop: 2,
        objectFit: 'contain',
      }} src="/axis-logo.png" alt="AXIS" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: 'var(--text1)', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {content}
        </div>
        {sources && sources.length > 0 && (
          <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {sources.map((src, i) => <SourceChip key={i} src={src} />)}
          </div>
        )}
        {canVote && (
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text3)', marginRight: 2 }}>
              {feedback === 1 ? 'Thanks for the feedback!' : feedback === -1 ? 'Thanks — we’ll do better.' : 'Was this helpful?'}
            </span>
            <FeedbackButton
              active={feedback === 1}
              activeColor="#10B981"
              onClick={() => onFeedback(msg, 1)}
              title="Helpful"
            >👍</FeedbackButton>
            <FeedbackButton
              active={feedback === -1}
              activeColor="#F87171"
              onClick={() => onFeedback(msg, -1)}
              title="Not helpful"
            >👎</FeedbackButton>
          </div>
        )}
      </div>
    </div>
  )
}

function ThinkingIndicator() {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'flex-start' }}>
      <div style={{
        width: 28, height: 28,
        borderRadius: 7,
        flexShrink: 0,
        marginTop: 2,
        objectFit: 'contain',
      }} src="/axis-logo.png" alt="AXIS" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, paddingTop: 6 }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            width: 7, height: 7,
            borderRadius: '50%',
            background: 'var(--text3)',
            display: 'inline-block',
            animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

export default function ChatArea({ messages, loading, onSuggest, onFeedback }) {
  if (messages.length === 0 && !loading) {
    return (
      <div style={{ minHeight: '100%', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
        <EmptyState onSuggest={onSuggest} />
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 40px', background: 'var(--bg)', minHeight: '100%' }}>
      {messages.map((msg, i) =>
        msg.role === 'user'
          ? <UserMessage key={i} content={msg.content} />
          : <AxisMessage key={msg.id || i} msg={msg} onFeedback={onFeedback} />
      )}
      {loading && <ThinkingIndicator />}
    </div>
  )
}
