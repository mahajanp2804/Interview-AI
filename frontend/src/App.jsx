import { useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { useApp } from './AppContext'
import { generateFeedback, saveSession, getSession, errorMessage } from './api'
import LoadingOverlay from './LoadingOverlay'
import SetupPage    from './pages/SetupPage'
import InterviewPage from './pages/InterviewPage'
import FeedbackPage from './pages/FeedbackPage'
import HistoryPage  from './pages/HistoryPage'
import RoadmapPage  from './pages/RoadmapPage'

const TABS = [
  { path: '/',          label: '⚙ Setup' },
  { path: '/interview', label: '💬 Interview' },
  { path: '/feedback',  label: '📊 Feedback' },
  { path: '/history',   label: '📁 History' },
  { path: '/roadmap',   label: '🗺 Roadmap' },
]

function EmptyPage({ icon, children }) {
  return (
    <div className="page"><div className="page-inner empty-state">
      <div className="empty-icon">{icon}</div>
      {children}
    </div></div>
  )
}

// /feedback/:uid: the report just generated if it matches, otherwise the saved session from the backend
function SavedFeedback({ current, ...actions }) {
  const { uid } = useParams()
  const [saved, setSaved] = useState(null)
  const [error, setError] = useState(null)
  const isCurrent = current.feedback && current.uid === uid

  useEffect(() => {
    if (isCurrent) return
    setSaved(null)
    setError(null)
    getSession(uid).then(setSaved).catch(e => setError(errorMessage(e)))
  }, [uid, isCurrent])

  if (isCurrent) return <FeedbackPage feedback={current.feedback} qaPairs={current.qaPairs} {...actions} />
  if (error) return <EmptyPage icon="⚠">Couldn't load this session.<br /><span style={{ fontSize: 12, color: 'var(--text3)' }}>{error}</span></EmptyPage>
  if (!saved) return <EmptyPage icon="⏳">Loading...</EmptyPage>
  return <FeedbackPage feedback={saved.feedback_data} qaPairs={saved.qa_data ?? []} {...actions} />
}

export default function App() {
  const { state, dispatch } = useApp()
  const navigate = useNavigate()
  const [feedback, setFeedback] = useState(null)
  const [feedbackError, setFeedbackError] = useState(null)
  const [qaPairs, setQaPairs]   = useState([])
  const [histCount, setHistCount] = useState(0)

  // Generates the report for `answers`; on failure the answers are kept so it can be retried
  async function requestFeedback(answers) {
    dispatch({ type: 'SET_LOADING', value: true, msg: 'Generating your feedback report...' })
    setFeedbackError(null)
    const uid = state.session.uid

    try {
      const fb = await generateFeedback({
        session_uid: uid,
        config: state.config,
        qa_pairs: answers,
      })

      // Save to backend
      const durationMin = state.session.startTime
        ? Math.round((Date.now() - state.session.startTime) / 60000)
        : null

      const saved = await saveSession({
        session_uid: uid,
        config: state.config,
        qa_pairs: answers,
        feedback: fb,
        duration_min: durationMin,
      }).catch(() => null) // non-fatal

      setFeedback(fb)
      setHistCount(c => c + 1)
      // Give the report a URL that survives a refresh once it's saved
      if (saved) navigate(`/feedback/${uid}`, { replace: true })
    } catch (e) {
      setFeedbackError(errorMessage(e))
    }
    dispatch({ type: 'SET_LOADING', value: false })
  }

  // Called by InterviewPage when session ends
  async function handleInterviewEnd(answers) {
    dispatch({ type: 'END_SESSION' })
    setQaPairs(answers)
    setFeedback(null)
    navigate('/feedback')
    await requestFeedback(answers)
  }

  function handlePracticeAgain() {
    dispatch({ type: 'RESET_SESSION' })
    setFeedback(null)
    setFeedbackError(null)
    setQaPairs([])
    navigate('/')
  }

  const feedbackActions = {
    onPracticeAgain: handlePracticeAgain,
    onRoadmap: () => navigate('/roadmap'),
    onHistory: () => navigate('/history'),
  }

  return (
    <div className="app">
      {state.loading && <LoadingOverlay msg={state.loadingMsg} />}

      {/* Header */}
      <header className="header">
        <div className="logo-icon">🎯</div>
        <div>
          <div className="logo-text">InterviewAI</div>
          <div className="logo-sub">Simulator</div>
        </div>
        <div className="header-status">
          <div className={`status-dot ${state.statusBusy ? 'busy' : ''}`} />
          <span className="status-text">{state.statusBusy ? 'AI Thinking...' : 'Ready'}</span>
        </div>
      </header>

      {/* Nav */}
      <nav className="nav">
        {TABS.map(t => (
          <NavLink
            key={t.path}
            to={t.path}
            end={t.path === '/'}
            className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}
          >
            {t.label}
            {t.path === '/history' && histCount > 0 && <span className="nav-badge">{histCount}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Pages */}
      <Routes>
        <Route path="/" element={<SetupPage />} />
        <Route path="/interview" element={
          state.session.active && state.session.questions.length > 0
            ? <InterviewPage onEnd={handleInterviewEnd} />
            : <EmptyPage icon="💬">Go to Setup to start an interview.</EmptyPage>
        } />
        <Route path="/feedback" element={
          <FeedbackPage feedback={feedback} error={feedbackError} onRetry={() => requestFeedback(qaPairs)} qaPairs={qaPairs} {...feedbackActions} />
        } />
        <Route path="/feedback/:uid" element={
          <SavedFeedback current={{ uid: state.session.uid, feedback, qaPairs }} {...feedbackActions} />
        } />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/roadmap" element={<RoadmapPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
