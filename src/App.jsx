import { useState, useEffect } from 'react'
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Chat from './pages/Chat'

function App() {
  const [user, setUser] = useState(() => localStorage.getItem('chatchat.user') || '')
  const navigate = useNavigate()

  useEffect(() => {
    if (user) localStorage.setItem('chatchat.user', user)
  }, [user])

  const logout = () => {
    localStorage.removeItem('chatchat.user')
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
