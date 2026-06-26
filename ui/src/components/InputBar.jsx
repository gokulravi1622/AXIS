import { useState, useRef, useImperativeHandle, forwardRef, useEffect } from 'react'

const InputBar = forwardRef(function InputBar({ onSend, disabled }, ref) {
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const inputRef = useRef(null)

  // Expose focus() to parent via ref
  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    clear: () => setValue(''),
  }))

  // Cmd+K / Ctrl+K focuses input; Esc clears it
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const submit = () => {
    if (!value.trim() || disabled) return
    onSend(value.trim())
    setValue('')
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
    if (e.key === 'Escape') { setValue(''); inputRef.current?.blur() }
  }

  return (
    <div style={{
      background: 'var(--bg)',
      borderTop: '1px solid var(--border)',
      padding: '14px 40px 16px',
      display: 'flex',
      gap: 10,
      alignItems: 'center',
      flexShrink: 0,
      position: 'relative',
    }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKey}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Ask anything… (Cmd+K to focus, Esc to clear)"
          disabled={disabled}
          style={{
            width: '100%',
            height: 48,
            background: 'var(--input-bg)',
            border: focused ? '1.5px solid var(--accent)' : '1.5px solid var(--border)',
            borderRadius: 12,
            fontSize: 14,
            fontFamily: 'Inter, sans-serif',
            padding: '0 48px 0 18px',
            color: 'var(--text1)',
            outline: 'none',
            boxShadow: focused ? '0 0 0 3px var(--accent-dim)' : 'none',
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}
        />
        {/* Kbd hint inside input */}
        {!focused && !value && (
          <div style={{
            position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
            pointerEvents: 'none',
          }}>
            <kbd style={{
              fontSize: 10, padding: '2px 6px', borderRadius: 5,
              background: 'var(--surface2)', border: '1px solid var(--border)',
              color: 'var(--text3)', fontFamily: 'Inter, sans-serif', letterSpacing: '0.02em',
            }}>⌘K</kbd>
          </div>
        )}
      </div>

      <button
        onClick={submit}
        disabled={disabled || !value.trim()}
        style={{
          width: 48, height: 48,
          background: value.trim() && !disabled ? 'var(--accent)' : 'var(--surface2)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          color: value.trim() && !disabled ? '#fff' : 'var(--text3)',
          fontSize: 18,
          cursor: disabled || !value.trim() ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => { if (!disabled && value.trim()) { e.currentTarget.style.background = 'var(--accent-h)'; e.currentTarget.style.transform = 'translateY(-1px)' } }}
        onMouseLeave={e => { e.currentTarget.style.background = value.trim() && !disabled ? 'var(--accent)' : 'var(--surface2)'; e.currentTarget.style.transform = 'translateY(0)' }}
      >↑</button>
    </div>
  )
})

export default InputBar
