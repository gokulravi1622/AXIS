import { useState, useEffect, useCallback } from 'react'

// Individual toast item
function ToastItem({ toast, onRemove }) {
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    // Animate in
    const t1 = setTimeout(() => setVisible(true), 10)
    // Auto-dismiss after 6s
    const t2 = setTimeout(() => dismiss(), 6000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  const dismiss = useCallback(() => {
    setLeaving(true)
    setTimeout(() => onRemove(toast.id), 350)
  }, [toast.id, onRemove])

  const icons = { auto_sync: '🔄', manual_sync: '✅', error: '❌' }
  const colors = {
    auto_sync: { bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.35)', dot: '#6366F1' },
    manual_sync: { bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.35)', dot: '#10B981' },
    error: { bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.35)', dot: '#F87171' },
  }
  const scheme = colors[toast.type] || colors.auto_sync

  return (
    <div
      onClick={dismiss}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '13px 16px',
        background: 'var(--surface)',
        border: `1px solid ${scheme.border}`,
        borderLeft: `3px solid ${scheme.dot}`,
        borderRadius: 12,
        boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
        cursor: 'pointer',
        maxWidth: 340,
        width: '100%',
        opacity: visible && !leaving ? 1 : 0,
        transform: visible && !leaving ? 'translateX(0)' : 'translateX(24px)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
        backdropFilter: 'blur(8px)',
        userSelect: 'none',
      }}
    >
      {/* Pulsing dot */}
      <div style={{ position: 'relative', marginTop: 2, flexShrink: 0 }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%', background: scheme.dot,
        }} />
        <div style={{
          position: 'absolute', top: -3, left: -3,
          width: 14, height: 14, borderRadius: '50%',
          background: scheme.dot, opacity: 0.25,
          animation: 'pulse-ring 1.5s ease-out infinite',
        }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text1)', marginBottom: 3 }}>
          {toast.type === 'auto_sync' ? 'Auto-Sync Complete' : 'Sync Complete'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>
          {toast.message}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
          {new Date(toast.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          &nbsp;· click to dismiss
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 2,
        borderRadius: '0 0 12px 12px', overflow: 'hidden',
        background: 'var(--border)',
      }}>
        <div style={{
          height: '100%', background: scheme.dot,
          animation: 'shrink-bar 6s linear forwards',
        }} />
      </div>

      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 0.25; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes shrink-bar {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  )
}

// Container — renders in top-right corner
export default function ToastContainer({ toasts, onRemove }) {
  if (!toasts.length) return null
  return (
    <div style={{
      position: 'fixed',
      top: 20,
      right: 20,
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{ pointerEvents: 'all' }}>
          <ToastItem toast={t} onRemove={onRemove} />
        </div>
      ))}
    </div>
  )
}
