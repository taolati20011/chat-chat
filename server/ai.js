import { Router } from 'express'

const router = Router()
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

router.post('/chat', async (req, res) => {
  const key = process.env.GEMINI_API_KEY
  if (!key) return res.status(500).json({ error: 'GEMINI_API_KEY not set in server/.env' })

  const { messages } = req.body
  if (!Array.isArray(messages) || !messages.length) {
    return res.status(400).json({ error: 'messages array required' })
  }

  // Gemini requires alternating user/model turns starting with user
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.text }],
  }))

  try {
    const response = await fetch(`${GEMINI_URL}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents }),
    })

    const data = await response.json()
    if (!response.ok) {
      const msg = data?.error?.message || JSON.stringify(data)
      return res.status(response.status).json({ error: msg })
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    res.json({ text })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
