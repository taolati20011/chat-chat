import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { fileURLToPath } from 'url'
import path from 'path'

import roomsRouter from './rooms.js'
import messagesRouter from './messages.js'
import aiRouter from './ai.js'
import { attachSocketHandlers } from './socket.js'
import { startRetentionJob } from './retention.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT) || 3001
const IS_PROD = process.env.NODE_ENV === 'production'

// In production everything is same-origin; in dev allow the Vite dev server
const CORS_ORIGIN = process.env.CORS_ORIGIN || (IS_PROD ? false : 'http://localhost:5173')

const app = express()
app.use(cors({ origin: CORS_ORIGIN }))
app.use(express.json())

const httpServer = createServer(app)
const io = new Server(httpServer, { cors: { origin: CORS_ORIGIN } })
app.set('io', io)

app.use('/api/rooms', roomsRouter)
app.use('/api/rooms', messagesRouter)
app.use('/api/ai', aiRouter)

// Serve the built React frontend in production
if (IS_PROD) {
  const dist = path.join(__dirname, '..', 'dist')
  app.use(express.static(dist))
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')))
}

attachSocketHandlers(io)
startRetentionJob()

httpServer.listen(PORT, () => {
  console.log(`chat-chat server listening on :${PORT} (${IS_PROD ? 'production' : 'development'})`)
})
