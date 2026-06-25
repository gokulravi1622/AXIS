const TEAM_META = {
  null: { label: 'All Teams', color: 'var(--c-all)' },
  engineering: { label: 'Engineering', color: 'var(--c-eng)' },
  data: { label: 'Data', color: 'var(--c-data)' },
  crm: { label: 'CRM', color: 'var(--c-crm)' },
  client_success: { label: 'Client Success', color: 'var(--c-cs)' },
  product: { label: 'Product', color: 'var(--c-prod)' },
}

export default function Header({ teamFilter, user, onLogout }) {
  const key = teamFilter === null ? 'null' : teamFilter
  const meta = TEAM_META[key] || TEAM_META['null']
  const initial = user?.name?.trim()?.[0]?.toUpperCase() || '?'

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
            onClick={onLogout}
            title="Log out"
            style={{
              height: 30, padding: '0 12px',
              borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--surface2)', color: 'var(--text2)',
              fontSize: 12, fontWeight: 500, cursor: 'pointer',
              fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text1)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text2)' }}
          >
            Log out
          </button>
        </div>
      )}
    </div>
  )
}
