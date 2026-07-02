import { useState } from 'react'
import NotificationsPanel from './NotificationsPanel'

function LogoutModal({ onConfirm, onCancel }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 20,
        padding: '32px 28px',
        width: 340,
        boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        animation: 'modal-in 0.2s ease',
      }}>
        <style>{`@keyframes modal-in { from { opacity:0; transform:scale(0.95) translateY(8px) } to { opacity:1; transform:scale(1) translateY(0) } }`}</style>

        <div style={{ width: 52, height: 52, borderRadius: 14, margin: '0 auto 20px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src="/logout.png" alt="Log out" style={{ width: 24, height: 24, objectFit: 'contain', filter: 'invert(40%) sepia(80%) saturate(400%) hue-rotate(320deg)' }} />
        </div>

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text1)', letterSpacing: '-0.02em', marginBottom: 8 }}>Log out?</div>
          <div style={{ fontSize: 13.5, color: 'var(--text3)', lineHeight: 1.6 }}>Your session will end and you'll need to sign in again.</div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, height: 42, borderRadius: 11,
            border: '1px solid var(--border)', background: 'var(--surface2)',
            color: 'var(--text2)', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'Inter, sans-serif', transition: 'border-color 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border2)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >Cancel</button>
          <button onClick={onConfirm} style={{
            flex: 1, height: 42, borderRadius: 11, border: 'none',
            background: '#EF4444', color: '#fff', fontSize: 14, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            boxShadow: '0 4px 14px rgba(239,68,68,0.35)',
          }}>Log out</button>
        </div>
      </div>
    </div>
  )
}

const TEAM_META = {
  null: { label: 'All Teams', color: 'var(--c-all)' },
  engineering: { label: 'Engineering', color: 'var(--c-eng)' },
  data: { label: 'Data', color: 'var(--c-data)' },
  crm: { label: 'CRM', color: 'var(--c-crm)' },
  client_success: { label: 'Client Success', color: 'var(--c-cs)' },
  product: { label: 'Product', color: 'var(--c-prod)' },
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9 1.5C9 1.5 5.25 3 5.25 8.25V12L3.75 13.5H14.25L12.75 12V8.25C12.75 3 9 1.5 9 1.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.5 13.5C7.5 14.3284 8.17157 15 9 15C9.82843 15 10.5 14.3284 10.5 13.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

export default function Header({ teamFilter, user, onLogout, theme, setTheme, notifications, requests, token, onNotifAction }) {
  const key = teamFilter === null ? 'null' : teamFilter
  const meta = TEAM_META[key] || TEAM_META['null']
  const initial = user?.name?.trim()?.[0]?.toUpperCase() || '?'
  const [showModal, setShowModal] = useState(false)
  const [showNotifPanel, setShowNotifPanel] = useState(false)

  const unreadCount = (notifications || []).filter(n => !n.read).length
  const pendingRequests = (requests?.received || []).filter(r => r.status === 'pending').length
  const badgeCount = unreadCount + pendingRequests

  const handleNotifAction = () => {
    onNotifAction?.()
  }

  return (
    <div style={{
      height: 56,
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      padding: '0 40px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      position: 'sticky',
      top: 0,
      zIndex: 100,
      flexShrink: 0,
    }}>
      <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text1)', letterSpacing: '-0.02em' }}>Ask AXIS</span>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 10px 3px 8px',
        borderRadius: 20,
        background: 'var(--accent-dim)',
        border: `1px solid ${meta.color}44`,
        marginLeft: 2,
      }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 500, color: meta.color }}>{meta.label}</span>
      </div>

      {user && (
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%',
              background: 'var(--accent)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, flexShrink: 0,
            }}>{initial}</div>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text1)' }}>{user.name}</span>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>{user.email}</span>
            </div>
          </div>
          <button
            onClick={() => setTheme?.(t => t === 'dark' ? 'light' : 'dark')}
            aria-label="Toggle theme"
            style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <img src={theme === 'dark' ? '/day-mode.png' : '/dark.png'} alt="Toggle theme" style={{ width: 18, height: 18, objectFit: 'contain' }} />
          </button>

          {/* Notification Bell */}
          <button
            onClick={() => setShowNotifPanel(true)}
            title="Notifications"
            aria-label="Open notifications"
            style={{
              width: 34, height: 34, borderRadius: 9,
              border: `1px solid ${showNotifPanel ? 'var(--accent)' : 'var(--border)'}`,
              background: showNotifPanel ? 'var(--accent-dim)' : 'transparent',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text2)',
              transition: 'border-color 0.15s, background 0.15s',
              position: 'relative',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--text1)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = showNotifPanel ? 'var(--accent)' : 'var(--border)'; e.currentTarget.style.color = 'var(--text2)' }}
          >
            <BellIcon />
            {badgeCount > 0 && (
              <span style={{
                position: 'absolute', top: 4, right: 4,
                width: 8, height: 8, borderRadius: '50%',
                background: '#EF4444',
                border: '1.5px solid var(--surface)',
                display: 'block',
              }} />
            )}
          </button>

          <button
            onClick={() => setShowModal(true)}
            title="Log out"
            style={{
              width: 34, height: 34, borderRadius: 9,
              border: '1px solid var(--border)', background: 'var(--surface2)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'border-color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#F87171'; e.currentTarget.style.background = 'rgba(248,113,113,0.08)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface2)' }}
          >
            <img src="/logout.png" alt="Log out" style={{ width: 16, height: 16, objectFit: 'contain', opacity: 0.6 }} />
          </button>
        </div>
      )}

      {showModal && (
        <LogoutModal
          onConfirm={() => { setShowModal(false); onLogout() }}
          onCancel={() => setShowModal(false)}
        />
      )}

      <NotificationsPanel
        open={showNotifPanel}
        onClose={() => setShowNotifPanel(false)}
        notifications={notifications || []}
        requests={requests || { sent: [], received: [] }}
        token={token}
        onAction={handleNotifAction}
      />
    </div>
  )
}
