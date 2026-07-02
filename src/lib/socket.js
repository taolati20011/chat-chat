import { io } from 'socket.io-client'

let socket = null

export function getSocket(user) {
  if (socket) return socket
  socket = io({ autoConnect: false, auth: { user } })
  socket.connect()
  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
