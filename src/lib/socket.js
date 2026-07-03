import { io } from 'socket.io-client'

let socket = null

function getSessionId() {
  let id = localStorage.getItem('chatchat.sessionId')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('chatchat.sessionId', id)
  }
  return id
}

export function getSocket(user) {
  if (socket) return socket
  socket = io({ autoConnect: false, auth: { user, sessionId: getSessionId() } })
  socket.connect()
  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
