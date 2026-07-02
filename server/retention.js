import db from './db.js'

const HOUR_MS = 60 * 60 * 1000
const RETENTION_DAYS = Number(process.env.RETENTION_DAYS) || 7

const deleteOldStmt = db.prepare('DELETE FROM messages WHERE ts < ?')

function purgeOldMessages() {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * HOUR_MS
  const result = deleteOldStmt.run(cutoff)
  if (result.changes > 0) {
    console.log(`[retention] purged ${result.changes} messages older than ${RETENTION_DAYS}d`)
  }
}

export function startRetentionJob() {
  purgeOldMessages()
  setInterval(purgeOldMessages, HOUR_MS)
}
