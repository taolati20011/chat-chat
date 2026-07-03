import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getRooms, getMessages, createRoom as apiCreateRoom } from '../lib/api'
import { getSocket, disconnectSocket } from '../lib/socket'

const fmtTime = (ts) => {
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })
}
const fmtDay = (ts) => {
  const d = new Date(ts)
  const today = new Date()
  const yest = new Date(); yest.setDate(today.getDate()-1)
  const sameDay = (a,b)=> a.toDateString()===b.toDateString()
  if (sameDay(d, today)) return "Today"
  if (sameDay(d, yest)) return "Yesterday"
  return d.toLocaleDateString([], { month:"short", day:"numeric" })
}
const initials = (n) => n.split(/[\s_\-.]+/).filter(Boolean).slice(0,2).map(x=>x[0].toUpperCase()).join("")
const hue = (s) => {
  let h = 0
  for (let i=0;i<s.length;i++) h = (h*31 + s.charCodeAt(i)) & 0xffff
  return h % 360
}
const avatarBg = (n) => `oklch(0.78 0.08 ${hue(n)})`
const avatarInk = (n) => `oklch(0.28 0.06 ${hue(n)})`

const ROOM_PRESETS = ["💬","🎬","🛠","🥡","🐈","📚","🎧","⚽","🎮","✈️","🍵","🌱","🪩","🧪","💡","📷","🎨","🧶"]

