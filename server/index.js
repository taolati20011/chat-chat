import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server } from 'socket.io'

import roomsRouter from './rooms.js'
import messagesRouter from './messages.js'
import aiRouter from './ai.js'
import { attachSocketHandlers } from './socket.js'
import { startRetentionJob } from './retention.js'

const PORT = Number(process.env.PORT) || 3001
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'

const app = express()
app.use(cors({ origin: CORS_ORIGIN }))
app.use(express.json())

const httpServer = createServer(app)
const io = new Server(httpServer, { cors: { origin: CORS_ORIGIN } })
app.set('io', io)

app.use('/api/rooms', roomsRouter)
app.use('/api/rooms', messagesRouter)
app.use('/api/ai', aiRouter)

attachSocketHandlers(io)
startRetentionJob()

httpServer.listen(PORT, () => {
  console.log(`chat-chat server listening on :${PORT}`)
})
