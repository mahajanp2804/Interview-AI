import { useState } from 'react'
import { useApp } from './AppContext'
import { generateFeedback, saveSession } from './api'
import LoadingOverlay from './LoadingOverlay'
import SetupPage    from './pages/SetupPage'
import InterviewPage from './pages/InterviewPage'
import FeedbackPage from './pages/FeedbackPage'
import HistoryPage  from './pages/HistoryPage'
import RoadmapPage  from './pages/RoadmapPage'

const TABS = [
  { id: 'setup',     label: '⚙ Setup' },
  { id: 'interview', label: '💬 Interview' },
  { id: 'feedback',  label: '📊 Feedback' },
  { id: 'history',   label: '📁 History' },
  { id: 'roadmap',   label: '🗺 Roadmap' },
]

export default function App() {
  const { state, dispatch } = useApp()
  const [tab, setTab]         = useState('setup')
  const [feedback, setFeedback] = useState(null)
  const [qaPairs, setQaPairs]   = useState([])
  const [histCount, setHistCount] = useState(0)

  function goTab(t) {
    setTab(t)
  }

  // Called by SetupPage once questions are loaded
  function handleStartInterview() {
    setTab('interview')
  }

  // Called by InterviewPage when session ends
  async function handleInterviewEnd(answers) {
    dispatch({ type: 'SET_LOADING', value: true, msg: 'Generating your feedback report...' })
    dispatch({ type: 'END_SESSION' })

    try {
      const fb = await generateFeedback({
        session_uid: state.session.uid,
        config: state.config,
        qa_pairs: answers,
      })

      // Save to backend
      const durationMin = state.session.startTime
        ? Math.round((Date.now() - state.session.startTime) / 60000)
        : null

      await saveSession({
        session_uid: state.session.uid,
        config: state.config,
        qa_pairs: answers,
        feedback: fb,
        duration_min: durationMin,
      }).catch(() => {}) // non-fatal

      setFeedback(fb)
      setQaPairs(answers)
      setHistCount(c => c + 1)
      dispatch({ type: 'SET_LOADING', value: false })
      setTab('feedback')
    } catch (e) {
      dispatch({ type: 'SET_LOADING', value: false })
      setTab('feedback')
    }
  }

  function handlePracticeAgain() {
    dispatch({ type: 'RESET_SESSION' })
    setFeedback(null)
    setQaPairs([])
    setTab('setup')
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
          <button
            key={t.id}
            className={`nav-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => goTab(t.id)}
          >
            {t.label}
            {t.id === 'history' && histCount > 0 && <span className="nav-badge">{histCount}</span>}
          </button>
        ))}
      </nav>

      {/* Pages */}
      {tab === 'setup'     && <SetupPage onStartInterview={handleStartInterview} />}
      {tab === 'interview' && state.session.questions.length > 0
        ? <InterviewPage onEnd={handleInterviewEnd} />
        : tab === 'interview' && (
            <div className="page"><div className="page-inner empty-state">
              <div className="empty-icon">💬</div>
              Go to Setup to start an interview.
            </div></div>
          )
      }
      {tab === 'feedback'  && <FeedbackPage feedback={feedback} qaPairs={qaPairs} onPracticeAgain={handlePracticeAgain} onRoadmap={() => goTab('roadmap')} onHistory={() => goTab('history')} />}
      {tab === 'history'   && <HistoryPage />}
      {tab === 'roadmap'   && <RoadmapPage />}
    </div>
  )
}
