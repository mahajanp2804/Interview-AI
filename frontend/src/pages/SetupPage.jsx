import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useApp } from '../AppContext'
import { generateQuestions, errorMessage } from '../api'

const ROLES = [
  ['🤖', 'AI/ML Engineer'],
  ['💻', 'Software Engineer'],
  ['📊', 'Data Scientist'],
  ['🎨', 'Frontend Developer'],
  ['⚙', 'Backend Developer'],
  ['🔥', 'Full Stack Developer'],
  ['🚀', 'DevOps Engineer'],
  ['📋', 'Product Manager'],
]
const LEVELS = ['Intern/Fresher', 'Junior (1-2 yrs)', 'Mid-level (3-5 yrs)', 'Senior (5+ yrs)']
const TYPES  = ['Technical', 'Behavioral', 'Mixed', 'System Design']
const COUNTS = [3, 5, 8, 10]
const COMPANIES = ['FAANG', 'Startup', 'Consulting', 'Custom']

export default function SetupPage({ onStartInterview }) {
  const { state, dispatch } = useApp()
  const { config } = state
  const [customCompany, setCustomCompany] = useState('')

  const set = (field, val) => dispatch({ type: 'SET_CONFIG', payload: { [field]: val } })

  const canStart = !!config.role

  async function handleStart() {
    if (!canStart) return
    const finalCompany = customCompany || config.company
    dispatch({ type: 'SET_CONFIG', payload: { company: finalCompany } })
    dispatch({ type: 'SET_LOADING', value: true, msg: 'Generating your interview questions...' })
    dispatch({ type: 'SET_STATUS_BUSY', value: true })

    try {
      const { questions, fallback } = await generateQuestions({ ...config, company: finalCompany })
      const uid = uuidv4()
      dispatch({ type: 'START_SESSION', uid, questions, fallback })
      dispatch({ type: 'SET_LOADING', value: false })
      dispatch({ type: 'SET_STATUS_BUSY', value: false })
      onStartInterview()
    } catch (e) {
      dispatch({ type: 'SET_LOADING', value: false })
      dispatch({ type: 'SET_STATUS_BUSY', value: false })
      alert(`Couldn't start the interview: ${errorMessage(e)}`)
    }
  }

  return (
    <div className="page">
      <div className="setup-hero">
        <div className="setup-title">Your <span>AI Interviewer</span> is Ready</div>
        <div className="setup-subtitle">
          Configure your session — technical, behavioral, or mixed interviews<br />
          tailored to your role, level, and target company style
        </div>
      </div>

      <div className="setup-grid">
        {/* Role */}
        <div className="card">
          <div className="card-title">Role / Domain</div>
          <div className="option-grid">
            {ROLES.map(([icon, role]) => (
              <button
                key={role}
                className={`option-btn ${config.role === role ? 'selected' : ''}`}
                onClick={() => set('role', role)}
              >{icon} {role}</button>
            ))}
          </div>
        </div>

        {/* Level + Type */}
        <div className="card">
          <div className="card-title">Experience Level</div>
          <div className="option-grid">
            {LEVELS.map(l => (
              <button
                key={l}
                className={`option-btn ${config.level === l ? 'selected' : ''}`}
                onClick={() => set('level', l)}
              >{l}</button>
            ))}
          </div>
          <div className="divider" />
          <div className="card-title">Interview Type</div>
          <div className="option-grid">
            {TYPES.map(t => (
              <button
                key={t}
                className={`option-btn ${config.interview_type === t ? 'selected' : ''}`}
                onClick={() => set('interview_type', t)}
              >{t}</button>
            ))}
          </div>
        </div>

        {/* Difficulty + Company + Count */}
        <div className="card">
          <div className="card-title">Difficulty</div>
          <div className="diff-bar">
            {['Easy','Medium','Hard'].map(d => (
              <button
                key={d}
                className={`diff-btn ${d.toLowerCase().slice(0,4)} ${config.difficulty === d ? 'sel' : ''}`}
                onClick={() => set('difficulty', d)}
              >{d}</button>
            ))}
          </div>

          <div className="divider" />
          <div className="card-title">Company Style (optional)</div>
          <div className="option-grid">
            {COMPANIES.map(c => (
              <button
                key={c}
                className={`option-btn ${config.company === c ? 'selected' : ''}`}
                onClick={() => set('company', c)}
              >{c}</button>
            ))}
          </div>
          <input
            className="config-input"
            placeholder="Or type a specific company..."
            value={customCompany}
            onChange={e => setCustomCompany(e.target.value)}
          />

          <div className="divider" />
          <div className="card-title">Number of Questions</div>
          <div className="option-grid">
            {COUNTS.map(n => (
              <button
                key={n}
                className={`option-btn ${config.num_questions === n ? 'selected' : ''}`}
                onClick={() => set('num_questions', n)}
              >{n} {n === 3 ? 'Quick' : n === 5 ? 'Standard' : n === 8 ? 'Full Round' : 'Intensive'}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="start-section">
        <button className="btn btn-primary" onClick={handleStart} disabled={!canStart}>
          Start Interview →
        </button>
        <div className="config-summary">
          {canStart
            ? <><span className="tag tag-role">{config.role}</span> <span className="tag tag-level">{config.level}</span> <span className="tag tag-diff">{config.difficulty}</span> · {config.num_questions} questions · {config.interview_type}</>
            : 'Select a role to begin'}
        </div>
      </div>
    </div>
  )
}
