import { Router } from 'express'
import db from './db.js'

const router = Router()

const pageStmt = db.prepare(
  `SELECT * FROM messages WHERE room_id = ? AND ts < ? ORDER BY ts DESC LIMIT ?`
)
const latestStmt = db.prepare(
  `SELECT * FROM messages WHERE room_id = ? ORDER BY ts DESC LIMIT ?`
)

function toMessageDto(row) {
  return { id: row.id, who: row.who, text: row.text, ts: row.ts }
}

export const insertMessageStmt = db.prepare(
  `INSERT INTO messages (id, room_id, who, text, ts, client_id) VALUES (?, ?, ?, ?, ?, ?)`
)
export const findByClientIdStmt = db.prepare(
  `SELECT * FROM messages WHERE client_id = ?`
)

router.get('/:roomId/messages', (req, res) => {
  const { roomId } = req.params
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200)
  const before = parseInt(req.query.before, 10)
  const rows = Number.isFinite(before)
    ? pageStmt.all(roomId, before, limit)
    : latestStmt.all(roomId, limit)
  res.json(rows.reverse().map(toMessageDto))
})

export default router
