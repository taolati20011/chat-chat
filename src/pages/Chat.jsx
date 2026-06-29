import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

const STORE_KEY = "chatchat.v1"
const now = () => Date.now()
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

const DEFAULT_CATEGORIES = [
  { id:"r-general", name:"General",   emoji:"💬", createdBy:"system", createdAt: Date.now() - 86400000*10 },
  { id:"r-gaming",  name:"Gaming",    emoji:"🎮", createdBy:"system", createdAt: Date.now() - 86400000*9 },
  { id:"r-music",   name:"Music",     emoji:"🎵", createdBy:"system", createdAt: Date.now() - 86400000*8 },
  { id:"r-tech",    name:"Tech talk", emoji:"🛠",  createdBy:"system", createdAt: Date.now() - 86400000*7 },
  { id:"r-movies",  name:"Movies",    emoji:"🎬", createdBy:"system", createdAt: Date.now() - 86400000*6 },
  { id:"r-sports",  name:"Sports",    emoji:"⚽", createdBy:"system", createdAt: Date.now() - 86400000*5 },
  { id:"r-random",  name:"Random",    emoji:"🪩", createdBy:"system", createdAt: Date.now() - 86400000*4 },
]

function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  const t = now()
  const msgs = {
    "r-general": [
      { id:"m1", who:"Swift Penguin", text:"hey everyone, new here!", ts: t - 3600_000*5 },
      { id:"m2", who:"Brave Otter",   text:"welcome! this place is chill", ts: t - 3600_000*5 + 70_000 },
      { id:"m3", who:"Gentle Fox",    text:"grab a room and start chatting", ts: t - 3600_000*4 },
    ],
    "r-gaming": [
      { id:"m1", who:"Fierce Tiger",  text:"anyone playing tonight?", ts: t - 3600_000*3 },
      { id:"m2", who:"Quick Falcon",  text:"yes! 30 min?", ts: t - 3600_000*3 + 40_000 },
      { id:"m3", who:"Fierce Tiger",  text:"perfect, see you there", ts: t - 3600_000*2 },
    ],
    "r-music": [
      { id:"m1", who:"Calm Deer",     text:"listening to anything good?", ts: t - 3600_000*22 },
      { id:"m2", who:"Jolly Parrot",  text:"new album dropped today 🔥", ts: t - 3600_000*21 },
    ],
    "r-tech": [
      { id:"m1", who:"Curious Owl",   text:"has anyone tried the new framework?", ts: t - 3600_000*2 },
      { id:"m2", who:"Nimble Gecko",   text:"yeah it's fast but docs are rough", ts: t - 3600_000*2 + 40_000 },
    ],
    "r-movies": [],
    "r-sports": [],
    "r-random": [
      { id:"m1", who:"Wild Cobra",    text:"random thought: do fish get thirsty?", ts: t - 3600_000*30 },
      { id:"m2", who:"Fuzzy Alpaca",   text:"asking the real questions", ts: t - 3600_000*28 },
    ],
  }
  const out = { cats: DEFAULT_CATEGORIES, msgs, active: "r-general" }
  localStorage.setItem(STORE_KEY, JSON.stringify(out))
  return out
}
function saveStore(s) { localStorage.setItem(STORE_KEY, JSON.stringify(s)) }

const ROOM_PRESETS = ["💬","🎬","🛠","🥡","🐈","📚","🎧","⚽","🎮","✈️","🍵","🌱","🪩","🧪","💡","📷","🎨","🧶"]

