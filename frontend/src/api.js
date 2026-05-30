import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 60000,   // 60s — AI calls can be slow
  headers: { 'Content-Type': 'application/json' },
})

// ── Interview endpoints ──────────────────────────────────

export const generateQuestions = (config) =>
  api.post('/interview/questions', { config }).then(r => r.data.questions)

export const evaluateAnswer = (payload) =>
  api.post('/interview/evaluate', payload).then(r => r.data)

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

export default api
