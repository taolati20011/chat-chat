async function request(path, options) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) throw new Error(`${options?.method || 'GET'} ${path} failed: ${res.status}`)
  return res.json()
}

export function getRooms() {
  return request('/rooms')
}

export function getMessages(roomId, { before, limit = 50 } = {}) {
  const params = new URLSearchParams({ limit: String(limit) })
  if (before) params.set('before', String(before))
  return request(`/rooms/${roomId}/messages?${params}`)
}

export function createRoom({ name, emoji, createdBy }) {
  return request('/rooms', { method: 'POST', body: JSON.stringify({ name, emoji, createdBy }) })
}

export function sendAiMessage(messages) {
  return request('/ai/chat', { method: 'POST', body: JSON.stringify({ messages }) })
}