function Chat({ user, logout }) {
  const navigate = useNavigate()
  const [store, setStore] = useState(() => loadStore())
  const [query, setQuery] = useState("")
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState("")
  const [newEmoji, setNewEmoji] = useState("💬")
  const [draft, setDraft] = useState("")
  const [showEmoji, setShowEmoji] = useState(false)
  const [aiMode, setAiMode] = useState(false)
  const [aiMessages, setAiMessages] = useState([])
  const [aiDraft, setAiDraft] = useState("")
  const scrollRef = useRef(null)
  const emojiWrapRef = useRef(null)

  useEffect(() => { saveStore(store) }, [store])

  const filteredCats = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return store.cats
    return store.cats.filter(c => c.name.toLowerCase().includes(q))
  }, [store.cats, query])

  const active = store.cats.find(c => c.id === store.active) || store.cats[0]
  const messages = !aiMode && active ? (store.msgs[active.id] || []) : []

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [active && active.id, messages.length, aiMessages.length, aiMode])

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

  const createRoom = () => {
    const name = newName.trim()
    if (!name) return
    const id = "r-" + Math.random().toString(36).slice(2, 8)
    const cat = { id, name, emoji:newEmoji, createdBy:user, createdAt: now() }
    setStore(s => ({
      ...s,
      cats: [cat, ...s.cats],
      msgs: { ...s.msgs, [id]: [] },
      active: id,
    }))
    setNewName(""); setNewEmoji("💬"); setShowNew(false)
    setAiMode(false)
  }

  const send = () => {
    const text = draft.trim()
    if (!text || !active) return
    const m = { id: "m" + now(), who: user, text, ts: now() }
    setStore(s => ({
      ...s,
      msgs: { ...s.msgs, [active.id]: [...(s.msgs[active.id] || []), m] }
    }))
    setDraft("")

    const replies = [
      "ok noted","ha — same","fair","lol","yes",
      "i'll be there in a sec","good call","let's do it","makes sense to me",
      "👀","🙏","🔥","sounds right","one sec","on it"
    ]
    const others = ["Swift Penguin","Brave Otter","Gentle Fox","Curious Owl","Fierce Tiger","Calm Deer"].filter(n => n !== user)
    const who = others[Math.floor(Math.random()*others.length)]
    const txt = replies[Math.floor(Math.random()*replies.length)]
    setTimeout(() => {
      setStore(s => {
        if (!s.msgs[active.id]) return s
        return {
          ...s,
          msgs: {
            ...s.msgs,
            [active.id]: [...s.msgs[active.id], { id:"m"+now()+"-r", who, text:txt, ts: now() }]
          }
        }
      })
    }, 900 + Math.random()*1600)
  }

  const sendAi = () => {
    const text = aiDraft.trim()
    if (!text) return
    setAiMessages(prev => [...prev, { id: "ai-"+now(), who: user, text, ts: now(), role: "user" }])
    setAiDraft("")
    setTimeout(() => {
      setAiMessages(prev => [...prev, {
        id: "ai-"+now()+"-r",
        who: "Claude AI",
        text: "AI chat will be connected in Step 5! For now, this is a placeholder. I'll be able to answer your questions once the Claude API is integrated.",
        ts: now(),
        role: "assistant"
      }])
    }, 800 + Math.random()*1200)
  }

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      aiMode ? sendAi() : send()
    }
  }

  const selectRoom = (id) => {
    setStore(s => ({...s, active: id}))
    setAiMode(false)
  }

  const lastMsgPreview = (cat) => {
    const list = store.msgs[cat.id] || []
    const m = list[list.length-1]
    if (!m) return { text:"no messages yet", ts: cat.createdAt, you:false }
    return { text: m.text, ts: m.ts, you: m.who === user }
  }

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const currentDraft = aiMode ? aiDraft : draft
  const setCurrentDraft = aiMode ? setAiDraft : setDraft

  return (
    <div style={cs.app}>
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

        {/* AI Chat button */}
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
          <span style={cs.sideCount}>{filteredCats.length}</span>
        </div>

        <div style={cs.roomList}>
          {filteredCats.map(cat => {
            const sel = !aiMode && cat.id === store.active
            const last = lastMsgPreview(cat)
            return (
              <button key={cat.id}
                onClick={()=>selectRoom(cat.id)}
                style={{...cs.roomItem, ...(sel ? cs.roomItemSel : {})}}>
                <div style={{...cs.roomEmoji, ...(sel ? cs.roomEmojiSel : {})}}>{cat.emoji}</div>
                <div style={{flex:1, minWidth:0, textAlign:"left"}}>
                  <div style={cs.roomLine1}>
                    <span style={cs.roomName}>{cat.name}</span>
                    <span style={cs.roomTime}>{fmtDay(last.ts)}</span>
                  </div>
                  <div style={cs.roomLine2}>
                    {last.you && <span style={cs.roomYou}>You: </span>}
                    <span style={cs.roomPrev}>{last.text}</span>
                  </div>
                </div>
              </button>
            )
          })}
          {filteredCats.length === 0 && (
            <div style={cs.empty}>No rooms match "{query}"</div>
          )}
        </div>

        <div style={cs.youBar}>
          <div style={{...cs.avatar, background: avatarBg(user), color: avatarInk(user)}}>
            {initials(user)}
          </div>
          <div style={{flex:1, minWidth:0}}>
            <div style={cs.youName}>@{user}</div>
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
                  <div style={cs.headMeta}>powered by Claude · always available</div>
                </div>
              </div>
            </header>

            <div style={cs.convoBody} ref={scrollRef}>
              {aiMessages.length === 0 ? (
                <div style={cs.empty2}>
                  <div style={cs.emptyEmoji}>🤖</div>
                  <div style={cs.emptyTitle}>Chat with AI</div>
                  <div style={cs.emptySub}>Ask anything — powered by Claude. (Coming in Step 5!)</div>
                </div>
              ) : (
                <div style={{display:"flex", flexDirection:"column", gap:2}}>
                  {aiMessages.map(m => (
                    <MessageRow key={m.id} m={m} mine={m.role === "user"} grouped={false}/>
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
                <PresenceStack names={["Swift Penguin","Brave Otter","Gentle Fox","Curious Owl"].filter(n=>n!==user).slice(0,4)}/>
                <button style={cs.iconBtn} title="Room info">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
                    <path d="M12 8h.01M11 12h1v5h1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </header>

            <div style={cs.convoBody} ref={scrollRef}>
              <MessageList messages={messages} user={user} room={active}/>
            </div>
          </>
        ) : (
          <div style={cs.noRoom}>
            <h2 style={cs.noRoomH}>No room selected</h2>
            <p style={cs.noRoomP}>Pick a category on the left, or create a new one.</p>
            <button style={cs.ctaPrimary} onClick={()=>setShowNew(true)}>+ New category</button>
          </div>
        )}

        {/* COMPOSER — always visible when in a room or AI mode */}
        {(aiMode || active) && (
          <div style={cs.composer}>
            <div style={cs.composerInner}>
              <textarea
                style={cs.compInput}
                placeholder={aiMode ? "Ask AI anything..." : `Message #${active.name.toLowerCase().replace(/\s+/g,"-")}`}
                value={currentDraft}
                onChange={(e)=>setCurrentDraft(e.target.value)}
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
                style={{...cs.sendBtn, ...(currentDraft.trim() ? {} : cs.sendBtnOff)}}
                onClick={aiMode ? sendAi : send}
                disabled={!currentDraft.trim()}
                title="Send">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12l14-7-4 14-3-6-7-1z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* NEW ROOM MODAL */}
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

function MessageList({ messages, user, room }) {
  if (!messages.length) {
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
      lastDay = day
      lastWho = ""
    }
    const gap = m.ts - lastTs
    const grouped = m.who === lastWho && gap < 5*60_000
    rows.push(
      <MessageRow key={m.id} m={m} mine={m.who === user} grouped={grouped}/>
    )
    lastWho = m.who
    lastTs = m.ts
  })
  return <div style={{display:"flex", flexDirection:"column", gap:2}}>{rows}</div>
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

function MessageRow({m, mine, grouped}) {
  return (
    <div style={{...cs.msgRow, justifyContent: mine ? "flex-end" : "flex-start", marginTop: grouped ? 2 : 10}}>
      {!mine && (
        <div style={{width:32, marginRight:10, display:"flex", alignItems:"flex-end"}}>
          {!grouped && (
            <div style={{...cs.avatarSm, background: avatarBg(m.who), color: avatarInk(m.who)}}>
              {initials(m.who)}
            </div>
          )}
        </div>
      )}
      <div style={{maxWidth:"62%", display:"flex", flexDirection:"column", alignItems: mine ? "flex-end" : "flex-start"}}>
        {!mine && !grouped && (
          <div style={cs.bubbleWho}>@{m.who} · <span style={cs.bubbleTime}>{fmtTime(m.ts)}</span></div>
        )}
        <div style={{
          ...cs.bubble,
          ...(mine ? cs.bubbleMine : cs.bubbleTheirs),
          ...(grouped ? (mine ? cs.bubbleMineGrouped : cs.bubbleTheirsGrouped) : {})
        }}>
          {m.text}
        </div>
        {mine && !grouped && (
          <div style={cs.bubbleTimeMine}>{fmtTime(m.ts)}</div>
        )}
      </div>
    </div>
  )
}

function PresenceStack({names}) {
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
      <span style={cs.presenceCount}>+{Math.max(0, 12 - names.length)}</span>
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

  dayWrap: { display:"flex", alignItems:"center", gap:12, margin:"18px 0" },
  dayLine: { flex:1, height:1, background:"var(--line)" },
  dayLabel: { fontFamily:"var(--mono)", fontSize:11, color:"var(--ink-mute)", textTransform:"uppercase", letterSpacing:"0.08em" },

  msgRow: { display:"flex", alignItems:"flex-end" },
  bubble: { padding:"9px 14px 10px", borderRadius:18, fontSize:14.5, lineHeight:1.45, wordBreak:"break-word" },
  bubbleTheirs: { background:"var(--card)", color:"var(--ink)", border:"1px solid var(--line)", borderTopLeftRadius:6 },
  bubbleMine: { background:"var(--ink)", color:"#fff", borderTopRightRadius:6 },
  bubbleTheirsGrouped: { borderTopLeftRadius:18, borderBottomLeftRadius:18 },
  bubbleMineGrouped: { borderTopRightRadius:18, borderBottomRightRadius:18 },
  bubbleWho: { fontSize:11.5, color:"var(--ink-mute)", marginBottom:4, marginLeft:2, fontWeight:500 },
  bubbleTime: { color:"var(--ink-mute)" },
  bubbleTimeMine: { fontSize:11, color:"var(--ink-mute)", marginTop:4, marginRight:2 },

  composer: { padding:"12px 28px 22px", background:"var(--bg)" },
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
