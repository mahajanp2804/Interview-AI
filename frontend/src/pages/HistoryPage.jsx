import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listSessions, getStats, getProgress, deleteSession } from '../api'
import ProgressDashboard from '../ProgressDashboard'

const ROLE_ICONS = {
  'AI/ML Engineer': '🤖', 'Software Engineer': '💻', 'Data Scientist': '📊',
  'Frontend Developer': '🎨', 'Backend Developer': '⚙', 'Full Stack Developer': '🔥',
  'DevOps Engineer': '🚀', 'Product Manager': '📋',
}
const ICON_COLORS = ['#4f8ef7','#10b981','#f59e0b','#7c3aed','#ec4899']
const BG_COLORS   = ['rgba(79,142,247,.15)','rgba(16,185,129,.15)','rgba(245,158,11,.15)','rgba(124,58,237,.15)','rgba(236,72,153,.15)']

function scoreColor(s) {
  if (!s) return 'var(--text3)'
  if (s >= 80) return 'var(--accent3)'
  if (s >= 60) return 'var(--accent)'
  if (s >= 40) return 'var(--accent4)'
  return 'var(--red)'
}

export default function HistoryPage() {
  const [sessions, setSessions] = useState([])
  const [stats, setStats]       = useState(null)
  const [progress, setProgress] = useState(null)
  const [loading, setLoading]   = useState(true)
  const navigate = useNavigate()

  async function load() {
    setLoading(true)
    try {
      const [s, st, p] = await Promise.all([listSessions(), getStats(), getProgress()])
      setSessions(s)
      setStats(st)
      setProgress(p)
    } catch {
      // backend might be slow — ignore
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleDelete(e, uid) {
    e.stopPropagation()
    if (!window.confirm('Delete this session?')) return
    await deleteSession(uid)
    load()
  }

  return (
    <div className="page">
      <div className="page-inner">
        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card"><div className="stat-number" style={{ color: 'var(--accent)' }}>{stats?.total_sessions ?? 0}</div><div className="stat-label">Sessions</div></div>
          <div className="stat-card"><div className="stat-number" style={{ color: 'var(--accent3)' }}>{stats?.avg_score ?? '—'}</div><div className="stat-label">Avg Score</div></div>
          <div className="stat-card"><div className="stat-number" style={{ color: 'var(--accent4)' }}>{stats?.best_score ?? '—'}</div><div className="stat-label">Best Score</div></div>
          <div className="stat-card"><div className="stat-number" style={{ color: 'var(--accent2)' }}>{stats?.streak ?? 0}</div><div className="stat-label">Streak 🔥</div></div>
        </div>

        <ProgressDashboard progress={progress} />

        {/* List */}
        {loading ? (
          <div className="empty-state"><div className="empty-icon">⏳</div>Loading...</div>
        ) : sessions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            No sessions yet.<br />Complete your first interview to see history here.
          </div>
        ) : (
          <div className="session-list">
            {sessions.map((s, i) => (
              <div key={s.session_uid} className="session-card" style={{ cursor: 'pointer' }} onClick={() => navigate(`/feedback/${s.session_uid}`)}>
                <div className="session-icon" style={{ background: BG_COLORS[i % 5], color: ICON_COLORS[i % 5] }}>
                  {ROLE_ICONS[s.role] ?? '💼'}
                </div>
                <div className="session-meta">
                  <Link className="session-title" to={`/feedback/${s.session_uid}`} style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}>{s.role}</Link>
                  <div className="session-detail">
                    {new Date(s.created_at).toLocaleDateString()} · {s.level} · {s.difficulty} · {s.interview_type} · {s.answers_count} answered
                    {s.duration_min ? ` · ${s.duration_min} min` : ''}
                    {s.company ? ` · ${s.company}` : ''}
                  </div>
                </div>
                <div className="session-score">
                  <div className="session-score-num" style={{ color: scoreColor(s.overall_score) }}>
                    {s.overall_score ?? '—'}
                  </div>
                  <div className="session-score-label">{s.grade ?? 'SCORE'}</div>
                </div>
                <button
                  onClick={e => handleDelete(e, s.session_uid)}
                  style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 14, padding: '4px 6px', marginLeft: 4, cursor: 'pointer' }}
                  title="Delete"
                  aria-label="Delete session"
                >✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
