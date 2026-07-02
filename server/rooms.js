import { Router } from 'express'
import db from './db.js'

const router = Router()

const listStmt = db.prepare('SELECT * FROM rooms ORDER BY created_at ASC')
const lastMsgStmt = db.prepare(
  'SELECT who, text, ts FROM messages WHERE room_id = ? ORDER BY ts DESC LIMIT 1'
)
const insertRoomStmt = db.prepare(
  'INSERT INTO rooms (id, name, emoji, created_by, created_at) VALUES (?, ?, ?, ?, ?)'
)

function toRoomDto(row) {
  const last = lastMsgStmt.get(row.id)
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    createdBy: row.created_by,
    createdAt: row.created_at,
    lastMessage: last ? { who: last.who, text: last.text, ts: last.ts } : null,
  }
}

router.get('/', (req, res) => {
  const rooms = listStmt.all().map(toRoomDto)
  res.json(rooms)
})

router.post('/', (req, res) => {
  const name = (req.body.name || '').trim().slice(0, 40)
  const emoji = (req.body.emoji || '💬').trim().slice(0, 4)
  const createdBy = (req.body.createdBy || '').trim().slice(0, 24)
  if (!name || !createdBy) {
    return res.status(400).json({ error: 'name and createdBy are required' })
  }
  const id = 'r-' + crypto.randomUUID().slice(0, 8)
  const createdAt = Date.now()
  insertRoomStmt.run(id, name, emoji, createdBy, createdAt)
  const room = { id, name, emoji, createdBy, createdAt, lastMessage: null }
  req.app.get('io').emit('room:created', room)
  res.status(201).json(room)
})

export default router
