import db from './db.js'
import { insertMessageStmt, findByClientIdStmt, deleteMessageStmt } from './messages.js'
import { callGemini } from './gemini.js'

const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 10_000
const AI_TRIGGER = /^@AI\s+/i

// roomId -> Set<user>
const presence = new Map()
// roomId -> Map<user, timeoutId>
const typing = new Map()
// name → Set<sessionId>: only assign a suffix for a *different* sessionId
const takenNameSessions = new Map()

function resolveDisplayName(requestedName, sessionId) {
  const sessions = takenNameSessions.get(requestedName)
  // Name is free, or this sessionId already owns it (same device, duplicate tab)
  if (!sessions || sessions.has(sessionId)) return requestedName
  // Taken by a different device — find the next free slot for this sessionId
  let n = 2
  while (true) {
    const candidate = `${requestedName} #${n}`
    const cSessions = takenNameSessions.get(candidate)
    if (!cSessions || cSessions.has(sessionId)) return candidate
    n++
  }
}

const insertReactionStmt = db.prepare(
  'INSERT OR IGNORE INTO reactions (message_id, emoji, who) VALUES (?, ?, ?)'
)
const deleteReactionStmt = db.prepare(
  'DELETE FROM reactions WHERE message_id = ? AND emoji = ? AND who = ?'
)
const checkReactionStmt = db.prepare(
  'SELECT 1 AS found FROM reactions WHERE message_id = ? AND emoji = ? AND who = ?'
)
const getMessageReactionsStmt = db.prepare(
  'SELECT emoji, who FROM reactions WHERE message_id = ?'
)

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

function clearTyping(roomId, user, io) {
  const roomTypers = typing.get(roomId)
  if (!roomTypers?.has(user)) return
  clearTimeout(roomTypers.get(user))
  roomTypers.delete(user)
  if (roomTypers.size === 0) typing.delete(roomId)
  io.to(roomId).emit('typing:update', { roomId, users: [...(typing.get(roomId)?.keys() || [])] })
}

export function attachSocketHandlers(io) {
  io.on('connection', (socket) => {
    const requestedName = (socket.handshake.auth?.user || '').trim().slice(0, 24)
    const sessionId = (socket.handshake.auth?.sessionId || '').trim().slice(0, 64)
    if (!requestedName) { socket.disconnect(true); return }
    const user = resolveDisplayName(requestedName, sessionId)
    if (!takenNameSessions.has(user)) takenNameSessions.set(user, new Set())
    takenNameSessions.get(user).add(sessionId)
    socket.data.user = user
    socket.data.sessionId = sessionId
    socket.data.joinedRooms = new Set()
    socket.data.sendTimestamps = []
    socket.emit('name:resolved', { name: user })

    socket.on('room:join', (roomId) => {
      if (typeof roomId !== 'string') return
      socket.join(roomId)
      socket.data.joinedRooms.add(roomId)
      addPresence(roomId, user)
      io.to(roomId).emit('presence:update', { roomId, users: presenceList(roomId) })
    })

    socket.on('room:leave', (roomId) => {
      if (typeof roomId !== 'string') return
      clearTyping(roomId, user, io)
      socket.leave(roomId)
      socket.data.joinedRooms.delete(roomId)
      removePresence(roomId, user)
      io.to(roomId).emit('presence:update', { roomId, users: presenceList(roomId) })
    })

    socket.on('typing:start', (roomId) => {
      if (typeof roomId !== 'string') return
      if (!typing.has(roomId)) typing.set(roomId, new Map())
      const roomTypers = typing.get(roomId)
      if (roomTypers.has(user)) clearTimeout(roomTypers.get(user))
      const timer = setTimeout(() => clearTyping(roomId, user, io), 3000)
      roomTypers.set(user, timer)
      io.to(roomId).emit('typing:update', { roomId, users: [...roomTypers.keys()] })
    })

    socket.on('typing:stop', (roomId) => {
      if (typeof roomId !== 'string') return
      clearTyping(roomId, user, io)
    })

    socket.on('reaction:toggle', ({ messageId, roomId, emoji } = {}) => {
      if (typeof messageId !== 'string' || typeof emoji !== 'string' || typeof roomId !== 'string') return
      const exists = checkReactionStmt.get(messageId, emoji, user)
      if (exists) {
        deleteReactionStmt.run(messageId, emoji, user)
      } else {
        insertReactionStmt.run(messageId, emoji, user)
      }
      const reactions = getMessageReactionsStmt.all(messageId)
      io.emit('reaction:update', { messageId, roomId, reactions })
    })

    socket.on('message:delete', ({ messageId, roomId } = {}) => {
      if (typeof messageId !== 'string' || typeof roomId !== 'string') return
      const result = deleteMessageStmt.run(messageId, user)
      if (result.changes > 0) {
        io.emit('message:deleted', { messageId, roomId })
      }
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

      clearTyping(roomId, user, io)

      const existing = findByClientIdStmt.get(clientId)
      if (existing) {
        socket.emit('message:new', { id: existing.id, roomId, who: existing.who, text: existing.text, ts: existing.ts, clientId, reactions: [] })
        return
      }

      const id = crypto.randomUUID()
      insertMessageStmt.run(id, roomId, user, trimmed, now, clientId)
      // Broadcast globally so clients in other rooms can track unread counts
      io.emit('message:new', { id, roomId, who: user, text: trimmed, ts: now, clientId, reactions: [] })

      if (AI_TRIGGER.test(trimmed)) {
        const question = trimmed.replace(AI_TRIGGER, '').trim()
        callGemini([{ role: 'user', text: question }])
          .then(reply => {
            if (!reply) return
            const aiId = crypto.randomUUID()
            const aiTs = Date.now()
            insertMessageStmt.run(aiId, roomId, '🤖 Gemini', reply, aiTs, `ai-${aiId}`)
            io.emit('message:new', { id: aiId, roomId, who: '🤖 Gemini', text: reply, ts: aiTs, clientId: null, reactions: [] })
          })
          .catch(err => console.error('@AI error:', err.message))
      }
    })

    socket.on('disconnect', () => {
      const sessions = takenNameSessions.get(user)
      if (sessions) {
        sessions.delete(sessionId)
        if (sessions.size === 0) takenNameSessions.delete(user)
      }
      for (const roomId of socket.data.joinedRooms) {
        clearTyping(roomId, user, io)
        removePresence(roomId, user)
        io.to(roomId).emit('presence:update', { roomId, users: presenceList(roomId) })
      }
    })
  })
}