function Chat({ user, logout }) {
  const navigate = useNavigate()
  const [rooms, setRooms] = useState([])
  const [activeRoomId, setActiveRoomId] = useState(null)
  const [messages, setMessages] = useState([])
  const [presenceByRoom, setPresenceByRoom] = useState({})
  const [query, setQuery] = useState("")
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState("")
  const [newEmoji, setNewEmoji] = useState("💬")
  const [draft, setDraft] = useState("")
  const [showEmoji, setShowEmoji] = useState(false)
  const [aiMode, setAiMode] = useState(false)
  const [aiMessages, setAiMessages] = useState([])
  const [aiDraft, setAiDraft] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [unreadByRoom, setUnreadByRoom] = useState({})
  const [typingByRoom, setTypingByRoom] = useState({})
  const [displayName, setDisplayName] = useState(user)
  const [mentionQuery, setMentionQuery] = useState(null)
  const [mentionIndex, setMentionIndex] = useState(0)
  const [replyTo, setReplyTo] = useState(null)

  const scrollRef = useRef(null)
  const emojiWrapRef = useRef(null)
  const socketRef = useRef(null)
  const activeRoomIdRef = useRef(null)
  const prevRoomRef = useRef(null)
  const roomsRef = useRef([])
  const typingTimerRef = useRef(null)
  const suppressScrollRef = useRef(false)

  useEffect(() => { activeRoomIdRef.current = activeRoomId }, [activeRoomId])
  useEffect(() => { roomsRef.current = rooms }, [rooms])

  // Request browser notification permission once
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    getRooms().then(rs => { if (!cancelled) setRooms(rs) }).catch(console.error)
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!activeRoomId && rooms.length) setActiveRoomId(rooms[0].id)
  }, [rooms, activeRoomId])

  useEffect(() => {
    const socket = getSocket(user)
    socketRef.current = socket

    const onMessageNew = (msg) => {
      setRooms(prev => prev.map(r =>
        r.id === msg.roomId ? { ...r, lastMessage: { who: msg.who, text: msg.text || '(message)', ts: msg.ts } } : r
      ))
      if (msg.roomId !== activeRoomIdRef.current) {
        setUnreadByRoom(prev => ({ ...prev, [msg.roomId]: (prev[msg.roomId] || 0) + 1 }))
        if (
          typeof Notification !== 'undefined' &&
          Notification.permission === 'granted' &&
          document.hidden &&
          msg.who !== displayName
        ) {
          const room = roomsRef.current.find(r => r.id === msg.roomId)
          new Notification(`${msg.who} · #${room?.name || msg.roomId}`, { body: msg.text || '' })
        }
        return
      }
      setMessages(prev => {
        const idx = prev.findIndex(m => m.clientId && m.clientId === msg.clientId)
        if (idx !== -1) {
          const copy = [...prev]
          copy[idx] = { id: msg.id, who: msg.who, text: msg.text, ts: msg.ts, reactions: msg.reactions || [], deleted: false, replyTo: msg.replyTo || null }
          return copy
        }
        if (prev.some(m => m.id === msg.id)) return prev
        return [...prev, { id: msg.id, who: msg.who, text: msg.text, ts: msg.ts, reactions: msg.reactions || [], deleted: false, replyTo: msg.replyTo || null }]
      })
    }

    const onPresence = ({ roomId, users }) => {
      setPresenceByRoom(prev => ({ ...prev, [roomId]: users }))
    }
    const onRoomCreated = (room) => {
      setRooms(prev => prev.some(r => r.id === room.id) ? prev : [room, ...prev])
    }
    const onTypingUpdate = ({ roomId, users }) => {
      setTypingByRoom(prev => ({ ...prev, [roomId]: users }))
    }
    const onReactionUpdate = ({ messageId, reactions }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions } : m))
    }
    const onMessageDeleted = ({ messageId }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, deleted: true, text: null } : m))
    }
    const onNameResolved = ({ name }) => setDisplayName(name)

    socket.on('message:new', onMessageNew)
    socket.on('presence:update', onPresence)
    socket.on('room:created', onRoomCreated)
    socket.on('typing:update', onTypingUpdate)
    socket.on('reaction:update', onReactionUpdate)
    socket.on('message:deleted', onMessageDeleted)
    socket.on('name:resolved', onNameResolved)

    return () => {
      socket.off('message:new', onMessageNew)
      socket.off('presence:update', onPresence)
      socket.off('room:created', onRoomCreated)
      socket.off('typing:update', onTypingUpdate)
      socket.off('reaction:update', onReactionUpdate)
      socket.off('message:deleted', onMessageDeleted)
      socket.off('name:resolved', onNameResolved)
    }
  }, [user])

  useEffect(() => {
    if (!activeRoomId) return
    const socket = socketRef.current
    if (prevRoomRef.current && prevRoomRef.current !== activeRoomId) {
      socket.emit('room:leave', prevRoomRef.current)
    }
    socket.emit('room:join', activeRoomId)
    prevRoomRef.current = activeRoomId
    setMessages([])
    setHasMore(false)
    getMessages(activeRoomId).then(msgs => {
      setMessages(msgs)
      setHasMore(msgs.length >= 50)
    }).catch(console.error)
  }, [activeRoomId])

  const filteredRooms = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rooms
    return rooms.filter(r => r.name.toLowerCase().includes(q))
  }, [rooms, query])

  const active = rooms.find(r => r.id === activeRoomId)

  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null || aiMode) return []
    const q = mentionQuery.toLowerCase()
    const fixed = ['All', 'AI'].filter(n => n.toLowerCase().startsWith(q))
    const present = (presenceByRoom[active?.id] || [])
      .filter(n => n !== displayName && n.toLowerCase().startsWith(q))
    return [...fixed, ...present]
  }, [mentionQuery, aiMode, presenceByRoom, active, displayName])

  useEffect(() => {
    if (suppressScrollRef.current) { suppressScrollRef.current = false; return }
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [activeRoomId, messages.length, aiMessages.length, aiMode])

  useEffect(() => {
    if (!showEmoji) return
    const close = (e) => {
      if (emojiWrapRef.current && !emojiWrapRef.current.contains(e.target)) setShowEmoji(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [showEmoji])

  const insertEmoji = (em) => {
    if (aiMode) setAiDraft(d => d + em)
    else setDraft(d => d + em)
    setShowEmoji(false)
  }

  const createRoom = async () => {
    const name = newName.trim()
    if (!name) return
    try {
      const room = await apiCreateRoom({ name, emoji: newEmoji, createdBy: displayName })
      setRooms(prev => prev.some(r => r.id === room.id) ? prev : [room, ...prev])
      setActiveRoomId(room.id)
    } catch (e) { console.error(e) }
    setNewName(""); setNewEmoji("💬"); setShowNew(false); setAiMode(false)
  }

  const handleDraftChange = (val) => {
    if (aiMode) { setAiDraft(val); return }
    setDraft(val)
    // Detect @mention at end of text
    const atMatch = val.match(/@([^\s@]*)$/)
    if (atMatch) {
      setMentionQuery(atMatch[1])
      setMentionIndex(0)
    } else if (mentionQuery !== null) {
      setMentionQuery(null)
    }
    if (!active) return
    socketRef.current?.emit('typing:start', active.id)
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    typingTimerRef.current = setTimeout(() => {
      socketRef.current?.emit('typing:stop', active.id)
      typingTimerRef.current = null
    }, 2000)
  }

  const insertMention = (name) => {
    const newDraft = draft.replace(/@([^\s@]*)$/, `@${name} `)
    setDraft(newDraft)
    setMentionQuery(null)
    setMentionIndex(0)
  }

  const send = () => {
    const text = draft.trim()
    if (!text || !active) return
    if (typingTimerRef.current) { clearTimeout(typingTimerRef.current); typingTimerRef.current = null }
    socketRef.current?.emit('typing:stop', active.id)
    const clientId = crypto.randomUUID()
    const currentReplyTo = replyTo || null
    setMessages(prev => [...prev, { id: clientId, clientId, who: displayName, text, ts: Date.now(), reactions: [], deleted: false, replyTo: currentReplyTo }])
    socketRef.current?.emit('message:send', { roomId: active.id, text, clientId, replyTo: currentReplyTo })
    setDraft("")
    setReplyTo(null)
    setMentionQuery(null)
  }

  const sendAi = async () => {
    const text = aiDraft.trim()
    if (!text || aiLoading) return
    const userMsg = { id: 'ai-' + Date.now(), who: displayName, text, ts: Date.now(), role: 'user' }
    const nextHistory = [...aiMessages, userMsg]
    setAiMessages(nextHistory)
    setAiDraft('')
    setAiLoading(true)
    const replyId = 'ai-' + Date.now() + '-r'
    setAiMessages(prev => [...prev, { id: replyId, who: 'Gemini', text: '', ts: Date.now(), role: 'assistant', streaming: true }])
    try {
      const response = await fetch('/api/ai/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextHistory.map(m => ({ role: m.role, text: m.text })) }),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const reader = response.body.getReader()
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
          const raw = line.slice(6).trim()
          if (raw === '[DONE]' || !raw) continue
          try {
            const { text: chunk, error } = JSON.parse(raw)
            if (error) throw new Error(error)
            if (chunk) setAiMessages(prev => prev.map(m => m.id === replyId ? { ...m, text: m.text + chunk } : m))
          } catch (e) { if (e.message !== 'Unexpected end of JSON input') throw e }
        }
      }
    } catch (err) {
      setAiMessages(prev => prev.map(m => m.id === replyId ? { ...m, text: '⚠️ ' + (err.message || 'Error') } : m))
    } finally {
      setAiMessages(prev => prev.map(m => m.id === replyId ? { ...m, streaming: false } : m))
      setAiLoading(false)
    }
  }

  const loadMore = async () => {
    if (loadingMore || !hasMore || !activeRoomId) return
    const el = scrollRef.current
    const prevH = el?.scrollHeight || 0
    setLoadingMore(true)
    try {
      const oldestTs = messages[0]?.ts
      const older = await getMessages(activeRoomId, { before: oldestTs, limit: 50 })
      if (older.length) {
        suppressScrollRef.current = true
        setMessages(prev => [...older, ...prev])
        requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - prevH })
      }
      setHasMore(older.length >= 50)
    } catch (e) { console.error(e) } finally { setLoadingMore(false) }
  }

  const handleReact = (messageId, emoji) => {
    socketRef.current?.emit('reaction:toggle', { messageId, roomId: activeRoomIdRef.current, emoji })
  }

  const handleDelete = (messageId) => {
    socketRef.current?.emit('message:delete', { messageId, roomId: activeRoomIdRef.current })
  }

  const handleReply = (msg) => {
    setReplyTo({ id: msg.id, who: msg.who, text: msg.text })
  }

  const onKey = (e) => {
    if (mentionQuery !== null && mentionSuggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => Math.min(i + 1, mentionSuggestions.length - 1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(i => Math.max(i - 1, 0)); return }
      if (e.key === 'Enter') { e.preventDefault(); insertMention(mentionSuggestions[mentionIndex]); return }
      if (e.key === 'Escape') { setMentionQuery(null); return }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      aiMode ? sendAi() : send()
    }
  }

  const selectRoom = (id) => {
    setActiveRoomId(id)
    setAiMode(false)
    setUnreadByRoom(prev => ({ ...prev, [id]: 0 }))
  }

  const lastMsgPreview = (room) => {
    const lm = room.lastMessage
    if (!lm) return { text:"no messages yet", ts: room.createdAt, you:false }
    return { text: lm.text || '(message)', ts: lm.ts, you: lm.who === displayName }
  }

  const handleLogout = () => {
    disconnectSocket()
    logout()
    navigate('/')
  }

  const currentDraft = aiMode ? aiDraft : draft
  const presentUsers = (presenceByRoom[active?.id] || []).filter(n => n !== displayName)
  const allRoomUsers = presenceByRoom[active?.id] || []
  const typingUsers = (typingByRoom[active?.id] || []).filter(u => u !== displayName)

  return (
    <div style={cs.app}>
      <style>{`
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.2}}
        .stream-cursor{animation:blink 1s step-end infinite}
      `}</style>

      {/* SIDEBAR */}
      <aside style={cs.sidebar}>
        <div style={cs.sideTop}>
          <div style={cs.brand}>
            <div style={cs.brandMark}><span style={cs.brandDot}/></div>
            <span style={cs.brandName}>chat-chat</span>
          </div>
          <button title="Sign out" style={cs.iconBtn} onClick={handleLogout}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        <div style={cs.searchWrap}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{color:"var(--ink-mute)"}}>
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2"/>
            <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <input
            style={cs.search}
            placeholder="Search rooms"
            value={query}
            onChange={(e)=>setQuery(e.target.value)}
          />
        </div>

        <button
          style={{...cs.aiBtn, ...(aiMode ? cs.aiBtnActive : {})}}
          onClick={() => setAiMode(true)}
        >
          <span style={cs.aiIcon}>🤖</span>
          <span>Chat with AI</span>
        </button>

        <button style={cs.newRoomBtn} onClick={() => setShowNew(true)}>
          <span style={cs.newPlus}>+</span>
          <span>Create new category</span>
        </button>

        <div style={cs.sideHead}>
          <span>Categories</span>
          <span style={cs.sideCount}>{filteredRooms.length}</span>
        </div>

        <div style={cs.roomList}>
          {filteredRooms.map(room => {
            const sel = !aiMode && room.id === activeRoomId
            const last = lastMsgPreview(room)
            const unread = unreadByRoom[room.id] || 0
            return (
              <button key={room.id}
                onClick={()=>selectRoom(room.id)}
                style={{...cs.roomItem, ...(sel ? cs.roomItemSel : {})}}>
                <div style={{...cs.roomEmoji, ...(sel ? cs.roomEmojiSel : {})}}>{room.emoji}</div>
                <div style={{flex:1, minWidth:0, textAlign:"left"}}>
                  <div style={cs.roomLine1}>
                    <span style={cs.roomName}>{room.name}</span>
                    <div style={{display:"flex", alignItems:"center", gap:5}}>
                      {unread > 0 && (
                        <div style={cs.unreadBadge}>{unread > 99 ? "99+" : unread}</div>
                      )}
                      <span style={cs.roomTime}>{fmtDay(last.ts)}</span>
                    </div>
                  </div>
                  <div style={cs.roomLine2}>
                    {last.you && <span style={cs.roomYou}>You: </span>}
                    <span style={cs.roomPrev}>{last.text}</span>
                  </div>
                </div>
              </button>
            )
          })}
          {filteredRooms.length === 0 && (
            <div style={cs.empty}>No rooms match "{query}"</div>
          )}
        </div>

        <div style={cs.youBar}>
          <div style={{...cs.avatar, background: avatarBg(displayName), color: avatarInk(displayName)}}>
            {initials(displayName)}
          </div>
          <div style={{flex:1, minWidth:0}}>
            <div style={cs.youName}>@{displayName}</div>
            <div style={cs.youStatus}>
              <span style={cs.statusDot}/> online
            </div>
          </div>
        </div>
      </aside>

      {/* CONVERSATION */}
      <main style={cs.convo}>
        {aiMode ? (
          <>
            <header style={cs.convoHead}>
              <div style={{display:"flex", alignItems:"center", gap:14}}>
                <div style={{...cs.headEmoji, background:"oklch(0.92 0.06 280)"}}>🤖</div>
                <div>
                  <div style={cs.headName}>AI Chat</div>
                  <div style={cs.headMeta}>powered by Gemini · streaming responses</div>
                </div>
              </div>
            </header>
            <div style={cs.convoBody} ref={scrollRef}>
              {aiMessages.length === 0 ? (
                <div style={cs.empty2}>
                  <div style={cs.emptyEmoji}>🤖</div>
                  <div style={cs.emptyTitle}>Chat with AI</div>
                  <div style={cs.emptySub}>Ask anything — powered by Gemini.</div>
                </div>
              ) : (
                <div style={{display:"flex", flexDirection:"column", gap:2}}>
                  {aiMessages.map(m => (
                    <MessageRow key={m.id} m={m} mine={m.role === "user"} grouped={false} currentUser={displayName}/>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : active ? (
          <>
            <header style={cs.convoHead}>
              <div style={{display:"flex", alignItems:"center", gap:14}}>
                <div style={cs.headEmoji}>{active.emoji}</div>
                <div>
                  <div style={cs.headName}>{active.name}</div>
                  <div style={cs.headMeta}>
                    created by @{active.createdBy} · {fmtDay(active.createdAt)}
                  </div>
                </div>
              </div>
              <div style={cs.headActions}>
                <PresenceDropdown allPresent={allRoomUsers} currentUser={displayName} />
                <button style={cs.iconBtn} title="Room info">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
                    <path d="M12 8h.01M11 12h1v5h1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </header>
            <div style={cs.convoBody} ref={scrollRef}>
              <MessageList
                messages={messages}
                user={displayName}
                room={active}
                hasMore={hasMore}
                loadingMore={loadingMore}
                onLoadMore={loadMore}
                onReact={handleReact}
                onDelete={handleDelete}
                onReply={handleReply}
              />
            </div>
            {typingUsers.length > 0 && (
              <div style={cs.typingBar}>
                ✦ {typingUsers.slice(0,3).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing…
              </div>
            )}
          </>
        ) : (
          <div style={cs.noRoom}>
            <h2 style={cs.noRoomH}>No room selected</h2>
            <p style={cs.noRoomP}>Pick a category on the left, or create a new one.</p>
            <button style={cs.ctaPrimary} onClick={()=>setShowNew(true)}>+ New category</button>
          </div>
        )}

        {(aiMode || active) && (
          <div style={{...cs.composer, position:"relative"}}>
            {/* @mention autocomplete dropdown */}
            {mentionQuery !== null && mentionSuggestions.length > 0 && (
              <div style={cs.mentionDropdown}>
                {mentionSuggestions.map((name, i) => (
                  <button
                    key={name}
                    style={{...cs.mentionItem, ...(i === mentionIndex ? cs.mentionItemSel : {})}}
                    onMouseDown={(e) => { e.preventDefault(); insertMention(name) }}
                    onMouseEnter={() => setMentionIndex(i)}
                  >
                    {name === 'All'
                      ? <span style={cs.mentionIcon}>👥</span>
                      : name === 'AI'
                      ? <span style={cs.mentionIcon}>🤖</span>
                      : <div style={{...cs.avatarSm, width:22, height:22, fontSize:9, flexShrink:0, background:avatarBg(name), color:avatarInk(name)}}>{initials(name)}</div>
                    }
                    <span style={{fontWeight:600}}>@{name}</span>
                    {name === 'All' && <span style={cs.mentionHint}>mention everyone</span>}
                    {name === 'AI' && <span style={cs.mentionHint}>ask Gemini</span>}
                  </button>
                ))}
              </div>
            )}
            {replyTo && !aiMode && (
              <div style={cs.replyStrip}>
                <div style={{width:3, borderRadius:2, background:"var(--accent)", flexShrink:0, alignSelf:"stretch"}}/>
                <div style={{flex:1, minWidth:0, paddingLeft:4}}>
                  <div style={{fontSize:11, fontWeight:600, color:"var(--accent-ink)", marginBottom:1}}>Reply to @{replyTo.who}</div>
                  <div style={{fontSize:12.5, color:"var(--ink-mute)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{replyTo.text?.slice(0,120)}</div>
                </div>
                <button style={{border:"none", background:"transparent", cursor:"pointer", color:"var(--ink-mute)", padding:"2px 4px", display:"grid", placeItems:"center", borderRadius:6}}
                  onClick={() => setReplyTo(null)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            )}
            <div style={cs.composerInner}>
              <textarea
                style={cs.compInput}
                placeholder={aiMode ? "Ask AI anything…" : `Message #${active?.name.toLowerCase().replace(/\s+/g,"-")} · @AI for Gemini`}
                value={currentDraft}
                onChange={(e)=>handleDraftChange(e.target.value)}
                onKeyDown={onKey}
                rows={1}
              />
              <div style={{position:"relative"}} ref={emojiWrapRef}>
                {showEmoji && (
                  <div style={cs.emojiPicker}>
                    {["😊","😂","❤️","😍","😭","😅","🥺","😁",
                      "😘","🤣","👍","🙏","😤","🔥","💀","🥰",
                      "😢","🤔","😏","💪","🎉","✨","🙌","💯",
                      "😎","🤩","😋","🤗","👀","🤦","🤷","🫶",
                      "💔","🎊","🥹","😔","🤪","😴","🥳","🫡"
                    ].map(em => (
                      <button key={em} style={cs.emojiPickBtn} onClick={() => insertEmoji(em)}>{em}</button>
                    ))}
                  </div>
                )}
                <button style={cs.compIconLg} title="Emoji" onClick={() => setShowEmoji(v => !v)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
                    <path d="M8 14s1.5 2 4 2 4-2 4-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <line x1="9" y1="9" x2="9.01" y2="9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                    <line x1="15" y1="9" x2="15.01" y2="9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
              <button
                style={{...cs.sendBtn, ...((currentDraft.trim() && !aiLoading) ? {} : cs.sendBtnOff)}}
                onClick={aiMode ? sendAi : send}
                disabled={!currentDraft.trim() || aiLoading}
                title={aiLoading ? "Waiting for Gemini…" : "Send"}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12l14-7-4 14-3-6-7-1z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
        )}
      </main>

      {showNew && (
        <div style={cs.scrim} onClick={()=>setShowNew(false)}>
          <div style={cs.modal} onClick={(e)=>e.stopPropagation()}>
            <div style={cs.modalKicker}>New category</div>
            <h3 style={cs.modalH}>Create a new room</h3>
            <p style={cs.modalP}>Give it a name and an emoji so it's easy to spot in the list.</p>
            <label style={cs.label}>Emoji</label>
            <div style={cs.emojiGrid}>
              {ROOM_PRESETS.map(e => (
                <button key={e}
                  style={{...cs.emojiCell, ...(newEmoji===e ? cs.emojiCellSel : {})}}
                  onClick={()=>setNewEmoji(e)}>
                  {e}
                </button>
              ))}
            </div>
            <label style={cs.label}>Name</label>
            <input
              style={cs.modalInput}
              placeholder="e.g. weekend plans"
              value={newName}
              onChange={(e)=>setNewName(e.target.value.slice(0,40))}
              autoFocus
              onKeyDown={(e)=>{ if (e.key==="Enter") createRoom() }}
            />
            <div style={cs.modalActions}>
              <button style={cs.ctaGhost} onClick={()=>setShowNew(false)}>Cancel</button>
              <button
                style={{...cs.ctaPrimary, opacity: newName.trim() ? 1 : 0.5}}
                disabled={!newName.trim()}
                onClick={createRoom}>
                Create room
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MessageList({ messages, user, room, hasMore, loadingMore, onLoadMore, onReact, onDelete, onReply }) {
  if (!messages.length && !hasMore) {
    return (
      <div style={cs.empty2}>
        <div style={cs.emptyEmoji}>{room.emoji}</div>
        <div style={cs.emptyTitle}>This room is quiet.</div>
        <div style={cs.emptySub}>Type a message below to get it started.</div>
      </div>
    )
  }
  const rows = []
  let lastDay = ""
  let lastWho = ""
  let lastTs = 0
  messages.forEach((m, i) => {
    const day = fmtDay(m.ts)
    if (day !== lastDay) {
      rows.push(<DayDivider key={"d"+i} label={day}/>)
      lastDay = day; lastWho = ""
    }
    const gap = m.ts - lastTs
    const grouped = m.who === lastWho && gap < 5*60_000
    rows.push(
      <MessageRow
        key={m.id}
        m={m}
        mine={m.who === user}
        grouped={grouped}
        currentUser={user}
        onReact={onReact ? (emoji) => onReact(m.id, emoji) : null}
        onDelete={onDelete ? () => onDelete(m.id) : null}
        onReply={onReply ? () => onReply(m) : null}
      />
    )
    lastWho = m.who; lastTs = m.ts
  })
  return (
    <div style={{display:"flex", flexDirection:"column", gap:2}}>
      {(hasMore || loadingMore) && (
        <div style={{textAlign:"center", padding:"12px 0 4px"}}>
          <button style={cs.loadMoreBtn} onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? "Loading…" : "↑ Load earlier messages"}
          </button>
        </div>
      )}
      {rows}
    </div>
  )
}

function DayDivider({label}) {
  return (
    <div style={cs.dayWrap}>
      <span style={cs.dayLine}/>
      <span style={cs.dayLabel}>{label}</span>
      <span style={cs.dayLine}/>
    </div>
  )
}

function MessageRow({ m, mine, grouped, currentUser, onReact, onDelete, onReply }) {
  const [hovered, setHovered] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const wrapRef = useRef(null)

  const hasMenu = onReply || (mine && onDelete)
  const hasActions = !m.deleted && (onReact || hasMenu)
  const isActive = hasActions && (hovered || showPicker || showMenu)

  useEffect(() => {
    if (!showPicker && !showMenu) return
    const close = (e) => {
      if (!wrapRef.current?.contains(e.target)) {
        setShowPicker(false)
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [showPicker, showMenu])

  const reactions = m.reactions || []
  const reactionGroups = {}
  for (const r of reactions) {
    if (!reactionGroups[r.emoji]) reactionGroups[r.emoji] = []
    reactionGroups[r.emoji].push(r.who)
  }
  const hasReactions = Object.keys(reactionGroups).length > 0

  return (
    <div
      ref={wrapRef}
      style={{display:"flex", flexDirection:"column", alignItems: mine ? "flex-end" : "flex-start", marginTop: grouped ? 2 : 10}}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Avatar aligned to bubble bottom only — reactions are outside this row */}
      <div style={{display:"flex", alignItems:"flex-end", maxWidth:"62%"}}>
        {!mine && (
          <div style={{width:32, marginRight:10, flexShrink:0}}>
            {!grouped && (
              <div style={{...cs.avatarSm, background: avatarBg(m.who), color: avatarInk(m.who)}}>
                {initials(m.who)}
              </div>
            )}
          </div>
        )}
        <div style={{display:"flex", flexDirection:"column", alignItems: mine ? "flex-end" : "flex-start", minWidth:0, flex:1}}>
          {!mine && !grouped && (
            <div style={cs.bubbleWho}>@{m.who} · <span style={cs.bubbleTime}>{fmtTime(m.ts)}</span></div>
          )}

          {/* Bubble + inline action pill */}
          <div style={{display:"flex", alignItems:"center", gap:5, flexDirection: mine ? "row-reverse" : "row"}}>
            <div style={{
              ...cs.bubble,
              ...(m.deleted ? cs.bubbleDeleted : mine ? cs.bubbleMine : cs.bubbleTheirs),
              ...(grouped && !m.deleted ? (mine ? cs.bubbleMineGrouped : cs.bubbleTheirsGrouped) : {}),
            }}>
              {m.replyTo && !m.deleted && (
                <div style={{display:"flex",gap:8,padding:"5px 8px",borderRadius:8,marginBottom:6,background:mine?"oklch(1 0 0 / 0.12)":"var(--bg-2)",border:`1px solid ${mine?"oklch(1 0 0 / 0.15)":"var(--line)"}`}}>
                  <div style={{width:3,borderRadius:2,background:mine?"oklch(1 0 0 / 0.4)":"var(--accent)",flexShrink:0,alignSelf:"stretch",minHeight:12}}/>
                  <div style={{minWidth:0,flex:1}}>
                    <div style={{fontSize:11,fontWeight:600,color:mine?"oklch(1 0 0 / 0.6)":"var(--accent-ink)",marginBottom:1}}>@{m.replyTo.who}</div>
                    <div style={{fontSize:12,color:mine?"oklch(1 0 0 / 0.65)":"var(--ink-mute)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.replyTo.text?.slice(0,100)}{m.replyTo.text?.length > 100 ? '…' : ''}</div>
                  </div>
                </div>
              )}
              {m.deleted
                ? <em>Message deleted</em>
                : m.streaming && !m.text
                ? <span style={{opacity:0.45}}>…</span>
                : m.text
              }
              {m.streaming && m.text && <span className="stream-cursor" style={{marginLeft:1, opacity:0.7}}>▍</span>}
            </div>

            {/* Action pill — stays mounted while picker/menu open */}
            {isActive && (
              <div style={{position:"relative", flexShrink:0}}>
                {/* Reaction emoji picker — floats above the pill */}
                {showPicker && onReact && (
                  <div style={{
                    position:"absolute",
                    bottom:"calc(100% + 5px)",
                    ...(mine ? {right:0} : {left:0}),
                    display:"flex",
                    gap:1,
                    background:"var(--card)",
                    border:"1px solid var(--line)",
                    borderRadius:24,
                    padding:"5px 8px",
                    boxShadow:"var(--shadow-md)",
                    zIndex:40,
                    whiteSpace:"nowrap",
                  }}>
                    {['👍','❤️','😂','😮','😢','🔥'].map(em => (
                      <button key={em} style={cs.reactionPickBtn}
                        onClick={() => { onReact(em); setShowPicker(false) }}>
                        {em}
                      </button>
                    ))}
                  </div>
                )}

                {/* 3-dot context menu — floats above the pill */}
                {showMenu && hasMenu && (
                  <div style={{
                    position:"absolute",
                    bottom:"calc(100% + 5px)",
                    ...(mine ? {right:0} : {left:0}),
                    background:"var(--card)",
                    border:"1px solid var(--line)",
                    borderRadius:12,
                    padding:"4px",
                    boxShadow:"var(--shadow-md)",
                    zIndex:40,
                    minWidth:160,
                  }}>
                    {onReply && (
                      <button
                        style={cs.menuItem}
                        onMouseEnter={e => e.currentTarget.style.background='var(--bg-2)'}
                        onMouseLeave={e => e.currentTarget.style.background='transparent'}
                        onClick={() => { onReply(); setShowMenu(false) }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{flexShrink:0}}>
                          <path d="M9 17l-5-5 5-5M4 12h10a7 7 0 0 1 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Reply
                      </button>
                    )}
                    {mine && onDelete && (
                      <button
                        style={{...cs.menuItem, color:"oklch(0.45 0.18 25)"}}
                        onMouseEnter={e => e.currentTarget.style.background='oklch(0.96 0.02 25)'}
                        onMouseLeave={e => e.currentTarget.style.background='transparent'}
                        onClick={() => { onDelete(); setShowMenu(false) }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{flexShrink:0}}>
                          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Delete message
                      </button>
                    )}
                  </div>
                )}

                {/* The pill itself */}
                <div style={cs.actionPill}>
                  {onReact && (
                    <button
                      style={{...cs.actionPillBtn, ...(showPicker ? cs.actionPillBtnOn : {})}}
                      onClick={() => { setShowPicker(v => !v); setShowMenu(false) }}
                      title="Add reaction">
                      <span style={{fontSize:14, lineHeight:1}}>😊</span>
                    </button>
                  )}
                  {onReact && hasMenu && (
                    <div style={{width:1, height:16, background:"var(--line)", flexShrink:0}}/>
                  )}
                  {hasMenu && (
                    <button
                      style={{...cs.actionPillBtn, ...(showMenu ? cs.actionPillBtnOn : {})}}
                      onClick={() => { setShowMenu(v => !v); setShowPicker(false) }}
                      title="More options">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="6" r="1.5" fill="currentColor"/>
                        <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
                        <circle cx="12" cy="18" r="1.5" fill="currentColor"/>
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reactions outside the avatar row — avatar stays at bubble bottom */}
      {!m.deleted && hasReactions && (
        <div style={{...cs.reactionsRow, ...(mine ? {} : {marginLeft:42})}}>
          {Object.entries(reactionGroups).map(([emoji, users]) => (
            <button
              key={emoji}
              style={{...cs.reactionPill, ...(users.includes(currentUser) ? cs.reactionPillActive : {})}}
              onClick={() => onReact?.(emoji)}
              title={users.join(', ')}
            >
              {emoji}<span style={{fontSize:11, marginLeft:2}}>{users.length}</span>
            </button>
          ))}
        </div>
      )}

      {mine && !grouped && (
        <div style={cs.bubbleTimeMine}>{fmtTime(m.ts)}</div>
      )}
    </div>
  )
}

function PresenceStack({names, extra}) {
  return (
    <div style={cs.presence}>
      {names.map((n, i) => (
        <div key={n} style={{
          ...cs.presenceAvatar,
          background: avatarBg(n),
          color: avatarInk(n),
          marginLeft: i === 0 ? 0 : -8,
          zIndex: 10 - i,
        }}>
          {initials(n)}
        </div>
      ))}
      {extra > 0 && <span style={cs.presenceCount}>+{extra}</span>}
    </div>
  )
}

function PresenceDropdown({ allPresent, currentUser }) {
  const [open, setOpen] = useState(false)
  const others = allPresent.filter(n => n !== currentUser)
  if (allPresent.length === 0) return null
  return (
    <div style={{position:"relative"}}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}>
      <div style={{...cs.presence, cursor:"default"}}>
        {others.slice(0, 4).map((n, i) => (
          <div key={n} style={{
            ...cs.presenceAvatar,
            background: avatarBg(n),
            color: avatarInk(n),
            marginLeft: i === 0 ? 0 : -8,
            zIndex: 10 - i,
          }}>
            {initials(n)}
          </div>
        ))}
        {others.length > 4 && <span style={cs.presenceCount}>+{others.length - 4}</span>}
        {others.length === 0 && (
          <span style={{fontSize:12, color:"var(--ink-mute)"}}>Only you</span>
        )}
      </div>
      {open && (
        <div style={cs.presencePanel}>
          <div style={cs.presencePanelTitle}>In this room · {allPresent.length}</div>
          {[currentUser, ...others].map(n => (
            <div key={n} style={cs.presencePanelRow}>
              <div style={{...cs.presenceAvatar, marginLeft:0, zIndex:1, background:avatarBg(n), color:avatarInk(n)}}>
                {initials(n)}
              </div>
              <span style={cs.presencePanelName}>{n}{n === currentUser ? ' (you)' : ''}</span>
              <span style={cs.presenceOnlineDot}/>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const cs = {
  app: { display:"grid", gridTemplateColumns:"320px 1fr", height:"100vh", background:"var(--bg)", overflow:"hidden" },

  sidebar: { background:"var(--card)", borderRight:"1px solid var(--line)", display:"flex", flexDirection:"column", minHeight:0 },
  sideTop: { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"18px 18px 12px" },
  brand: { display:"flex", alignItems:"center", gap:10 },
  brandMark: { width:30, height:30, borderRadius:9, background:"var(--ink)", display:"grid", placeItems:"center" },
  brandDot: { width:10, height:10, borderRadius:"50%", background:"var(--accent)", boxShadow:"0 0 0 3px oklch(0.62 0.13 162 / 0.25)" },
  brandName: { fontWeight:700, fontSize:16 },
  iconBtn: { width:32, height:32, borderRadius:8, border:"1px solid var(--line)", background:"var(--bg-2)", color:"var(--ink-soft)", display:"grid", placeItems:"center", cursor:"pointer" },

  searchWrap: { display:"flex", alignItems:"center", gap:8, margin:"0 14px 10px", padding:"9px 12px", background:"var(--bg-2)", borderRadius:10, border:"1px solid var(--line-2)" },
  search: { flex:1, border:"none", outline:"none", background:"transparent", fontSize:13.5, color:"var(--ink)" },

  aiBtn: { display:"flex", alignItems:"center", gap:10, margin:"0 14px 8px", padding:"11px 14px", borderRadius:10, border:"1px solid oklch(0.85 0.06 280)", background:"oklch(0.96 0.03 280)", color:"oklch(0.35 0.1 280)", fontWeight:600, fontSize:13.5, cursor:"pointer" },
  aiBtnActive: { background:"oklch(0.88 0.08 280)", borderColor:"oklch(0.7 0.12 280)" },
  aiIcon: { fontSize:18 },

  newRoomBtn: { display:"flex", alignItems:"center", gap:10, margin:"0 14px 14px", padding:"11px 14px", borderRadius:10, border:"1px dashed var(--accent)", background:"var(--accent-soft)", color:"var(--accent-ink)", fontWeight:600, fontSize:13.5, cursor:"pointer" },
  newPlus: { width:22, height:22, borderRadius:"50%", background:"var(--accent)", color:"#fff", display:"grid", placeItems:"center", fontWeight:700 },

  sideHead: { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 22px 6px", fontFamily:"var(--mono)", fontSize:11, color:"var(--ink-mute)", textTransform:"uppercase", letterSpacing:"0.08em" },
  sideCount: { fontWeight:600 },

  roomList: { flex:1, overflowY:"auto", padding:"4px 10px 10px", minHeight:0 },
  roomItem: { width:"100%", display:"flex", alignItems:"center", gap:12, padding:"10px 10px", borderRadius:12, border:"none", background:"transparent", cursor:"pointer", marginBottom:2 },
  roomItemSel: { background:"var(--bg-2)" },
  roomEmoji: { width:40, height:40, borderRadius:12, background:"var(--bg-2)", display:"grid", placeItems:"center", fontSize:20, flexShrink:0 },
  roomEmojiSel: { background:"var(--accent-soft)" },
  roomLine1: { display:"flex", alignItems:"baseline", justifyContent:"space-between", gap:8 },
  roomName: { fontSize:14, fontWeight:600, color:"var(--ink)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" },
  roomTime: { fontSize:11, color:"var(--ink-mute)", flexShrink:0 },
  roomLine2: { display:"flex", alignItems:"center", gap:4, marginTop:2 },
  roomYou: { fontSize:12.5, color:"var(--ink-mute)" },
  roomPrev: { fontSize:12.5, color:"var(--ink-mute)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:200 },

  empty: { padding:"22px 14px", color:"var(--ink-mute)", fontSize:13, textAlign:"center" },
  unreadBadge: { minWidth:18, height:18, borderRadius:9, background:"var(--accent)", color:"#fff", fontSize:10, fontWeight:700, display:"grid", placeItems:"center", padding:"0 4px", fontFamily:"var(--mono)" },

  youBar: { display:"flex", alignItems:"center", gap:12, padding:"12px 16px", borderTop:"1px solid var(--line)", background:"var(--bg-2)" },
  avatar: { width:36, height:36, borderRadius:"50%", display:"grid", placeItems:"center", fontWeight:700, fontSize:13 },
  avatarSm: { width:30, height:30, borderRadius:"50%", display:"grid", placeItems:"center", fontWeight:700, fontSize:11 },
  youName: { fontSize:14, fontWeight:600 },
  youStatus: { fontSize:12, color:"var(--ink-mute)", display:"flex", alignItems:"center", gap:5 },
  statusDot: { width:6, height:6, borderRadius:"50%", background:"oklch(0.7 0.16 145)" },

  convo: { display:"flex", flexDirection:"column", minHeight:0, background:"var(--bg)" },
  convoHead: { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 28px", borderBottom:"1px solid var(--line)", background:"var(--card)" },
  headEmoji: { width:44, height:44, borderRadius:12, background:"var(--accent-soft)", display:"grid", placeItems:"center", fontSize:22 },
  headName: { fontSize:17, fontWeight:700, letterSpacing:"-0.01em" },
  headMeta: { fontSize:12.5, color:"var(--ink-mute)", marginTop:2 },
  headActions: { display:"flex", alignItems:"center", gap:14 },

  presence: { display:"flex", alignItems:"center" },
  presenceAvatar: { width:28, height:28, borderRadius:"50%", display:"grid", placeItems:"center", fontWeight:700, fontSize:10.5, border:"2px solid var(--card)" },
  presenceCount: { marginLeft:8, fontSize:12, color:"var(--ink-mute)", fontFamily:"var(--mono)" },

  convoBody: { flex:1, overflowY:"auto", padding:"20px 28px", minHeight:0 },
  typingBar: { padding:"4px 28px 6px", fontSize:12.5, color:"var(--ink-mute)", fontStyle:"italic", minHeight:26 },

  loadMoreBtn: { padding:"5px 18px", borderRadius:20, border:"1px solid var(--line)", background:"var(--bg-2)", color:"var(--ink-mute)", fontSize:12, cursor:"pointer", fontFamily:"var(--mono)" },

  dayWrap: { display:"flex", alignItems:"center", gap:12, margin:"18px 0" },
  dayLine: { flex:1, height:1, background:"var(--line)" },
  dayLabel: { fontFamily:"var(--mono)", fontSize:11, color:"var(--ink-mute)", textTransform:"uppercase", letterSpacing:"0.08em" },

  msgRow: { display:"flex", alignItems:"flex-end" },
  bubble: { padding:"9px 14px 10px", borderRadius:18, fontSize:14.5, lineHeight:1.45, wordBreak:"break-word" },
  bubbleTheirs: { background:"var(--card)", color:"var(--ink)", border:"1px solid var(--line)", borderTopLeftRadius:6 },
  bubbleMine: { background:"var(--ink)", color:"#fff", borderTopRightRadius:6 },
  bubbleTheirsGrouped: { borderTopLeftRadius:18, borderBottomLeftRadius:18 },
  bubbleMineGrouped: { borderTopRightRadius:18, borderBottomRightRadius:18 },
  bubbleDeleted: { background:"var(--bg-2)", color:"var(--ink-mute)", border:"1px dashed var(--line)", borderRadius:18, fontStyle:"italic" },
  bubbleWho: { fontSize:11.5, color:"var(--ink-mute)", marginBottom:4, marginLeft:2, fontWeight:500 },
  bubbleTime: { color:"var(--ink-mute)" },
  bubbleTimeMine: { fontSize:11, color:"var(--ink-mute)", marginTop:4, marginRight:2 },

  actionPill: { display:"inline-flex", alignItems:"center", background:"var(--card)", border:"1px solid var(--line)", borderRadius:20, boxShadow:"var(--shadow-sm)" },
  actionPillBtn: { width:28, height:28, borderRadius:14, border:"none", background:"transparent", cursor:"pointer", display:"grid", placeItems:"center", color:"var(--ink-soft)" },
  actionPillBtnOn: { background:"var(--bg-2)" },
  reactionPickBtn: { width:30, height:30, borderRadius:7, border:"none", background:"transparent", fontSize:17, cursor:"pointer", display:"grid", placeItems:"center" },
  menuItem: { display:"flex", alignItems:"center", gap:8, width:"100%", padding:"7px 12px", borderRadius:8, border:"none", background:"transparent", color:"var(--ink)", fontSize:13.5, cursor:"pointer", fontWeight:500, textAlign:"left" },
  menuItemHover: { background:"oklch(0.96 0.02 25)" },
  reactionsRow: { display:"flex", flexWrap:"wrap", gap:4, marginTop:4 },
  reactionPill: { display:"inline-flex", alignItems:"center", gap:2, padding:"2px 8px 2px 6px", borderRadius:12, border:"1px solid var(--line)", background:"var(--bg-2)", fontSize:14, cursor:"pointer", lineHeight:1.4 },
  reactionPillActive: { background:"var(--accent-soft)", borderColor:"var(--accent)" },

  replyStrip: { display:"flex", alignItems:"center", gap:10, marginBottom:8, padding:"8px 12px", background:"var(--bg-2)", borderRadius:10, border:"1px solid var(--line)" },

  presencePanel: { position:"absolute", top:"calc(100% + 8px)", right:0, background:"var(--card)", border:"1px solid var(--line)", borderRadius:12, padding:"4px 0", boxShadow:"var(--shadow-md)", zIndex:30, minWidth:190, whiteSpace:"nowrap" },
  presencePanelTitle: { padding:"6px 14px 8px", fontSize:10.5, fontFamily:"var(--mono)", color:"var(--ink-mute)", textTransform:"uppercase", letterSpacing:"0.08em", borderBottom:"1px solid var(--line)", marginBottom:4 },
  presencePanelRow: { display:"flex", alignItems:"center", gap:10, padding:"5px 14px" },
  presencePanelName: { fontSize:13, fontWeight:500, color:"var(--ink)", flex:1 },
  presenceOnlineDot: { width:6, height:6, borderRadius:"50%", background:"oklch(0.7 0.16 145)", flexShrink:0 },

  composer: { padding:"12px 28px 22px", background:"var(--bg)" },
  mentionDropdown: { position:"absolute", bottom:"calc(100% - 8px)", left:28, right:28, background:"var(--card)", border:"1px solid var(--line)", borderRadius:12, padding:"4px", boxShadow:"var(--shadow-md)", zIndex:30, maxHeight:220, overflowY:"auto" },
  mentionItem: { display:"flex", alignItems:"center", gap:10, width:"100%", padding:"7px 12px", borderRadius:8, border:"none", background:"transparent", color:"var(--ink)", cursor:"pointer", fontSize:13.5, fontWeight:400, textAlign:"left" },
  mentionItemSel: { background:"var(--bg-2)" },
  mentionIcon: { fontSize:16, lineHeight:1, flexShrink:0 },
  mentionHint: { fontSize:12, color:"var(--ink-mute)", marginLeft:"auto", fontFamily:"var(--mono)" },
  composerInner: { display:"flex", alignItems:"center", gap:6, padding:"8px 8px 8px 16px", background:"var(--card)", border:"1px solid var(--line)", borderRadius:28, boxShadow:"var(--shadow-sm)" },
  compIconLg: { width:42, height:42, borderRadius:"50%", border:"none", background:"transparent", color:"var(--ink-soft)", cursor:"pointer", display:"grid", placeItems:"center", flexShrink:0 },
  compInput: { flex:1, border:"none", outline:"none", resize:"none", background:"transparent", fontSize:14.5, lineHeight:1.5, color:"var(--ink)", padding:"4px 2px", maxHeight:120, minHeight:24 },
  sendBtn: { width:42, height:42, borderRadius:"50%", border:"none", background:"var(--accent)", color:"oklch(0.18 0.05 162)", display:"grid", placeItems:"center", cursor:"pointer", flexShrink:0 },
  sendBtnOff: { background:"var(--bg-2)", color:"var(--ink-mute)", cursor:"not-allowed" },
  emojiPicker: { position:"absolute", bottom:"calc(100% + 10px)", right:0, background:"var(--card)", border:"1px solid var(--line)", borderRadius:16, padding:"10px", display:"grid", gridTemplateColumns:"repeat(8, 1fr)", gap:2, boxShadow:"var(--shadow-lg)", zIndex:20, width:288 },
  emojiPickBtn: { width:32, height:32, borderRadius:8, border:"none", background:"transparent", fontSize:18, cursor:"pointer", display:"grid", placeItems:"center" },

  empty2: { display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", color:"var(--ink-mute)", padding:"40px" },
  emptyEmoji: { fontSize:54, marginBottom:14 },
  emptyTitle: { fontFamily:"var(--serif)", fontSize:28, color:"var(--ink)", marginBottom:6 },
  emptySub: { fontSize:14 },

  noRoom: { display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", gap:14 },
  noRoomH: { fontFamily:"var(--serif)", fontSize:36, fontWeight:400, margin:0 },
  noRoomP: { color:"var(--ink-soft)", margin:0 },

  scrim: { position:"fixed", inset:0, background:"oklch(0.2 0.02 250 / 0.45)", display:"grid", placeItems:"center", zIndex:50, padding:24, backdropFilter:"blur(4px)" },
  modal: { width:"100%", maxWidth:460, background:"var(--card)", borderRadius:"var(--r-lg)", padding:"30px 32px 26px", boxShadow:"var(--shadow-lg)", border:"1px solid var(--line)" },
  modalKicker: { fontFamily:"var(--mono)", fontSize:11, color:"var(--accent-ink)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 },
  modalH: { fontFamily:"var(--serif)", fontSize:30, margin:"0 0 8px", fontWeight:400, letterSpacing:"-0.01em" },
  modalP: { fontSize:14, color:"var(--ink-soft)", margin:"0 0 22px" },
  label: { display:"block", fontFamily:"var(--mono)", fontSize:11, color:"var(--ink-mute)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:10 },
  emojiGrid: { display:"grid", gridTemplateColumns:"repeat(9, 1fr)", gap:6, marginBottom:20 },
  emojiCell: { aspectRatio:"1/1", borderRadius:8, border:"1px solid var(--line)", background:"var(--bg)", fontSize:18, cursor:"pointer", display:"grid", placeItems:"center" },
  emojiCellSel: { background:"var(--accent-soft)", borderColor:"var(--accent)" },
  modalInput: { width:"100%", padding:"12px 14px", border:"1.5px solid var(--line)", borderRadius:12, fontSize:15, outline:"none", background:"var(--bg)", marginBottom:24 },
  modalActions: { display:"flex", justifyContent:"flex-end", gap:10 },
  ctaPrimary: { background:"var(--ink)", color:"#fff", border:"none", padding:"11px 20px", borderRadius:10, fontSize:14, fontWeight:600, cursor:"pointer" },
  ctaGhost: { background:"transparent", color:"var(--ink-soft)", border:"1px solid var(--line)", padding:"11px 20px", borderRadius:10, fontSize:14, fontWeight:600, cursor:"pointer" },
}

export default Chat
