import { useState } from 'react'

export default function InputBar({ onSend, disabled }) {
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)

  const submit = () => {
    if (!value.trim() || disabled) return
    onSend(value.trim())
    setValue('')
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div style={{
      background: 'var(--bg)',
      borderTop: '1px solid var(--border)',
      padding: '16px 40px',
      display: 'flex',
      gap: 12,
      alignItems: 'center',
      flexShrink: 0,
    }}>
      <input
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKey}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Ask anything about your team's knowledge…"
        disabled={disabled}
        style={{
          flex: 1,
          height: 48,
          background: 'var(--input-bg)',
          border: focused ? '1.5px solid var(--accent)' : '1.5px solid var(--border)',
          borderRadius: 12,
          fontSize: 14,
          fontFamily: 'Inter, sans-serif',
          padding: '0 18px',
          color: 'var(--text1)',
          outline: 'none',
          boxShadow: focused ? '0 0 0 3px var(--accent-dim)' : 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
      />
      <button
        onClick={submit}
        disabled={disabled || !value.trim()}
        style={{
          width: 48,
          height: 48,
          background: 'var(--accent)',
          border: 'none',
          borderRadius: 12,
          color: '#fff',
          fontSize: 20,
          cursor: disabled || !value.trim() ? 'not-allowed' : 'pointer',
          opacity: disabled || !value.trim() ? 0.5 : 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => { if (!disabled && value.trim()) { e.currentTarget.style.background = 'var(--accent-h)'; e.currentTarget.style.transform = 'translateY(-1px)' } }}
        onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(0)' }}
      >
        ↑
      </button>
    </div>
  )
}
