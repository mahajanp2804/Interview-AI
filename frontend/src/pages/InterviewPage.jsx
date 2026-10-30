import { lazy, Suspense, useState, useEffect, useRef } from 'react'
import { useApp } from '../AppContext'
import { evaluateAnswer, getHint, errorMessage } from '../api'
import Formatted from '../Formatted'
import { formatTime } from '../format'
import { canSpeak, speak, stopSpeaking, useDictation } from '../speech'

// Loaded on demand: the editor is large and most interviews don't need it
const CodeEditor = lazy(() => import('../CodeEditor'))

const INTERVIEWERS = ['Alex Chen','Sarah Mitchell','Raj Patel','Emma Rodriguez','Michael Kim','Priya Sharma']
const TYPE_LABEL = { technical: '🔧 Technical', behavioral: '🧠 Behavioral', 'system-design': '🏗 System Design', coding: '💻 Coding' }
const TIME_BUDGET = { technical: 180, behavioral: 120, 'system-design': 300, coding: 600 }   // seconds
const FOLLOWUP_BELOW = 70   // answers scoring under this get a follow-up question
const SCORE_KEYS = ['score', 'technical', 'communication', 'clarity', 'confidence', 'problem_solving']
const CODE_LANGUAGES = [['python', 'Python'], ['javascript', 'JavaScript'], ['java', 'Java'], ['cpp', 'C++']]
const VOICE_KEY = 'iai_voice'

function now() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function average(answers, key) {
  if (!answers.length) return null
  return Math.round(answers.reduce((s, x) => s + (x.eval?.[key] ?? 0), 0) / answers.length)
}

// A follow-up can only help: a better answer pulls the question's scores up halfway towards it
function withFollowup(entry, followup) {
  if (followup.eval.score <= entry.eval.score) return { ...entry, followup }
  const merged = Object.fromEntries(SCORE_KEYS.map(k => [k, Math.round((entry.eval[k] + followup.eval[k]) / 2)]))
  return { ...entry, followup, eval: { ...entry.eval, ...merged } }
}

function loadVoice() {
  try { return localStorage.getItem(VOICE_KEY) === 'on' } catch { return false }
}

function saveVoice(on) {
  try { localStorage.setItem(VOICE_KEY, on ? 'on' : 'off') } catch { /* best-effort */ }
}

