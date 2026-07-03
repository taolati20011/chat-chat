import { useState, useEffect } from 'react'
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Chat from './pages/Chat'

const SESSION_TTL = 24 * 60 * 60 * 1000

function loadUser() {
  try {
    const raw = localStorage.getItem('chatchat.user')
    if (!raw) return ''
    const parsed = JSON.parse(raw)
    if (parsed?.name && parsed?.expiresAt > Date.now()) {
      // Extend the window on every page load
      localStorage.setItem('chatchat.user', JSON.stringify({
        name: parsed.name,
        expiresAt: Date.now() + SESSION_TTL,
      }))
      return parsed.name
    }
    // Save the expired name as a hint for the Login page
    if (parsed?.name) localStorage.setItem('chatchat.lastUser', parsed.name)
  } catch {}
  localStorage.removeItem('chatchat.user')
  return ''
}

function App() {
  const [user, setUser] = useState(loadUser)
  const navigate = useNavigate()

  useEffect(() => {
    if (user) {
      localStorage.setItem('chatchat.user', JSON.stringify({
        name: user,
        expiresAt: Date.now() + SESSION_TTL,
      }))
    }
  }, [user])

  const logout = () => {
    localStorage.removeItem('chatchat.user')
    localStorage.removeItem('chatchat.lastUser')
    setUser('')
    navigate('/')
  }

  return (
    <div style={{ animation: 'fadeIn 280ms ease' }}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login setUser={setUser} />} />
        <Route
          path="/chat"
          element={
            user
              ? <Chat user={user} logout={logout} />
              : <Navigate to="/login" replace />
          }
        />
      </Routes>
    </div>
  )
}

export default App
