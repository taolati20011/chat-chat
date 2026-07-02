import { insertMessageStmt, findByClientIdStmt } from './messages.js'

const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 10_000

// roomId -> Set<user>
const presence = new Map()

function presenceList(roomId) {
  return Array.from(presence.get(roomId) || [])
}

function addPresence(roomId, user) {
  if (!presence.has(roomId)) presence.set(roomId, new Set())
  presence.get(roomId).add(user)
}

function removePresence(roomId, user) {
  const set = presence.get(roomId)
  if (!set) return
  set.delete(user)
  if (set.size === 0) presence.delete(roomId)
}

export function attachSocketHandlers(io) {
  io.on('connection', (socket) => {
    const user = (socket.handshake.auth?.user || '').trim().slice(0, 24)
    if (!user) {
      socket.disconnect(true)
      return
    }
    socket.data.user = user
    socket.data.joinedRooms = new Set()
    socket.data.sendTimestamps = []

    socket.on('room:join', (roomId) => {
      if (typeof roomId !== 'string') return
      socket.join(roomId)
      socket.data.joinedRooms.add(roomId)
      addPresence(roomId, user)
      io.to(roomId).emit('presence:update', { roomId, users: presenceList(roomId) })
    })

    socket.on('room:leave', (roomId) => {
      if (typeof roomId !== 'string') return
      socket.leave(roomId)
      socket.data.joinedRooms.delete(roomId)
      removePresence(roomId, user)
      io.to(roomId).emit('presence:update', { roomId, users: presenceList(roomId) })
    })

    socket.on('message:send', ({ roomId, text, clientId } = {}) => {
      if (typeof roomId !== 'string' || typeof text !== 'string' || typeof clientId !== 'string') return
      const trimmed = text.trim().slice(0, 4000)
      if (!trimmed) return

      const now = Date.now()
      const recent = socket.data.sendTimestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS)
      if (recent.length >= RATE_LIMIT_MAX) {
        socket.emit('message:error', { clientId, reason: 'rate_limited' })
        return
      }
      recent.push(now)
      socket.data.sendTimestamps = recent

      const existing = findByClientIdStmt.get(clientId)
      if (existing) {
        socket.emit('message:new', { id: existing.id, roomId, who: existing.who, text: existing.text, ts: existing.ts, clientId })
        return
      }

      const id = crypto.randomUUID()
      insertMessageStmt.run(id, roomId, user, trimmed, now, clientId)
      io.to(roomId).emit('message:new', { id, roomId, who: user, text: trimmed, ts: now, clientId })
    })

    socket.on('disconnect', () => {
      for (const roomId of socket.data.joinedRooms) {
        removePresence(roomId, user)
        io.to(roomId).emit('presence:update', { roomId, users: presenceList(roomId) })
      }
    })
  })
}
