import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 60000,   // 60s — AI calls can be slow
  headers: { 'Content-Type': 'application/json' },
})

// Human-readable reason for a failed request (backend sends { detail } on AI errors)
export function errorMessage(e) {
  const detail = e?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (e?.code === 'ECONNABORTED' || e?.name === 'TimeoutError') return 'The request timed out.'
  if (!e?.response) return 'Could not reach the backend. Is it running on port 8000?'
  return `Request failed (${e.response.status}).`
}

// ── Interview endpoints ──────────────────────────────────

// Resolves to { questions, fallback }. extras: resume_text, job_description, focus_areas
export const generateQuestions = (config, extras = {}) =>
  api.post('/interview/questions', { config, ...extras }).then(r => r.data)

// Resolves to { text, truncated }
export function uploadResume(file) {
  const form = new FormData()
  form.append('file', file)
  return api.post('/interview/resume', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)
}

// Streams server-sent events: onDelta gets each new piece of the written feedback,
// and the promise resolves with the full evaluation.
export async function evaluateAnswer(payload, onDelta) {
  const response = await fetch('/api/interview/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(60000),
  })
  if (!response.ok) throw { response: { status: response.status } }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let end
    while ((end = buffer.indexOf('\n\n')) !== -1) {
      const [eventLine, dataLine] = buffer.slice(0, end).split('\n')
      buffer = buffer.slice(end + 2)
      const event = eventLine.replace('event: ', '')
      const data = JSON.parse(dataLine.replace('data: ', ''))

      if (event === 'delta') onDelta?.(data)
      if (event === 'result') return data
      if (event === 'error') throw { response: { status: 503, data } }
    }
  }
  throw { response: { status: 502, data: { detail: 'The response ended before the evaluation finished.' } } }
}

export const generateFeedback = (payload) =>
  api.post('/interview/feedback', payload).then(r => r.data)

export const getHint = (question) =>
  api.post('/interview/hint', { question }).then(r => r.data.hint)

// ── Session endpoints ────────────────────────────────────

export const saveSession = (payload) =>
  api.post('/sessions/save', payload).then(r => r.data)

export const listSessions = () =>
  api.get('/sessions/').then(r => r.data)

export const getSession = (uid) =>
  api.get(`/sessions/${uid}`).then(r => r.data)

export const deleteSession = (uid) =>
  api.delete(`/sessions/${uid}`).then(r => r.data)

export const getStats = () =>
  api.get('/sessions/stats/summary').then(r => r.data)

export const getProgress = () =>
  api.get('/sessions/stats/progress').then(r => r.data)

export default api
