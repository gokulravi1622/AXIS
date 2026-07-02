import { useState } from 'react'

export default function RequestContextModal({ topic, token, onClose }) {
  const [approverEmail, setApproverEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!approverEmail.trim() || !approverEmail.includes('@')) {
      setError('Enter a valid email address.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/context-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ approver_email: approverEmail.trim().toLowerCase(), topic }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || 'Failed to send request.')
      }
      setSent(true)
      setTimeout(onClose, 1800)
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 18,
          padding: '28px 28px 24px',
          width: 420, maxWidth: 'calc(100vw - 32px)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
          animation: 'modal-in 0.18s ease',
        }}
      >
        <style>{`@keyframes modal-in { from { opacity:0; transform:scale(0.95) translateY(8px) } to { opacity:1; transform:scale(1) translateY(0) } }`}</style>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text1)', letterSpacing: '-0.02em', marginBottom: 6 }}>
            Request context
          </div>
          <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.5 }}>
            Ask a colleague to share their context with you so AXIS can include it in future answers.
          </div>
        </div>

        {sent ? (
          <div style={{
            padding: '16px', background: 'rgba(16,185,129,0.08)',
            border: '1px solid rgba(16,185,129,0.25)',
            borderRadius: 10, textAlign: 'center',
            fontSize: 13, color: '#10B981', fontWeight: 600,
          }}>
            Request sent! They will be notified.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                Topic
              </label>
              <div style={{
                padding: '10px 12px',
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: 9,
                fontSize: 13, color: 'var(--text2)',
                lineHeight: 1.4,
              }}>
                {topic}
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                Colleague email
              </label>
              <input
                type="email"
                value={approverEmail}
                onChange={e => setApproverEmail(e.target.value)}
                placeholder="colleague@company.com"
                autoFocus
                style={{
                  width: '100%', height: 40,
                  padding: '0 12px', boxSizing: 'border-box',
                  background: 'var(--surface2)',
                  border: `1px solid ${error ? '#F87171' : 'var(--border)'}`,
                  borderRadius: 9, fontSize: 13,
                  color: 'var(--text1)', outline: 'none',
                  fontFamily: 'Inter, sans-serif',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; setError('') }}
                onBlur={e => { e.currentTarget.style.borderColor = error ? '#F87171' : 'var(--border)' }}
              />
              {error && <div style={{ marginTop: 5, fontSize: 12, color: '#F87171' }}>{error}</div>}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1, height: 40, borderRadius: 10,
                  border: '1px solid var(--border)', background: 'var(--surface2)',
                  color: 'var(--text2)', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border2)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{
                  flex: 1, height: 40, borderRadius: 10,
                  border: 'none',
                  background: loading ? 'var(--accent-dim)' : 'var(--accent)',
                  color: '#fff', fontSize: 13, fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontFamily: 'Inter, sans-serif',
                  opacity: loading ? 0.7 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                {loading ? 'Sending...' : 'Send Request'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
