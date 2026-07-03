import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = process.env.SQLITE_PATH || path.join(__dirname, 'data.sqlite')
const db = new DatabaseSync(dbPath)

db.exec('PRAGMA journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    emoji TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL REFERENCES rooms(id),
    who TEXT NOT NULL,
    text TEXT NOT NULL,
    ts INTEGER NOT NULL,
    client_id TEXT UNIQUE,
    deleted INTEGER DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_messages_room_ts ON messages(room_id, ts);

  CREATE TABLE IF NOT EXISTS reactions (
    message_id TEXT NOT NULL,
    emoji TEXT NOT NULL,
    who TEXT NOT NULL,
    PRIMARY KEY (message_id, emoji, who)
  );

  CREATE INDEX IF NOT EXISTS idx_reactions_msg ON reactions(message_id);
`)

// Migrate existing databases
try { db.exec('ALTER TABLE messages ADD COLUMN deleted INTEGER DEFAULT 0') } catch {}
// Fix accidental rename: if text_col exists, rename it back to text
{
  const cols = db.prepare('PRAGMA table_info(messages)').all()
  const hasTextCol = cols.some(c => c.name === 'text_col')
  const hasText = cols.some(c => c.name === 'text')
  if (hasTextCol && !hasText) {
    db.exec('ALTER TABLE messages RENAME COLUMN text_col TO text')
  }
}

const DEFAULT_ROOMS = [
  { id: 'r-general', name: 'General',   emoji: '💬', createdBy: 'system', daysAgo: 10 },
  { id: 'r-gaming',  name: 'Gaming',    emoji: '🎮', createdBy: 'system', daysAgo: 9 },
  { id: 'r-music',   name: 'Music',     emoji: '🎵', createdBy: 'system', daysAgo: 8 },
  { id: 'r-tech',    name: 'Tech talk', emoji: '🛠',  createdBy: 'system', daysAgo: 7 },
  { id: 'r-movies',  name: 'Movies',    emoji: '🎬', createdBy: 'system', daysAgo: 6 },
  { id: 'r-sports',  name: 'Sports',    emoji: '⚽', createdBy: 'system', daysAgo: 5 },
  { id: 'r-random',  name: 'Random',    emoji: '🪩', createdBy: 'system', daysAgo: 4 },
]

const roomCount = db.prepare('SELECT COUNT(*) AS n FROM rooms').get().n
if (roomCount === 0) {
  const insert = db.prepare(
    'INSERT INTO rooms (id, name, emoji, created_by, created_at) VALUES (?, ?, ?, ?, ?)'
  )
  const now = Date.now()
  db.exec('BEGIN')
  for (const r of DEFAULT_ROOMS) {
    insert.run(r.id, r.name, r.emoji, r.createdBy, now - r.daysAgo * 86400000)
  }
  db.exec('COMMIT')
}

export default db
