import { Router } from 'express'
import { callGemini, toGeminiContents, GEMINI_STREAM_URL } from './gemini.js'

const router = Router()

router.post('/chat', async (req, res) => {
  const key = process.env.GEMINI_API_KEY
  if (!key) return res.status(500).json({ error: 'GEMINI_API_KEY not set' })
  const { messages } = req.body
  if (!Array.isArray(messages) || !messages.length) {
    return res.status(400).json({ error: 'messages array required' })
  }
  try {
    const text = await callGemini(messages)
    res.json({ text })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/stream', async (req, res) => {
  const key = process.env.GEMINI_API_KEY
  if (!key) { res.status(500).json({ error: 'GEMINI_API_KEY not set' }); return }
  const { messages } = req.body
  if (!Array.isArray(messages) || !messages.length) {
    res.status(400).json({ error: 'messages array required' }); return
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  try {
    const response = await fetch(`${GEMINI_STREAM_URL}?key=${key}&alt=sse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: toGeminiContents(messages) }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      res.write(`data: ${JSON.stringify({ error: err?.error?.message || 'Gemini error' })}\n\n`)
      res.end()
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop()
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const raw = line.slice(6).trim()
        if (!raw || raw === '[DONE]') continue
        try {
          const parsed = JSON.parse(raw)
          const chunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text || ''
          if (chunk) res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`)
        } catch {}
      }
    }
    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`)
    res.end()
  }
})

export default router
