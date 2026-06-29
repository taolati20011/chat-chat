import { useNavigate } from 'react-router-dom'

function Landing() {
  const navigate = useNavigate()
  const go = (p) => navigate(p === 'login' ? '/login' : '/chat')

  return (
    <div style={s.root}>
      <header style={s.nav}>
        <div style={s.brand}>
          <div style={s.brandMark}><span style={s.brandDot}></span></div>
          <span style={s.brandName}>chat-chat</span>
        </div>
        <nav style={s.navLinks}>
          <a style={s.navLink} href="#what">What it is</a>
          <a style={s.navLink} href="#peek">A peek</a>
          <a style={s.navLink} href="#how">How it works</a>
        </nav>
        <button style={s.navCta} onClick={() => go("login")}>
          Open chat-chat →
        </button>
      </header>

      <section style={s.hero}>
        <div style={s.heroLeft}>
          <div style={s.eyebrow}>
            <span style={s.eyebrowDot}></span>
            <span>Anonymous group chat — no sign-up, no hassle</span>
          </div>
          <h1 style={s.h1}>
            Pick a room. <em style={s.h1em}>Talk to anyone.</em><br/>
            Or chat with AI.
          </h1>
          <p style={s.lede}>
            chat-chat is anonymous group chat. No password, no email.
            You get a random animal name (or pick your own), join a category,
            and start talking. You can also chat with AI when nobody's around.
          </p>
          <div style={s.ctaRow}>
            <button style={s.ctaPrimary} onClick={() => go("login")}>
              Let's start
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{marginLeft:8}}>
                <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button style={s.ctaGhost} onClick={() => go("login")}>
              Try it out
            </button>
          </div>
          <div style={s.facts}>
            <Fact n="00:08" l="from landing to chatting"/>
            <Fact n="0 fields" l="no password needed"/>
            <Fact n="∞" l="rooms you can join"/>
          </div>
        </div>

        <div style={s.heroRight}>
          <PeekMock/>
        </div>
      </section>

      <section id="what" style={s.section}>
        <div style={s.sectionHead}>
          <span style={s.sectionKicker}>01 · What it is</span>
          <h2 style={s.h2}>Group chat, stripped to the parts that matter.</h2>
        </div>
        <div style={s.cards}>
          <Card
            title="Categories to explore"
            body="Browse rooms by topic — gaming, music, tech, random. Join one or create your own. Each is a live conversation."
            tag="rooms"
          />
          <Card
            title="Anonymous by default"
            body="You get a random animal name like 'Brave Otter' or 'Swift Penguin'. No password, no email, no profile picture. Just talk."
            tag="identity"
            highlight
          />
          <Card
            title="Chat with AI"
            body="No one online? Talk to AI instead. Same chat interface, powered by Claude. Ask anything."
            tag="ai"
          />
        </div>
      </section>

      <section id="peek" style={s.peekSection}>
        <div style={s.sectionHead}>
          <span style={s.sectionKicker}>02 · A peek inside</span>
          <h2 style={s.h2}>What a room looks like.</h2>
        </div>
        <div style={s.peekWrap}>
          <BigPeek/>
        </div>
      </section>

      <section id="how" style={s.section}>
        <div style={s.sectionHead}>
          <span style={s.sectionKicker}>03 · How it works</span>
          <h2 style={s.h2}>Three steps. Maybe four if you're slow.</h2>
        </div>
        <div style={s.steps}>
          <Step n="1" t="Get a name" b="Accept your random animal name or pick your own. No password."/>
          <Step n="2" t="Pick a room" b="Browse categories or create one. Gaming, music, random — your call."/>
          <Step n="3" t="Talk" b="Send messages to people or chat with AI. Walk away whenever."/>
        </div>
      </section>

      <section style={s.bigCta}>
        <div style={s.bigCtaInner}>
          <h2 style={s.bigCtaH}>Ready when you are.</h2>
          <p style={s.bigCtaP}>
            Get a name, pick a room, send a message. No onboarding tour.
          </p>
          <button style={s.ctaPrimaryBig} onClick={() => go("login")}>
            Let's start →
          </button>
        </div>
      </section>

      <footer style={s.footer}>
        <div style={s.brand}>
          <div style={s.brandMark}><span style={s.brandDot}></span></div>
          <span style={s.brandName}>chat-chat</span>
        </div>
        <span style={s.footMeta}>Anonymous group chat · prototype build</span>
      </footer>
    </div>
  )
}

