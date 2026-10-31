import { useState } from 'react'
import { useApp } from '../AppContext'
import { uploadResume, errorMessage } from '../api'
import { useStartInterview } from '../useStartInterview'

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
const TYPES  = ['Technical', 'Behavioral', 'Mixed', 'System Design', 'Coding']
const COUNTS = [3, 5, 8, 10]
const COMPANIES = ['FAANG', 'Startup', 'Consulting', 'Custom']

export default function SetupPage() {
  const { state, dispatch } = useApp()
  const { config } = state
  const startInterview = useStartInterview()
  const [customCompany, setCustomCompany] = useState('')
  const [resumeText, setResumeText] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [resumeNote, setResumeNote] = useState(null)   // { text, error }
  const [uploading, setUploading] = useState(false)

  const set = (field, val) => dispatch({ type: 'SET_CONFIG', payload: { [field]: val } })

  const canStart = !!config.role

  function handleStart() {
    if (!canStart) return
    startInterview({ ...config, company: customCompany || config.company }, {
      resume_text: resumeText.trim() || null,
      job_description: jobDescription.trim() || null,
    })
  }

  async function handleResumeFile(e) {
    const file = e.target.files[0]
    e.target.value = ''   // so picking the same file again still fires
    if (!file) return
    setUploading(true)
    setResumeNote(null)
    try {
      const { text, truncated } = await uploadResume(file)
      setResumeText(text)
      setResumeNote({ text: `Read ${file.name}${truncated ? ' (long resume, so only the first part was kept)' : ''}. Edit below if anything looks wrong.` })
    } catch (err) {
      setResumeNote({ text: errorMessage(err), error: true })
    }
    setUploading(false)
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

      <div className="tailor-section">
        <div className="card">
          <div className="card-title">Tailor to you (optional)</div>
          <div className="tailor-grid">
            <div>
              <div className="tailor-label">
                <label htmlFor="resume-text">Your resume</label>
                <label className="input-tool tailor-upload">
                  {uploading ? 'Reading...' : '📄 Upload PDF'}
                  <input type="file" accept="application/pdf,.pdf" onChange={handleResumeFile} disabled={uploading} aria-label="Upload resume PDF" hidden />
                </label>
              </div>
              <textarea
                id="resume-text"
                className="answer-input tailor-text"
                placeholder="Upload a PDF, or paste your resume here..."
                maxLength={20000}
                value={resumeText}
                onChange={e => setResumeText(e.target.value)}
              />
              {resumeNote && <div className={`tailor-note ${resumeNote.error ? 'error' : ''}`}>{resumeNote.text}</div>}
            </div>
            <div>
              <div className="tailor-label"><label htmlFor="job-description">Job description</label></div>
              <textarea
                id="job-description"
                className="answer-input tailor-text"
                placeholder="Paste the job posting here..."
                maxLength={10000}
                value={jobDescription}
                onChange={e => setJobDescription(e.target.value)}
              />
            </div>
          </div>
          <div className="tailor-note">Used to write your questions: this text is sent to Google Gemini and isn't saved.</div>
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