function QuestionTimer({ startedAt, budget }) {
  const [time, setTime] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setTime(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const left = Math.min(budget, budget - Math.floor((time - startedAt) / 1000))
  const cls = left < 0 ? 'over' : left <= 30 ? 'low' : ''
  return (
    <div className={`question-timer ${cls}`} title="Time guide for this question. It won't stop you.">
      ⏱ {left < 0 ? '+' : ''}{formatTime(Math.abs(left))}
    </div>
  )
}

export default function InterviewPage({ onEnd }) {
  const { state, dispatch } = useApp()
  const { session, config } = state
  const [messages, setMessages] = useState([])
  const [input, setInput]     = useState('')
  const [code, setCode]       = useState('')
  const [codeMode, setCodeMode] = useState(false)
  const [language, setLanguage] = useState('python')
  const [sending, setSending] = useState(false)
  const [hint, setHint]       = useState(null)
  const [voice, setVoice]     = useState(loadVoice)
  const [interviewer] = useState(() => INTERVIEWERS[Math.floor(Math.random() * INTERVIEWERS.length)])
  const messagesEnd = useRef(null)
  const inputRef    = useRef(null)
  const answersRef  = useRef(session.answers)   // local mirror to avoid stale closure
  const voiceRef    = useRef(voice)
  const endedRef    = useRef(false)
  const startedRef  = useRef(false)
  const nextMsgId   = useRef(0)

  const dictation = useDictation(text => setInput(prev => (prev ? `${prev} ${text}` : text)))

  const scroll = () => messagesEnd.current?.scrollIntoView({ behavior: 'smooth' })

  const addMsg = (role, text) => {
    setMessages(prev => [...prev, { id: nextMsgId.current++, role, text, time: now() }])
    setTimeout(scroll, 50)
  }

  // Adds or updates the message being streamed
  const setStreamed = (id, text) => {
    setMessages(prev => (
      prev.some(m => m.id === id)
        ? prev.map(m => (m.id === id ? { ...m, text } : m))
        : [...prev, { id, role: 'ai', text, time: now() }]
    ))
    setTimeout(scroll, 50)
  }

  // Init: welcome + current question (resumes mid-interview after a refresh or tab switch)
  useEffect(() => {
    if (!session.questions.length || startedRef.current) return
    startedRef.current = true   // StrictMode runs effects twice in dev
    if (session.currentQ > 0 || session.followup) {
      addMsg('ai', `Welcome back! Let's pick up where we left off.`)
    } else {
      const company = config.company ? ` at ${config.company}` : ''
      const fallbackNote = session.fallback
        ? `\n\n⚠ The AI couldn't generate questions, so these come from the built-in question bank.`
        : ''
      addMsg('ai', `Hello! I'm **${interviewer}**, your interviewer today.\n\nWe'll be doing a **${config.interview_type}** interview for a **${config.role}** position${company} at **${config.level}** level.\n\n**${session.questions.length} questions** · **${config.difficulty}** difficulty\n\nUse the STAR method for behavioral questions. Think out loud for technical ones. Let's begin!${fallbackNote}`)
    }
    setTimeout(() => {
      if (session.followup) askFollowup(session.followup.q)
      else askQuestion(session.currentQ)
    }, 900)
  }, [])  // eslint-disable-line

  useEffect(() => stopSpeaking, [])

  function finish(answers) {
    if (endedRef.current) return
    endedRef.current = true
    stopSpeaking()
    dictation.stop()
    onEnd(answers)
  }

  function askQuestion(idx) {
    if (idx >= session.questions.length) {
      addMsg('ai', "That's all the questions! Give me a moment to compile your results...")
      setTimeout(() => finish(answersRef.current), 1200)
      return
    }
    const q = session.questions[idx]
    setCodeMode(q.type === 'coding')
    addMsg('ai', `**Question ${idx + 1} of ${session.questions.length}** · ${TYPE_LABEL[q.type] ?? '🔧 Technical'}\n\n${q.q}`)
    if (voiceRef.current) speak(q.q)
  }

  function askFollowup(text) {
    setCodeMode(false)
    addMsg('ai', `**Follow-up** · ${text}`)
    if (voiceRef.current) speak(text)
  }

  // Records the answer and moves on. `session` here is this render's snapshot,
  // so the next index is computed explicitly rather than read back after dispatch.
  function recordAndAdvance(entry, delay) {
    const nextIdx = session.currentQ + 1
    answersRef.current = [...answersRef.current, entry]
    dispatch({ type: 'PUSH_ANSWER', answer: entry })
    setTimeout(() => {
      askQuestion(nextIdx)
      setSending(false)
      inputRef.current?.focus()
    }, delay)
  }

  const elapsed = () => Math.round((Date.now() - session.questionStartedAt) / 1000)

  async function handleSend() {
    const answer = codeMode
      ? (code.trim() ? `\`\`\`${language}\n${code.trim()}\n\`\`\`` : '')
      : input.trim()
    if (!answer || sending) return

    const draft = { input, code }
    setInput('')
    setCode('')
    setSending(true)
    setHint(null)
    dictation.stop()
    stopSpeaking()
    addMsg('user', answer)

    const q = session.questions[session.currentQ]
    const { followup } = session
    const streamId = nextMsgId.current++
    let streamed = ''
    dispatch({ type: 'SET_STATUS_BUSY', value: true })

    try {
      const ev = await evaluateAnswer({
        session_uid: session.uid,
        question: followup ? followup.q : q.q,
        question_type: q.type,
        question_hint: q.hint,
        answer,
        config,
        hints_used: !followup && session.hintUsed ? 1 : 0,
        ...(followup && { parent_question: q.q, parent_answer: followup.entry.a }),
      }, (delta) => {
        streamed += delta
        setStreamed(streamId, `**Quick thoughts:** ${streamed}`)
      })

      const icon = ev.score >= 80 ? '✅' : ev.score >= 60 ? '⚡' : '💭'
      const nextFollowup = !followup && ev.score < FOLLOWUP_BELOW ? (ev.followup_question || q.followup) : null
      const penalty = ev.hint_penalty ? `\n\n(${ev.hint_penalty} points off for using the hint.)` : ''
      const transition = nextFollowup ? '' : `\n\n${ev.followup_comment ?? ''}`
      setStreamed(streamId, `${icon} **Quick thoughts:** ${ev.feedback}${penalty}${transition}`)

      if (followup) {
        recordAndAdvance({
          ...withFollowup(followup.entry, { q: followup.q, a: answer, eval: ev }),
          time_sec: elapsed(),
        }, 1600)
      } else {
        const entry = { q: q.q, a: answer, eval: ev, type: q.type, hints_used: session.hintUsed ? 1 : 0, time_sec: elapsed() }
        if (nextFollowup) {
          dispatch({ type: 'SET_FOLLOWUP', followup: { q: nextFollowup, entry } })
          setTimeout(() => {
            askFollowup(nextFollowup)
            setSending(false)
            inputRef.current?.focus()
          }, 1600)
        } else {
          recordAndAdvance(entry, 1600)
        }
      }
    } catch (e) {
      // Don't invent a score: keep the answer so it can be resent
      setMessages(prev => prev.filter(m => m.id !== streamId))
      addMsg('ai', `⚠ **I couldn't evaluate that answer.** ${errorMessage(e)}\n\nYour answer is back in the box. Send it again when you're ready.`)
      setInput(draft.input)
      setCode(draft.code)
      setSending(false)
    }

    dispatch({ type: 'SET_STATUS_BUSY', value: false })
  }

  async function handleHint() {
    const q = session.questions[session.currentQ]
    if (!q || session.hintUsed) return
    dispatch({ type: 'USE_HINT' })
    try {
      const h = await getHint(q.q)
      setHint(h)
    } catch {
      setHint(q.hint ?? 'Think about the core concept and a real example from your experience.')
    }
  }

  function handleSkip() {
    const q = session.questions[session.currentQ]
    if (!q || sending) return
    setSending(true)
    setHint(null)
    dictation.stop()
    stopSpeaking()
    if (session.followup) {
      // Only the follow-up is skipped: the answer it followed still counts
      addMsg('ai', "Fair enough, let's move on.")
      recordAndAdvance(session.followup.entry, 800)
      return
    }
    addMsg('ai', "No problem, let's move on. Skipping is noted — in a real interview, always attempt an answer even if uncertain.")
    recordAndAdvance({ q: q.q, a: '[SKIPPED]', eval: { score: 0, technical: 0, communication: 0, clarity: 0, confidence: 0, problem_solving: 0, feedback: 'Skipped.', strengths: [], improvements: ['Answer every question — skipping scores 0'], followup_comment: '', followup_question: '', model_answer: '' }, type: q.type, time_sec: elapsed() }, 800)
  }

  function toggleVoice() {
    const next = !voice
    setVoice(next)
    voiceRef.current = next
    saveVoice(next)
    if (!next) stopSpeaking()
  }

  const answers = session.answers
  const avgScore = average(answers, 'score')
  const liveScores = {
    technical: average(answers, 'technical') ?? 0,
    communication: average(answers, 'communication') ?? 0,
    clarity: average(answers, 'clarity') ?? 0,
    confidence: average(answers, 'confidence') ?? 0,
  }
  const pct = session.questions.length ? Math.round((session.currentQ / session.questions.length) * 100) : 0
  const ringOffset = 153 - (153 * (avgScore ?? 0) / 100)
  const current = session.questions[session.currentQ]
  const canSend = !sending && !!(codeMode ? code.trim() : input.trim())

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
            {current && session.questionStartedAt && (
              <QuestionTimer startedAt={session.questionStartedAt} budget={TIME_BUDGET[current.type] ?? TIME_BUDGET.technical} />
            )}
            <div className="chat-progress">
              <div className="progress-label">Q {Math.min(session.currentQ + 1, session.questions.length)} / {session.questions.length}</div>
              <div className="progress-bar"><div className="progress-fill" style={{ width: pct + '%' }} /></div>
            </div>
          </div>

          <div className="messages">
            {messages.map(m => (
              <div key={m.id} className={`msg ${m.role}`}>
                <div className={`msg-avatar ${m.role}`}>{m.role === 'ai' ? '🎙' : '👤'}</div>
                <div>
                  <div className={`msg-bubble ${m.role}`}><Formatted text={m.text} /></div>
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
            {codeMode ? (
              <div className="code-input">
                <select className="code-language" aria-label="Language" value={language} onChange={e => setLanguage(e.target.value)} disabled={sending}>
                  {CODE_LANGUAGES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
                <Suspense fallback={<div className="code-loading">Loading editor...</div>}>
                  <CodeEditor value={code} onChange={setCode} language={language} onSubmit={handleSend} disabled={sending} />
                </Suspense>
              </div>
            ) : (
              <textarea
                ref={inputRef}
                className="answer-input"
                placeholder="Type your answer here... (Ctrl/⌘ + Enter to submit)"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSend() }}
                disabled={sending}
              />
            )}
            <div className="input-actions">
              <button
                className={`input-tool ${codeMode ? 'on' : ''}`}
                onClick={() => setCodeMode(m => !m)}
                aria-pressed={codeMode}
                disabled={sending}
                title="Answer in a code editor"
              >{'</>'} Code</button>
              {dictation.supported && !codeMode && (
                <button
                  className={`input-tool ${dictation.listening ? 'on' : ''}`}
                  onClick={dictation.toggle}
                  aria-pressed={dictation.listening}
                  disabled={sending}
                  title="Dictate your answer"
                >🎤 {dictation.listening ? 'Stop' : 'Speak'}</button>
              )}
              <button className="btn btn-primary" onClick={handleSend} disabled={!canSend} style={{ padding: '12px 18px' }}>
                Send ↵
              </button>
            </div>
          </div>
          {dictation.error && <div className="input-error">{dictation.error}</div>}
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
                const ans = answers[i]
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
            <button className="hint-btn" onClick={handleHint} disabled={sending || session.hintUsed || !!session.followup}>
              💡 {session.hintUsed ? 'Hint used' : 'Request a hint (−5 points)'}
            </button>
            {hint && <div className="hint-box">💡 {hint}</div>}
          </div>

          {/* Actions */}
          <div className="sidebar-section">
            <div className="sidebar-label">Actions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {canSpeak() && (
                <button className={`option-btn ${voice ? 'selected' : ''}`} style={{ textAlign: 'left', fontSize: 11 }} onClick={toggleVoice} aria-pressed={voice}>
                  🔊 Read questions aloud: {voice ? 'On' : 'Off'}
                </button>
              )}
              <button className="option-btn" style={{ textAlign: 'left', fontSize: 11 }} onClick={handleSkip} disabled={sending}>
                ⏭ {session.followup ? 'Skip this follow-up' : 'Skip this question'}
              </button>
              <button className="option-btn" style={{ textAlign: 'left', fontSize: 11, color: 'var(--red)', borderColor: 'var(--red)' }} onClick={() => finish(session.followup ? [...answersRef.current, session.followup.entry] : answersRef.current)}>🏁 End & get feedback</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