function Fact({n, l}) {
  return (
    <div style={s.fact}>
      <div style={s.factN}>{n}</div>
      <div style={s.factL}>{l}</div>
    </div>
  )
}

function Card({title, body, tag, highlight}) {
  return (
    <div style={{...s.card, ...(highlight ? s.cardHi : {})}}>
      <div style={s.cardTag}>{tag}</div>
      <h3 style={s.cardH}>{title}</h3>
      <p style={s.cardP}>{body}</p>
    </div>
  )
}

function Step({n, t, b}) {
  return (
    <div style={s.step}>
      <div style={s.stepN}>{n}</div>
      <div>
        <div style={s.stepT}>{t}</div>
        <div style={s.stepB}>{b}</div>
      </div>
    </div>
  )
}

function PeekMock() {
  return (
    <div style={s.peekCard}>
      <div style={s.peekChrome}>
        <span style={{...s.peekDot, background:"#ff6058"}}/>
        <span style={{...s.peekDot, background:"#febc2f"}}/>
        <span style={{...s.peekDot, background:"#28c941"}}/>
        <span style={s.peekUrl}>chat-chat / gaming</span>
      </div>
      <div style={s.peekBody}>
        <aside style={s.peekSide}>
          <div style={s.peekSideHead}>Categories</div>
          {[
            ["Gaming", true, "4"],
            ["Music", false, "·"],
            ["Tech talk", false, "12"],
            ["Random", false, "·"],
          ].map(([n, sel, b], i) => (
            <div key={i} style={{...s.peekRoom, ...(sel ? s.peekRoomSel : {})}}>
              <span style={s.peekRoomDot}/>
              <span style={{flex:1}}>{n}</span>
              <span style={s.peekRoomBadge}>{b}</span>
            </div>
          ))}
          <div style={s.peekNew}>+ new room</div>
        </aside>
        <main style={s.peekMain}>
          <Bubble who="Swift Penguin" t="anyone playing tonight?" mine={false}/>
          <Bubble who="you" t="yes! let me finish dinner first" mine={true}/>
          <Bubble who="Brave Otter" t="same — 30 min?" mine={false}/>
          <div style={s.peekComposer}>
            <span style={s.peekInput}>Type a message…</span>
            <span style={s.peekSend}>↑</span>
          </div>
        </main>
      </div>
    </div>
  )
}

function BigPeek() {
  return (
    <div style={s.bigPeek}>
      <div style={s.peekChrome}>
        <span style={{...s.peekDot, background:"#ff6058"}}/>
        <span style={{...s.peekDot, background:"#febc2f"}}/>
        <span style={{...s.peekDot, background:"#28c941"}}/>
        <span style={s.peekUrl}>chat-chat / tech-talk</span>
      </div>
      <div style={{...s.peekBody, minHeight: 460, gridTemplateColumns: "240px 1fr"}}>
        <aside style={{...s.peekSide, width: 240}}>
          <div style={s.peekSideHead}>Categories</div>
          {[
            ["Tech talk", true, "12"],
            ["Gaming", false, "·"],
            ["Music", false, "3"],
            ["Movies", false, "·"],
            ["Random", false, "·"],
            ["AI Chat", false, "1"],
          ].map(([n, sel, b], i) => (
            <div key={i} style={{...s.peekRoom, ...(sel ? s.peekRoomSel : {})}}>
              <span style={s.peekRoomDot}/>
              <span style={{flex:1}}>{n}</span>
              <span style={s.peekRoomBadge}>{b}</span>
            </div>
          ))}
          <div style={s.peekNew}>+ new room</div>
        </aside>
        <main style={s.peekMain}>
          <div style={s.peekDay}>today</div>
          <Bubble who="Gentle Fox" t="anyone tried the new framework?" mine={false}/>
          <Bubble who="you" t="yeah it's fast but docs are rough" mine={true}/>
          <Bubble who="Curious Owl" t="i'll test it this weekend" mine={false}/>
          <Bubble who="Gentle Fox" t="lmk what you think 🙏" mine={false}/>
          <Bubble who="you" t="will share my notes here" mine={true}/>
          <div style={s.peekComposer}>
            <span style={s.peekInput}>Type a message…</span>
            <span style={s.peekSend}>↑</span>
          </div>
        </main>
      </div>
    </div>
  )
}

function Bubble({who, t, mine}) {
  return (
    <div style={{...s.bubbleRow, justifyContent: mine ? "flex-end" : "flex-start"}}>
      <div style={{...s.bubble, ...(mine ? s.bubbleMine : s.bubbleTheirs)}}>
        {!mine && <div style={s.bubbleWho}>{who}</div>}
        <div>{t}</div>
      </div>
    </div>
  )
}

