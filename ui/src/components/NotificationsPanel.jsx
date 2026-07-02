import { useState } from 'react'

const STATUS_COLORS = {
  pending: '#F59E0B',
  approved: '#10B981',
  rejected: '#F87171',
  revoked: '#9CA3AF',
  expired: '#6B7280',
  cancelled: '#9CA3AF',
}

const STATUS_LABELS = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  revoked: 'Revoked',
  expired: 'Expired',
  request_cancelled: 'Cancelled',
}

const NOTIF_TYPE_LABELS = {
  context_request: 'New context request',
  request_approved: 'Request approved',
  request_rejected: 'Request declined',
  access_revoked: 'Access revoked',
  request_cancelled: 'Request cancelled',
  context_shared: 'Teammate shared context with you',
}

function StatusBadge({ status }) {
  const color = STATUS_COLORS[status] || '#9CA3AF'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 999,
      background: color + '18', border: `1px solid ${color}44`,
      fontSize: 11, fontWeight: 600, color, letterSpacing: '0.03em',
      fontFamily: 'Inter, sans-serif',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {STATUS_LABELS[status] || status}
    </span>
  )
}

function ApproveDropdown({ onApprove, loading }) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        disabled={loading}
        style={{
          height: 30, padding: '0 12px',
          background: '#6366F1', color: '#fff',
          border: 'none', borderRadius: 7,
          fontSize: 12, fontWeight: 600,
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.6 : 1,
          fontFamily: 'Inter, sans-serif',
          display: 'flex', alignItems: 'center', gap: 5,
        }}
      >
        Approve
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 9, overflow: 'hidden', zIndex: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)', minWidth: 130,
        }}>
          {[
            { value: '24h', label: '24 hours' },
            { value: 'session', label: '8-hour session' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => { setOpen(false); onApprove(opt.value) }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '9px 14px', background: 'transparent',
                border: 'none', cursor: 'pointer',
                fontSize: 12, color: 'var(--text1)',
                fontFamily: 'Inter, sans-serif',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ReceivedRequestCard({ req, token, onAction }) {
  const [loading, setLoading] = useState(false)

  const doAction = async (endpoint, body) => {
    setLoading(true)
    try {
      const opts = {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
      if (body) opts.body = JSON.stringify(body)
      await fetch(`/api/context-requests/${req.id}/${endpoint}`, opts)
      onAction()
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      padding: '14px 16px',
      background: 'var(--surface2)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      marginBottom: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text1)', marginBottom: 2 }}>
            {req.requester_name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>{req.requester_email}</div>
        </div>
        <StatusBadge status={req.status} />
      </div>
      <div style={{
        background: 'var(--bg)', border: '1px solid var(--border)',
        borderRadius: 6, padding: '8px 10px', marginBottom: 10,
      }}>
        <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Topic</div>
        <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>{req.topic}</div>
      </div>
      {req.status === 'pending' && (
        <div style={{ display: 'flex', gap: 8 }}>
          <ApproveDropdown onApprove={dur => doAction('approve', { duration_type: dur })} loading={loading} />
          <button
            onClick={() => doAction('reject')}
            disabled={loading}
            style={{
              height: 30, padding: '0 12px',
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text2)', borderRadius: 7,
              fontSize: 12, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              fontFamily: 'Inter, sans-serif',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#F87171'; e.currentTarget.style.color = '#F87171' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text2)' }}
          >
            Reject
          </button>
        </div>
      )}
      {req.status === 'approved' && (
        <button
          onClick={() => doAction('revoke')}
          disabled={loading}
          style={{
            height: 28, padding: '0 10px',
            background: 'transparent',
            border: '1px solid var(--border)',
            color: 'var(--text3)', borderRadius: 6,
            fontSize: 11, fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
            fontFamily: 'Inter, sans-serif',
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = '#F87171'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
        >
          Revoke access
        </button>
      )}
    </div>
  )
}

function SentRequestCard({ req, token, onAction }) {
  const [loading, setLoading] = useState(false)

  const doRevoke = async () => {
    setLoading(true)
    try {
      await fetch(`/api/context-requests/${req.id}/revoke`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
      onAction()
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      padding: '12px 14px',
      background: 'var(--surface2)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500 }}>
          To: <span style={{ color: 'var(--text1)' }}>{req.approver_email}</span>
        </div>
        <StatusBadge status={req.status} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.4, marginBottom: 6 }}>
        {req.topic.length > 80 ? req.topic.slice(0, 80) + '…' : req.topic}
      </div>
      {(req.status === 'pending' || req.status === 'approved') && (
        <button
          onClick={doRevoke}
          disabled={loading}
          style={{
            height: 24, padding: '0 8px',
            background: 'transparent',
            border: '1px solid var(--border)',
            color: 'var(--text3)', borderRadius: 5,
            fontSize: 10, fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: 'Inter, sans-serif',
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = '#F87171'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
        >
          Cancel
        </button>
      )}
    </div>
  )
}

function NotifItem({ notif }) {
  const label = NOTIF_TYPE_LABELS[notif.type] || notif.type
  const payload = notif.payload || {}
  const isUnread = !notif.read
  const isShared = notif.type === 'context_shared'

  return (
    <div style={{
      padding: isShared ? '12px 14px' : '10px 14px',
      borderRadius: isShared ? 10 : 8,
      marginBottom: 8,
      background: isUnread ? (isShared ? 'rgba(16,185,129,0.06)' : 'rgba(99,102,241,0.06)') : 'var(--surface2)',
      border: `1px solid ${isUnread ? (isShared ? 'rgba(16,185,129,0.25)' : 'rgba(99,102,241,0.18)') : 'var(--border)'}`,
      transition: 'background 0.15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: isShared ? 8 : 3 }}>
        {isUnread && <span style={{ width: 5, height: 5, borderRadius: '50%', background: isShared ? '#10B981' : '#6366F1', flexShrink: 0 }} />}
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text1)' }}>{label}</span>
      </div>

      {isShared ? (
        <>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>
            From: <strong style={{ color: 'var(--text2)' }}>{payload.sharer_name || payload.sharer_email}</strong>
          </div>
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 10px', marginBottom: 4 }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Shared context</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text1)', marginBottom: 4 }}>{payload.title}</div>
            {payload.content_preview && (
              <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {payload.content_preview.length > 180 ? payload.content_preview.slice(0, 180) + '…' : payload.content_preview}
              </div>
            )}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>
            You can now search for this content in AXIS
          </div>
        </>
      ) : (
        <>
          {payload.topic && (
            <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.4 }}>
              {payload.topic.length > 60 ? payload.topic.slice(0, 60) + '…' : payload.topic}
            </div>
          )}
          {payload.requester_name && (
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>From: {payload.requester_name}</div>
          )}
          {payload.approver_name && (
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>From: {payload.approver_name}</div>
          )}
        </>
      )}
    </div>
  )
}

export default function NotificationsPanel({ open, onClose, notifications, requests, token, onAction }) {
  const [tab, setTab] = useState('requests')

  const receivedReqs = requests?.received || []
  const sentReqs = requests?.sent || []

  const unreadCount = (notifications || []).filter(n => !n.read).length

  const tabStyle = (active) => ({
    flex: 1, height: 34, border: 'none',
    background: active ? 'var(--surface2)' : 'transparent',
    borderRadius: 8, cursor: 'pointer',
    fontSize: 12, fontWeight: 600,
    color: active ? 'var(--text1)' : 'var(--text3)',
    fontFamily: 'Inter, sans-serif',
    transition: 'background 0.15s, color 0.15s',
  })

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.25)',
          }}
        />
      )}

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 380, zIndex: 201,
        background: 'var(--surface)',
        borderLeft: '1px solid var(--border)',
        boxShadow: '-12px 0 40px rgba(0,0,0,0.3)',
        display: 'flex', flexDirection: 'column',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text1)', letterSpacing: '-0.02em' }}>
              Notifications
            </span>
            {unreadCount > 0 && (
              <span style={{
                padding: '1px 7px', borderRadius: 999,
                background: '#6366F1', color: '#fff',
                fontSize: 11, fontWeight: 700,
              }}>
                {unreadCount}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: 7,
              border: '1px solid var(--border)',
              background: 'transparent', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text3)',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--text3)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', gap: 4,
          background: 'var(--bg)',
          flexShrink: 0,
        }}>
          <button style={tabStyle(tab === 'requests')} onClick={() => setTab('requests')}>
            Requests
            {receivedReqs.filter(r => r.status === 'pending').length > 0 && (
              <span style={{ marginLeft: 5, padding: '0 5px', borderRadius: 999, background: '#F59E0B', color: '#000', fontSize: 10, fontWeight: 700 }}>
                {receivedReqs.filter(r => r.status === 'pending').length}
              </span>
            )}
          </button>
          <button style={tabStyle(tab === 'sent')} onClick={() => setTab('sent')}>Sent</button>
          <button style={tabStyle(tab === 'activity')} onClick={() => setTab('activity')}>
            Activity
            {unreadCount > 0 && (
              <span style={{ marginLeft: 5, padding: '0 5px', borderRadius: 999, background: '#6366F1', color: '#fff', fontSize: 10, fontWeight: 700 }}>
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
          {tab === 'requests' && (
            <>
              {receivedReqs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)', fontSize: 13 }}>
                  No incoming requests
                </div>
              ) : (
                receivedReqs.map(req => (
                  <ReceivedRequestCard
                    key={req.id}
                    req={req}
                    token={token}
                    onAction={onAction}
                  />
                ))
              )}
            </>
          )}

          {tab === 'sent' && (
            <>
              {sentReqs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)', fontSize: 13 }}>
                  No outgoing requests
                </div>
              ) : (
                sentReqs.map(req => (
                  <SentRequestCard
                    key={req.id}
                    req={req}
                    token={token}
                    onAction={onAction}
                  />
                ))
              )}
            </>
          )}

          {tab === 'activity' && (
            <>
              {(notifications || []).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)', fontSize: 13 }}>
                  No recent activity
                </div>
              ) : (
                (notifications || []).map(n => (
                  <NotifItem key={n.id} notif={n} />
                ))
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
