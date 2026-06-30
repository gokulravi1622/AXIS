
import { useState, useEffect, useRef, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import ChatArea from './components/ChatArea'
import InputBar from './components/InputBar'
import ToastContainer from './components/Toast'
import Login from './components/Login'
import Onboarding from './components/Onboarding'

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('axis_theme') || 'dark')
  const [token, setToken] = useState(() => localStorage.getItem('axis_token'))
  const [user, setUser] = useState(null)
  const [org, setOrg] = useState(null)
  const [showConnect, setShowConnect] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [teamFilter, setTeamFilter] = useState(null)
  const [messages, setMessages] = useState([])
  const [conversations, setConversations] = useState([])
  const [currentConvId, setCurrentConvId] = useState(null)
  const [syncLog, setSyncLog] = useState([])
  const [loading, setLoading] = useState(false)
  const [toasts, setToasts] = useState([])
  const chatEndRef = useRef(null)
  const lastSeenTs = useRef(null)
  const inputBarRef = useRef(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('axis_theme', theme)
  }, [theme])

  // Persist guest messages to localStorage (logged-in users have server-side persistence)
  useEffect(() => {
    if (!token) localStorage.setItem('axis_guest_messages', JSON.stringify(messages))
  }, [messages, token])

  // Restore guest messages on mount
  useEffect(() => {
    if (!token) {
      try {
        const saved = localStorage.getItem('axis_guest_messages')
        if (saved) setMessages(JSON.parse(saved))
      } catch {}
    }
  }, []) // eslint-disable-line

  // Validate any stored token on mount / when it changes
  useEffect(() => {
    if (!token) { setAuthChecked(true); return }
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => { setUser(d.user); setOrg(d.org) })
      .catch(() => { localStorage.removeItem('axis_token'); setToken(null); setUser(null); setOrg(null) })
      .finally(() => setAuthChecked(true))
  }, [token])

  const handleAuth = useCallback((tok, usr, orgInfo) => {
    localStorage.setItem('axis_token', tok)
    setToken(tok)
    setUser(usr)
    setOrg(orgInfo)
  }, [])

  const handleLogout = useCallback(() => {
    localStorage.removeItem('axis_token')
    setToken(null)
    setUser(null)
    setOrg(null)
    setMessages([])
    setConversations([])
    setCurrentConvId(null)
  }, [])

  // ── Conversations (multi-chat) ──────────────────────────────────────────────
  const loadConversations = useCallback(() => {
    if (!token) return
    fetch('/api/conversations', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => setConversations(d.conversations || []))
      .catch(() => {})
  }, [token])

  useEffect(() => { if (user) loadConversations() }, [user, loadConversations])

  const handleNewChat = useCallback(() => {
    setMessages([])
    setCurrentConvId(null)
  }, [])

  const handleSelectConversation = useCallback(async (id) => {
    if (id === currentConvId) return
    try {
      const res = await fetch(`/api/conversations/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      let lastUser = ''
      const uiMsgs = (data.messages || []).map(m => {
        if (m.role === 'user') { lastUser = m.content; return { role: 'user', content: m.content } }
        return { role: 'axis', id: crypto.randomUUID(), question: lastUser, content: m.content, sources: m.sources || [], feedback: null }
      })
      setMessages(uiMsgs)
      setCurrentConvId(id)
    } catch {}
  }, [token, currentConvId])

  const handleDeleteConversation = useCallback(async (id) => {
    try {
      await fetch(`/api/conversations/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    } catch {}
    if (id === currentConvId) { setMessages([]); setCurrentConvId(null) }
    setConversations(prev => prev.filter(c => c.id !== id))
  }, [token, currentConvId])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const addToast = useCallback((toast) => {
    setToasts(prev => [...prev, { ...toast, id: Date.now() + Math.random() }])
  }, [])

  // Poll for sync events every 30s
  useEffect(() => {
    const poll = async () => {
      try {
        const url = lastSeenTs.current
          ? `/api/sync-events?since=${encodeURIComponent(lastSeenTs.current)}`
          : '/api/sync-events'
        const res = await fetch(url)
        const data = await res.json()
        if (data.events && data.events.length > 0) {
          lastSeenTs.current = data.events[data.events.length - 1].timestamp
          setToasts(prev => [
            ...prev,
            ...data.events.map(e => ({ ...e, id: e.timestamp + Math.random() })),
          ])
        }
      } catch {}
    }
    poll() // check on mount for any missed events
    const interval = setInterval(poll, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (question) => {
    if (!question.trim() || loading) return

    const apiHistory = messages
      .map(m => ({ role: m.role === 'axis' ? 'assistant' : 'user', content: m.content }))
      .slice(-10)

    setMessages(prev => [...prev, { role: 'user', content: question }])
    setLoading(true)

    const streamId = crypto.randomUUID()
    setMessages(prev => [...prev, { role: 'axis', id: streamId, question, content: '', sources: [], feedback: null, streaming: true }])

    const reqBody = JSON.stringify({
      question,
      team_filter: teamFilter || undefined,
      history: apiHistory,
      conversation_id: currentConvId || undefined,
    })
    const authHeaders = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }

    try {
      const res = await fetch('/api/ask/stream', {
        method: 'POST',
        headers: authHeaders,
        body: reqBody,
      })

      // Fall back to non-streaming endpoint if stream is unavailable
      if (!res.ok) {
        const json = await fetch('/api/ask', { method: 'POST', headers: authHeaders, body: reqBody })
          .then(r => r.json())
        setMessages(prev => prev.map(m => m.id === streamId
          ? { ...m, content: json.answer || 'No answer returned.', sources: json.sources || [], streaming: false }
          : m))
        if (json.conversation_id && json.conversation_id !== currentConvId) {
          setCurrentConvId(json.conversation_id)
          loadConversations()
        }
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop()
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const evt = JSON.parse(line.slice(6))
            if (evt.type === 'sources') {
              setMessages(prev => prev.map(m => m.id === streamId ? { ...m, sources: evt.sources } : m))
            } else if (evt.type === 'token') {
              setMessages(prev => prev.map(m => m.id === streamId ? { ...m, content: m.content + evt.text } : m))
            } else if (evt.type === 'done') {
              setMessages(prev => prev.map(m => m.id === streamId ? { ...m, streaming: false } : m))
            } else if (evt.type === 'conversation_id') {
              if (evt.id !== currentConvId) setCurrentConvId(evt.id)
              loadConversations()
            } else if (evt.type === 'error') {
              setMessages(prev => prev.map(m => m.id === streamId ? { ...m, content: 'Sorry, something went wrong. Please try again.', streaming: false } : m))
            }
          } catch {}
        }
      }
    } catch {
      setMessages(prev => prev.map(m => m.id === streamId ? { ...m, content: 'Sorry, something went wrong. Please try again.', streaming: false } : m))
    } finally {
      setLoading(false)
    }
  }

  // 👍 / 👎 on an answer. Toggling the same vote clears it (vote 0).
  const handleFeedback = useCallback(async (msg, vote) => {
    const newVote = msg.feedback === vote ? 0 : vote
    setMessages(prev => prev.map(m => (m.id === msg.id ? { ...m, feedback: newVote || null } : m)))
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message_key: msg.id,
          question: msg.question || '',
          answer: msg.content || '',
          sources: msg.sources || [],
          vote: newVote,
        }),
      })
    } catch {
      // revert on failure
      setMessages(prev => prev.map(m => (m.id === msg.id ? { ...m, feedback: msg.feedback } : m)))
    }
  }, [token])

  const handleClearChat = handleNewChat

  // Wait until we've checked the stored token before deciding what to render
  if (!authChecked) {
    return <div style={{ height: '100vh', width: '100vw', background: 'var(--bg)' }} />
  }

  // Not logged in → show the login / sign-up screen
  if (!user) {
    return <Login onAuth={handleAuth} theme={theme} setTheme={setTheme} />
  }

  // Logged in but the org hasn't finished onboarding → connection wizard
  if (org && org.onboarded === false) {
    return (
      <Onboarding
        token={token}
        orgName={org.name}
        onComplete={() => setOrg(prev => ({ ...prev, onboarded: true }))}
      />
    )
  }

  // Re-opened from the dashboard to add/connect more tools
  if (showConnect) {
    return (
      <Onboarding
        token={token}
        orgName={org?.name}
        onComplete={() => setShowConnect(false)}
      />
    )
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <Sidebar
        teamFilter={teamFilter}
        setTeamFilter={setTeamFilter}
        theme={theme}
        setTheme={setTheme}
        onSyncDone={(log) => setSyncLog(log)}
        onClearChat={handleClearChat}
        addToast={addToast}
        token={token}
        onManageConnections={() => setShowConnect(true)}
        conversations={conversations}
        currentConvId={currentConvId}
        onNewChat={handleNewChat}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <Header teamFilter={teamFilter} user={user} onLogout={handleLogout} theme={theme} setTheme={setTheme} />
        <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
          <ChatArea messages={messages} loading={loading} onSuggest={handleSend} onFeedback={handleFeedback} />
          <div ref={chatEndRef} />
        </div>
        <InputBar ref={inputBarRef} onSend={handleSend} disabled={loading} />
      </div>
    </div>
  )
}
