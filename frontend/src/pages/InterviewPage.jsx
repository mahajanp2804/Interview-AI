import { useState, useEffect, useRef } from 'react'
import { useApp } from '../AppContext'
import { evaluateAnswer, getHint } from '../api'

const INTERVIEWERS = ['Alex Chen','Sarah Mitchell','Raj Patel','Emma Rodriguez','Michael Kim','Priya Sharma']
const TYPE_LABEL = { technical: '🔧 Technical', behavioral: '🧠 Behavioral', 'system-design': '🏗 System Design' }

function fmt(text) {
  // Very light markdown: **bold**
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>')
}

function now() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function InterviewPage({ onEnd }) {
  const { state, dispatch } = useApp()
  const { session, config } = state
  const [messages, setMessages] = useState([])
  const [input, setInput]     = useState('')
  const [sending, setSending] = useState(false)
  const [hint, setHint]       = useState(null)
  const [liveScores, setLiveScores] = useState({ technical: 0, communication: 0, clarity: 0, confidence: 0 })
  const [avgScore, setAvgScore] = useState(null)
  const [interviewer] = useState(() => INTERVIEWERS[Math.floor(Math.random() * INTERVIEWERS.length)])
  const messagesEnd = useRef(null)
  const inputRef    = useRef(null)
  const answersRef  = useRef([])   // local mirror to avoid stale closure

  const scroll = () => messagesEnd.current?.scrollIntoView({ behavior: 'smooth' })

  const addMsg = (role, text) => {
    setMessages(prev => [...prev, { role, text, time: now() }])
    setTimeout(scroll, 50)
  }

  // Init: welcome + Q1
  useEffect(() => {
    if (!session.questions.length) return
    const company = config.company ? ` at ${config.company}` : ''
    addMsg('ai', `Hello! I'm **${interviewer}**, your interviewer today.\n\nWe'll be doing a **${config.interview_type}** interview for a **${config.role}** position${company} at **${config.level}** level.\n\n**${session.questions.length} questions** · **${config.difficulty}** difficulty\n\nUse the STAR method for behavioral questions. Think out loud for technical ones. Let's begin!`)
    setTimeout(() => askQuestion(0), 900)
  }, [])  // eslint-disable-line

  function askQuestion(idx) {
    if (idx >= session.questions.length) {
      addMsg('ai', "That's all the questions! Give me a moment to compile your results...")
      setTimeout(() => onEnd(answersRef.current), 1200)
      return
    }
    const q = session.questions[idx]
    addMsg('ai', `**Question ${idx + 1} of ${session.questions.length}** · ${TYPE_LABEL[q.type] ?? '🔧 Technical'}\n\n${q.q}`)
  }

  async function handleSend() {
    const answer = input.trim()
    if (!answer || sending) return
    setInput('')
    setSending(true)
    setHint(null)
    addMsg('user', answer)

    const q = session.questions[session.currentQ]
    dispatch({ type: 'SET_STATUS_BUSY', value: true })

    try {
      const ev = await evaluateAnswer({
        session_uid: session.uid,
        question: q.q,
        question_type: q.type,
        question_hint: q.hint,
        answer,
        config,
      })

      const entry = { q: q.q, a: answer, eval: ev, type: q.type }
      answersRef.current = [...answersRef.current, entry]
      dispatch({ type: 'PUSH_ANSWER', answer: entry })

      // Update live scores
      const all = answersRef.current
      const avg = (key) => Math.round(all.reduce((s, x) => s + (x.eval?.[key] ?? 0), 0) / all.length)
      const newScores = { technical: avg('technical'), communication: avg('communication'), clarity: avg('clarity'), confidence: avg('confidence') }
      setLiveScores(newScores)
      const overallAvg = Math.round(all.reduce((s, x) => s + (x.eval?.score ?? 0), 0) / all.length)
      setAvgScore(overallAvg)

      const icon = ev.score >= 80 ? '✅' : ev.score >= 60 ? '⚡' : '💭'
      addMsg('ai', `${icon} **Quick thoughts:** ${ev.feedback}\n\n${ev.followup_comment ?? ''}`)

      const nextIdx = session.currentQ  // currentQ already incremented by dispatch
      setTimeout(() => askQuestion(nextIdx), 1600)
    } catch (e) {
      const entry = { q: q.q, a: answer, eval: { score: 60, technical: 60, communication: 60, clarity: 60, confidence: 60, problem_solving: 60, feedback: 'Good attempt!', strengths: [], improvements: [], followup_comment: "Let's continue." }, type: q.type }
      answersRef.current = [...answersRef.current, entry]
      dispatch({ type: 'PUSH_ANSWER', answer: entry })
      addMsg('ai', "Good answer! Let's keep going.")
      setTimeout(() => askQuestion(session.currentQ), 1200)
    }

    dispatch({ type: 'SET_STATUS_BUSY', value: false })
    setSending(false)
    inputRef.current?.focus()
  }

  async function handleHint() {
    const q = session.questions[session.currentQ]
    if (!q) return
    try {
      const h = await getHint(q.q)
      setHint(h)
    } catch {
      setHint(q.hint ?? 'Think about the core concept and a real example from your experience.')
    }
  }

  function handleSkip() {
    const q = session.questions[session.currentQ]
    const entry = { q: q.q, a: '[SKIPPED]', eval: { score: 0, technical: 0, communication: 0, clarity: 0, confidence: 0, problem_solving: 0, feedback: 'Skipped.', strengths: [], improvements: ['Answer every question — skipping scores 0'], followup_comment: '' }, type: q.type }
    answersRef.current = [...answersRef.current, entry]
    dispatch({ type: 'PUSH_ANSWER', answer: entry })
    addMsg('ai', "No problem, let's move on. Skipping is noted — in a real interview, always attempt an answer even if uncertain.")
    setTimeout(() => askQuestion(session.currentQ), 800)
  }

  const pct = session.questions.length ? Math.round((session.currentQ / session.questions.length) * 100) : 0
  const ringOffset = 153 - (153 * (avgScore ?? 0) / 100)

  return (
    <div className="page" style={{ height: 'calc(100vh - 96px)' }}>
      <div className="interview-layout">
        {/* ── Chat area ── */}
        <div className="chat-area">
          <div className="chat-header">
            <div className="interviewer-avatar">🎙</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{interviewer}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{config.role} Interviewer</div>
            </div>
            <div className="chat-progress">
              <div className="progress-label">Q {Math.min(session.currentQ + 1, session.questions.length)} / {session.questions.length}</div>
              <div className="progress-bar"><div className="progress-fill" style={{ width: pct + '%' }} /></div>
            </div>
          </div>

          <div className="messages">
            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.role}`}>
                <div className={`msg-avatar ${m.role}`}>{m.role === 'ai' ? '🎙' : '👤'}</div>
                <div>
                  <div className={`msg-bubble ${m.role}`} dangerouslySetInnerHTML={{ __html: fmt(m.text) }} />
                  <div className="msg-time">{m.time}</div>
                </div>
              </div>
            ))}
            {sending && (
              <div className="msg ai">
                <div className="msg-avatar ai">🎙</div>
                <div className="msg-bubble ai"><span className="typing-dots"><span/><span/><span/></span></div>
              </div>
            )}
            <div ref={messagesEnd} />
          </div>

          <div className="input-area">
            <textarea
              ref={inputRef}
              className="answer-input"
              placeholder="Type your answer here... (Ctrl+Enter to submit)"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSend() }}
              disabled={sending}
            />
            <button className="btn btn-primary" onClick={handleSend} disabled={sending || !input.trim()} style={{ padding: '12px 18px', alignSelf: 'flex-end' }}>
              Send ↵
            </button>
          </div>
        </div>

        {/* ── Sidebar ── */}
        <div className="interview-sidebar">
          {/* Live score */}
          <div className="sidebar-section">
            <div className="sidebar-label">Live Score</div>
            <div className="score-ring">
              <div className="ring-wrap">
                <svg width="60" height="60" viewBox="0 0 60 60">
                  <circle cx="30" cy="30" r="24" fill="none" stroke="var(--bg3)" strokeWidth="5"/>
                  <circle cx="30" cy="30" r="24" fill="none" stroke="var(--accent)" strokeWidth="5"
                    strokeDasharray="153" strokeDashoffset={ringOffset} strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset .8s' }}/>
                </svg>
                <div className="ring-center">{avgScore ?? '—'}</div>
              </div>
              <div className="score-bars">
                {[['Technical','#4f8ef7', liveScores.technical],['Comm.','#10b981',liveScores.communication],['Clarity','#f59e0b',liveScores.clarity],['Confid.','#7c3aed',liveScores.confidence]].map(([label, color, val]) => (
                  <div key={label} className="score-row">
                    <span className="score-row-label">{label}</span>
                    <div className="mini-bar"><div className="mini-fill" style={{ width: val + '%', background: color }} /></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Question list */}
          <div className="sidebar-section">
            <div className="sidebar-label">Questions</div>
            <div className="q-list">
              {session.questions.map((q, i) => {
                const ans = answersRef.current[i]
                const cls = i === session.currentQ ? 'current' : ans ? (ans.a === '[SKIPPED]' ? 'skipped' : 'answered') : ''
                const icon = i === session.currentQ ? '▶' : ans ? (ans.a === '[SKIPPED]' ? '⏭' : '✓') : '○'
                return (
                  <div key={i} className={`q-item ${cls}`}>
                    {icon} Q{i+1}: {q.q.length > 52 ? q.q.slice(0,52) + '...' : q.q}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Hint */}
          <div className="sidebar-section">
            <button className="hint-btn" onClick={handleHint}>💡 Request a hint</button>
            {hint && <div className="hint-box">💡 {hint}</div>}
          </div>

          {/* Actions */}
          <div className="sidebar-section">
            <div className="sidebar-label">Actions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button className="option-btn" style={{ textAlign: 'left', fontSize: 11 }} onClick={handleSkip}>⏭ Skip this question</button>
              <button className="option-btn" style={{ textAlign: 'left', fontSize: 11, color: 'var(--red)', borderColor: 'var(--red)' }} onClick={() => onEnd(answersRef.current)}>🏁 End & get feedback</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