const s = {
  root: { maxWidth: 1240, margin: "0 auto", padding: "28px 32px 0" },
  nav: { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"6px 0 28px" },
  brand: { display:"flex", alignItems:"center", gap:10 },
  brandMark: { width:34, height:34, borderRadius:10, background:"var(--ink)", display:"grid", placeItems:"center", position:"relative" },
  brandDot: { width:12, height:12, borderRadius:"50%", background:"var(--accent)", boxShadow:"0 0 0 3px oklch(0.62 0.13 162 / 0.25)" },
  brandName: { fontWeight:700, fontSize:18, letterSpacing:"-0.01em" },
  navLinks: { display:"flex", gap:28 },
  navLink: { color:"var(--ink-soft)", textDecoration:"none", fontSize:14, fontWeight:500 },
  navCta: { background:"var(--ink)", color:"#fff", border:"none", padding:"10px 18px", borderRadius:999, fontWeight:600, fontSize:14, cursor:"pointer" },

  hero: { display:"grid", gridTemplateColumns:"1.1fr 1fr", gap:48, alignItems:"center", padding:"24px 0 80px" },
  heroLeft: {},
  heroRight: {},
  eyebrow: { display:"inline-flex", alignItems:"center", gap:10, padding:"6px 14px 6px 12px", borderRadius:999, background:"var(--accent-soft)", color:"var(--accent-ink)", fontSize:13, fontWeight:500, marginBottom:24 },
  eyebrowDot: { width:7, height:7, borderRadius:"50%", background:"var(--accent)" },
  h1: { fontFamily:"var(--serif)", fontSize:"clamp(44px, 5.5vw, 72px)", lineHeight:1.02, margin:"0 0 22px", letterSpacing:"-0.02em", fontWeight:400 },
  h1em: { fontStyle:"italic", color:"var(--accent-ink)" },
  lede: { fontSize:18, lineHeight:1.55, color:"var(--ink-soft)", maxWidth:520, margin:"0 0 32px" },
  ctaRow: { display:"flex", gap:12, marginBottom:48 },
  ctaPrimary: { display:"inline-flex", alignItems:"center", background:"var(--ink)", color:"#fff", border:"none", padding:"14px 22px", borderRadius:999, fontSize:15, fontWeight:600, cursor:"pointer", boxShadow:"var(--shadow-md)" },
  ctaGhost: { background:"transparent", color:"var(--ink)", border:"1px solid var(--line)", padding:"14px 22px", borderRadius:999, fontSize:15, fontWeight:600, cursor:"pointer" },
  facts: { display:"flex", gap:36, flexWrap:"wrap" },
  fact: {},
  factN: { fontFamily:"var(--serif)", fontSize:28, lineHeight:1, color:"var(--ink)" },
  factL: { fontSize:12.5, color:"var(--ink-mute)", marginTop:6, textTransform:"uppercase", letterSpacing:"0.06em" },

  section: { padding:"80px 0" },
  sectionHead: { marginBottom: 40, maxWidth: 720 },
  sectionKicker: { fontFamily:"var(--mono)", fontSize:12, color:"var(--accent-ink)", letterSpacing:"0.04em" },
  h2: { fontFamily:"var(--serif)", fontSize:"clamp(32px, 3.4vw, 46px)", lineHeight:1.1, margin:"12px 0 0", fontWeight:400, letterSpacing:"-0.01em" },

  cards: { display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:18 },
  card: { background:"var(--card)", border:"1px solid var(--line)", borderRadius:"var(--r-lg)", padding:"28px 26px 30px", boxShadow:"var(--shadow-sm)" },
  cardHi: { background:"var(--ink)", color:"#fff", border:"1px solid var(--ink)" },
  cardTag: { fontFamily:"var(--mono)", fontSize:11, color:"var(--ink-mute)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:18 },
  cardH: { fontFamily:"var(--serif)", fontSize:26, margin:"0 0 10px", fontWeight:400, letterSpacing:"-0.01em" },
  cardP: { fontSize:15, lineHeight:1.55, color:"var(--ink-soft)", margin:0 },

  peekSection: { padding:"40px 0 80px" },
  peekWrap: { borderRadius:"var(--r-xl)", overflow:"hidden", boxShadow:"var(--shadow-lg)", border:"1px solid var(--line)" },

  steps: { display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:18 },
  step: { display:"flex", gap:16, padding:"22px 22px 26px", background:"var(--card)", border:"1px solid var(--line)", borderRadius:"var(--r-md)" },
  stepN: { fontFamily:"var(--serif)", fontSize:38, lineHeight:1, color:"var(--accent-ink)" },
  stepT: { fontSize:16, fontWeight:600, marginBottom:6 },
  stepB: { fontSize:14, color:"var(--ink-soft)", lineHeight:1.55 },

  bigCta: { padding:"60px 0 100px" },
  bigCtaInner: { background:"var(--ink)", color:"#fff", borderRadius:"var(--r-xl)", padding:"60px 56px", textAlign:"center", position:"relative", overflow:"hidden" },
  bigCtaH: { fontFamily:"var(--serif)", fontSize:"clamp(36px, 4vw, 56px)", margin:"0 0 14px", fontWeight:400, letterSpacing:"-0.01em" },
  bigCtaP: { fontSize:17, color:"oklch(0.78 0.01 250)", margin:"0 0 28px" },
  ctaPrimaryBig: { background:"var(--accent)", color:"oklch(0.18 0.05 162)", border:"none", padding:"16px 28px", borderRadius:999, fontSize:16, fontWeight:700, cursor:"pointer" },

  footer: { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"24px 0 32px", borderTop:"1px solid var(--line)" },
  footMeta: { fontSize:12.5, color:"var(--ink-mute)", fontFamily:"var(--mono)" },

  peekCard: { background:"var(--card)", borderRadius:"var(--r-lg)", boxShadow:"var(--shadow-lg)", border:"1px solid var(--line)", overflow:"hidden", transform:"rotate(-0.4deg)" },
  peekChrome: { display:"flex", alignItems:"center", gap:8, padding:"10px 14px", borderBottom:"1px solid var(--line-2)", background:"var(--bg-2)" },
  peekDot: { width:11, height:11, borderRadius:"50%" },
  peekUrl: { marginLeft:14, fontFamily:"var(--mono)", fontSize:12, color:"var(--ink-mute)" },
  peekBody: { display:"grid", gridTemplateColumns:"190px 1fr", minHeight: 360 },
  peekSide: { background:"var(--bg-2)", borderRight:"1px solid var(--line-2)", padding:"14px 10px" },
  peekSideHead: { fontFamily:"var(--mono)", fontSize:11, color:"var(--ink-mute)", textTransform:"uppercase", letterSpacing:"0.08em", padding:"4px 10px 10px" },
  peekRoom: { display:"flex", alignItems:"center", gap:10, padding:"8px 10px", borderRadius:8, fontSize:13.5, color:"var(--ink-soft)", marginBottom:2 },
  peekRoomSel: { background:"var(--card)", color:"var(--ink)", fontWeight:600, boxShadow:"var(--shadow-sm)" },
  peekRoomDot: { width:6, height:6, borderRadius:"50%", background:"var(--ink-mute)" },
  peekRoomBadge: { fontSize:11, color:"var(--ink-mute)", fontFamily:"var(--mono)" },
  peekNew: { marginTop:12, padding:"8px 10px", fontSize:13, color:"var(--accent-ink)", fontWeight:600, borderTop:"1px dashed var(--line)" },
  peekMain: { padding:"18px 18px 14px", display:"flex", flexDirection:"column", gap:8 },
  peekDay: { textAlign:"center", fontFamily:"var(--mono)", fontSize:11, color:"var(--ink-mute)", margin:"4px 0 8px" },
  bubbleRow: { display:"flex", width:"100%" },
  bubble: { maxWidth:"75%", padding:"9px 13px 10px", borderRadius:18, fontSize:13.5, lineHeight:1.4 },
  bubbleTheirs: { background:"var(--bg-2)", color:"var(--ink)", borderTopLeftRadius:6 },
  bubbleMine: { background:"var(--accent)", color:"oklch(0.18 0.05 162)", borderTopRightRadius:6 },
  bubbleWho: { fontSize:11, fontWeight:600, color:"var(--ink-mute)", marginBottom:2 },
  peekComposer: { marginTop:"auto", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 14px", border:"1px solid var(--line)", borderRadius:999, background:"var(--card)" },
  peekInput: { color:"var(--ink-mute)", fontSize:13 },
  peekSend: { width:26, height:26, borderRadius:"50%", background:"var(--ink)", color:"#fff", display:"grid", placeItems:"center", fontSize:14 },

  bigPeek: { background:"var(--card)" },
}

export default Landing
