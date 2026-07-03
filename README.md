# chat-chat

Anonymous group chat app — no sign-up, no password. Users get a random animal name (or pick their own), join a room, and chat. Includes a real-time backend and an AI chat panel powered by Gemini.

Deploy: https://chat-chat-production-cfe9.up.railway.app/

## How to run

```bash
# 1. Install (do this once, or after pulling new commits)
npm install          # root (Vite frontend + concurrently)
npm install --prefix server   # backend (Express + Socket.io)

# 2. Start everything
npm run dev          # runs both servers concurrently
```

- Frontend: `http://localhost:5173` (Vite dev server)
- Backend API + WebSocket: `http://localhost:3001`

To stop: `kill $(cat /tmp/dev.pid)` or just close the terminal.

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite 5, react-router-dom v6 |
| Realtime | Socket.io-client (browser) ↔ Socket.io (server) |
| Backend | Node.js 22+, Express 4 |
| Database | Node built-in `node:sqlite` (DatabaseSync) — **not** better-sqlite3 |
| AI | Google Gemini API (`gemini-2.5-flash`) via server-side proxy |

### Why `node:sqlite` instead of `better-sqlite3`
This Windows machine has no working Python/C++ build toolchain, so any npm package requiring native compilation fails. `node:sqlite` is built into Node 22.5+ — zero install, zero compile.

## Project structure

```
chat-chat/
  src/
    pages/
      Landing.jsx       — marketing landing page
      Login.jsx         — anonymous name picker (no password)
      Chat.jsx          — main chat UI (rooms sidebar + conversation + AI panel)
    lib/
      api.js            — fetch wrappers for all REST calls
      socket.js         — socket.io-client singleton (getSocket / disconnectSocket)
    utils/
      animalNames.js    — random adjective+animal name generator
    App.jsx             — router + user state (username in localStorage)
    main.jsx            — React entry point
  server/
    index.js            — Express + Socket.io bootstrap, mounts all routers
    db.js               — SQLite schema (rooms + messages tables), seeds 7 default rooms
    rooms.js            — GET /api/rooms, POST /api/rooms
    messages.js         — GET /api/rooms/:id/messages?before=<ts>&limit=50
    socket.js           — Socket.io handlers: join/leave, message:send, presence, rate limit
    ai.js               — POST /api/ai/chat → Gemini proxy (multi-turn)
    retention.js        — hourly job: DELETE messages older than RETENTION_DAYS (default 7)
    .env                — GEMINI_API_KEY (gitignored — never commit this)
    package.json        — server-only deps (express, cors, socket.io)
  vite.config.js        — Vite dev proxy: /api and /socket.io → localhost:3001
  package.json          — frontend deps + concurrently scripts
  .gitignore
```

## Key architecture decisions

**No vendor lock-in for realtime** — chose custom Node + Socket.io over Supabase/Firebase/PartyKit so we own the full stack. Trade-off: scaling beyond 1 server instance requires a Redis adapter for Socket.io (not needed yet).

**Anonymous identity** — username is trusted from the client (`socket.handshake.auth.user`). No real auth, intentionally — matches the "no password, no email" branding. Anyone can impersonate a name; acceptable for a prototype.

**Server-assigned timestamps** — all `ts` fields are `Date.now()` on the server, not the client, so message ordering is authoritative even across clients with clock skew.

**Idempotent message sends** — every `message:send` socket event carries a client-generated `clientId` (UUID). The server inserts with `UNIQUE(client_id)` so retries are safe. The client reconciles the optimistic local message against the server echo by matching `clientId`.

**AI calls are server-side only** — Gemini API key lives in `server/.env`, never sent to the browser. `POST /api/ai/chat` proxies the full conversation history on every turn.

## Socket.io event reference

| Event (client → server) | Payload | Effect |
|---|---|---|
| `room:join` | `roomId` | socket joins room, presence broadcast |
| `room:leave` | `roomId` | socket leaves room, presence broadcast |
| `message:send` | `{ roomId, text, clientId }` | insert + broadcast `message:new` to room |

| Event (server → client) | Payload |
|---|---|
| `message:new` | `{ id, roomId, who, text, ts, clientId }` |
| `presence:update` | `{ roomId, users: string[] }` |
| `room:created` | room object (broadcast when POST /api/rooms succeeds) |
| `message:error` | `{ clientId, reason }` (e.g. `rate_limited`) |

Rate limit: 5 messages per 10 seconds per socket connection.

## REST API

```
GET  /api/rooms                         → room list with lastMessage preview
POST /api/rooms                         → create room { name, emoji, createdBy }
GET  /api/rooms/:id/messages            → paginated history (newest first, reversed)
                ?before=<ts>&limit=50
POST /api/ai/chat                       → Gemini proxy { messages: [{role, text}] }
```

## Gemini AI integration

- Model: `gemini-2.5-flash` (only 2.5-flash and 2.5-pro are available on this API key — 1.5/2.0 return 404)
- Key stored in `server/.env` as `GEMINI_API_KEY=...`
- Server loaded with `node --env-file-if-exists=.env --watch index.js` (no dotenv package needed)
- Multi-turn: the full `aiMessages` conversation history is sent on every request
- AI responses appear as `who: "Gemini"` in the chat bubble

## Data model (SQLite)

```sql
rooms    (id TEXT PK, name, emoji, created_by, created_at INTEGER)
messages (id TEXT PK, room_id REFERENCES rooms, who, text, ts INTEGER,
          client_id TEXT UNIQUE)   -- client_id enables idempotent retry
```

Default rooms seeded on first boot if table is empty: General, Gaming, Music, Tech talk, Movies, Sports, Random.

## Message retention

`server/retention.js` runs on startup and every hour:
```js
DELETE FROM messages WHERE ts < Date.now() - RETENTION_DAYS * 86400000
```
Default: 7 days. Override with `RETENTION_DAYS=3` in `server/.env`.

