import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { generateAnimalName } from '../utils/animalNames'

function Login({ setUser }) {
  const navigate = useNavigate()
  const [name, setName] = useState(() => localStorage.getItem('chatchat.lastUser') || generateAnimalName())
  const [shake, setShake] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current && inputRef.current.focus()
  }, [])

  const randomize = () => {
    setName(generateAnimalName())
  }

  const submit = (e) => {
    e && e.preventDefault()
    const v = name.trim()
    if (v.length < 2) {
      setShake(true)
      setTimeout(() => setShake(false), 420)
      return
    }
    localStorage.removeItem('chatchat.lastUser')
    setUser(v)
    navigate('/chat')
  }

  return (
    <div style={s.root}>
      <aside style={s.left}>
        <div style={s.leftInner}>
          <button style={s.back} onClick={() => navigate('/')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back
          </button>
          <div style={s.brand}>
            <div style={s.brandMark}><span style={s.brandDot}/></div>
            <span style={s.brandName}>chat-chat</span>
          </div>
          <div style={s.leftCopy}>
            <p style={s.kicker}>· step one of one ·</p>
            <h2 style={s.leftH}>What should people call you in here?</h2>
            <p style={s.leftP}>
              No password, no email, no profile picture.
              We gave you a random animal name — keep it or pick your own.
            </p>
          </div>
          <div style={s.tips}>
            <Tip t="You got a random animal name by default."/>
            <Tip t="Change it to anything you like."/>
            <Tip t="No verification, no spam."/>
          </div>
        </div>
      </aside>

      <main style={s.right}>
        <form style={{...s.formCard, ...(shake ? s.shake : {})}} onSubmit={submit}>
          <label style={s.label} htmlFor="uname">Your name</label>
          <div style={s.inputRow}>
            <span style={s.inputAt}>@</span>
            <input
              id="uname"
              ref={inputRef}
              style={s.input}
              placeholder="e.g. Brave Otter, Swift Penguin"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 24))}
              autoComplete="off"
            />
            <button type="button" style={s.diceBtn} onClick={randomize} title="Random name">
              🎲
            </button>
          </div>
          <div style={s.hint}>
            {name.trim().length >= 2
              ? <span style={{color:"var(--accent-ink)"}}>looks good — hit continue</span>
              : <span>2 characters or more</span>}
          </div>
          <button type="submit" style={s.continue}>
            Continue
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{marginLeft:8}}>
              <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div style={s.legal}>
            By continuing you agree to be kind in the chat.
          </div>
        </form>
      </main>
    </div>
  )
}

function Tip({t}) {
  return (
    <div style={s.tip}>
      <span style={s.tipDot}/>
      <span>{t}</span>
    </div>
  )
}

const s = {
  root: { minHeight:"100vh", display:"grid", gridTemplateColumns:"1fr 1fr" },
  left: { background:"var(--ink)", color:"#fff", display:"flex", alignItems:"center", padding:"40px 56px" },
  leftInner: { width:"100%", maxWidth:460, display:"flex", flexDirection:"column", gap:36 },
  back: { display:"inline-flex", alignItems:"center", gap:8, background:"rgba(255,255,255,0.08)", color:"#fff", border:"1px solid rgba(255,255,255,0.12)", padding:"7px 14px 7px 12px", borderRadius:999, fontSize:13, fontWeight:500, cursor:"pointer", alignSelf:"flex-start" },
  brand: { display:"flex", alignItems:"center", gap:10 },
  brandMark: { width:34, height:34, borderRadius:10, background:"rgba(255,255,255,0.08)", display:"grid", placeItems:"center" },
  brandDot: { width:12, height:12, borderRadius:"50%", background:"var(--accent)", boxShadow:"0 0 0 3px oklch(0.62 0.13 162 / 0.25)" },
  brandName: { fontWeight:700, fontSize:18 },
  leftCopy: { marginTop: 12 },
  kicker: { fontFamily:"var(--mono)", fontSize:12, color:"var(--accent)", margin:"0 0 14px", letterSpacing:"0.05em" },
  leftH: { fontFamily:"var(--serif)", fontSize:48, lineHeight:1.05, margin:"0 0 18px", fontWeight:400, letterSpacing:"-0.01em" },
  leftP: { fontSize:16, lineHeight:1.55, color:"oklch(0.82 0.01 250)", margin:0, maxWidth:380 },
  tips: { display:"flex", flexDirection:"column", gap:10, marginTop:8 },
  tip: { display:"flex", alignItems:"center", gap:12, fontSize:14, color:"oklch(0.82 0.01 250)" },
  tipDot: { width:5, height:5, borderRadius:"50%", background:"var(--accent)" },

  right: { background:"var(--bg)", display:"flex", alignItems:"center", justifyContent:"center", padding:"40px 56px" },
  formCard: { width:"100%", maxWidth:440, background:"var(--card)", borderRadius:"var(--r-lg)", border:"1px solid var(--line)", padding:"36px 32px 30px", boxShadow:"var(--shadow-md)" },
  shake: { animation:"shake 0.42s" },
  label: { display:"block", fontFamily:"var(--mono)", fontSize:11, color:"var(--ink-mute)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:12 },
  inputRow: { display:"flex", alignItems:"center", gap:6, padding:"14px 16px", border:"1.5px solid var(--line)", borderRadius:"var(--r-md)", background:"var(--bg)" },
  inputAt: { color:"var(--ink-mute)", fontSize:18, fontWeight:500 },
  input: { flex:1, border:"none", outline:"none", background:"transparent", fontSize:18, color:"var(--ink)", fontWeight:500 },
  diceBtn: { background:"none", border:"none", fontSize:22, cursor:"pointer", padding:"0 4px", lineHeight:1 },
  hint: { fontSize:12.5, color:"var(--ink-mute)", marginTop:10, marginBottom:24, fontFamily:"var(--mono)" },
  continue: { width:"100%", display:"inline-flex", alignItems:"center", justifyContent:"center", background:"var(--ink)", color:"#fff", border:"none", padding:"14px 22px", borderRadius:"var(--r-md)", fontSize:15, fontWeight:600, cursor:"pointer" },
  legal: { fontSize:11.5, color:"var(--ink-mute)", textAlign:"center", marginTop:16, fontFamily:"var(--mono)" },
}

export default Login
