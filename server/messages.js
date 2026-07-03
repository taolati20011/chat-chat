import { Router } from 'express'
import db from './db.js'

const router = Router()

const pageStmt = db.prepare(
  `SELECT * FROM messages WHERE room_id = ? AND ts < ? ORDER BY ts DESC LIMIT ?`
)
const latestStmt = db.prepare(
  `SELECT * FROM messages WHERE room_id = ? ORDER BY ts DESC LIMIT ?`
)

function getReactionsForMessages(msgIds) {
  if (!msgIds.length) return {}
  const placeholders = msgIds.map(() => '?').join(',')
  const rows = db.prepare(
    `SELECT message_id, emoji, who FROM reactions WHERE message_id IN (${placeholders})`
  ).all(...msgIds)
  const map = {}
  for (const r of rows) {
    if (!map[r.message_id]) map[r.message_id] = []
    map[r.message_id].push({ emoji: r.emoji, who: r.who })
  }
  return map
}

function toMessageDto(row, reactionsMap = {}) {
  return {
    id: row.id,
    who: row.who,
    text: row.deleted ? null : row.text,
    ts: row.ts,
    deleted: !!row.deleted,
    reactions: reactionsMap[row.id] || [],
  }
}

export const insertMessageStmt = db.prepare(
  `INSERT INTO messages (id, room_id, who, text, ts, client_id) VALUES (?, ?, ?, ?, ?, ?)`
)
export const findByClientIdStmt = db.prepare(
  `SELECT * FROM messages WHERE client_id = ?`
)
export const deleteMessageStmt = db.prepare(
  `UPDATE messages SET deleted = 1 WHERE id = ? AND who = ?`
)

router.get('/:roomId/messages', (req, res) => {
  const { roomId } = req.params
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200)
  const before = parseInt(req.query.before, 10)
  const rows = Number.isFinite(before)
    ? pageStmt.all(roomId, before, limit)
    : latestStmt.all(roomId, limit)
  const reversed = rows.reverse()
  const reactionsMap = reversed.length ? getReactionsForMessages(reversed.map(r => r.id)) : {}
  res.json(reversed.map(r => toMessageDto(r, reactionsMap)))
})

export default router
