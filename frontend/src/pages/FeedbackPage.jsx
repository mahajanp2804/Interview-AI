import { useState } from 'react'

const METRICS = [
  { key: 'technical',       name: 'Technical',       icon: '⚙', color: '#4f8ef7' },
  { key: 'communication',   name: 'Communication',    icon: '💬', color: '#10b981' },
  { key: 'clarity',         name: 'Clarity',          icon: '🔍', color: '#f59e0b' },
  { key: 'confidence',      name: 'Confidence',       icon: '💪', color: '#7c3aed' },
  { key: 'problem_solving', name: 'Problem Solving',  icon: '🧩', color: '#ec4899' },
]

function gradeClass(grade) {
  if (!grade) return ''
  if (grade.startsWith('A')) return 'grade-a'
  if (grade.startsWith('B')) return 'grade-b'
  if (grade.startsWith('C')) return 'grade-c'
  return 'grade-d'
}

function scoreColor(s) {
  if (s >= 80) return 'var(--accent3)'
  if (s >= 60) return 'var(--accent)'
  if (s >= 40) return 'var(--accent4)'
  return 'var(--red)'
}

function QAItem({ qa, qf, idx }) {
  const [open, setOpen] = useState(false)
  const verdict = qf?.verdict ?? 'acceptable'
  const vClass = verdict === 'strong' ? 'verdict-strong' : verdict === 'needs-work' ? 'verdict-needs-work' : 'verdict-acceptable'
  const vLabel = verdict === 'strong' ? 'Strong ✅' : verdict === 'needs-work' ? 'Needs Work ⚠' : 'Acceptable ⚡'

  return (
    <div className="qa-review">
      <div className="qa-review-header" onClick={() => setOpen(o => !o)}>
        <span className={`verdict-badge ${vClass}`}>{vLabel}</span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, padding: '0 10px' }}>
          Q{idx + 1}: {qa.q.length > 65 ? qa.q.slice(0, 65) + '...' : qa.q}
        </span>
        <span style={{ fontSize: 20, fontWeight: 700, color: scoreColor(qa.eval?.score ?? 0) }}>
          {qa.eval?.score ?? '—'}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 8 }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className="qa-review-body">
          <div className="q-text">{qa.q}</div>
          <div className="a-text">{qa.a === '[SKIPPED]' ? <em style={{ color: 'var(--accent4)' }}>⏭ Skipped</em> : qa.a}</div>
          <div className="chip-row">
            {(qa.eval?.strengths ?? []).map((s, i) => <span key={i} className="chip good">✓ {s}</span>)}
            {(qa.eval?.improvements ?? []).map((s, i) => <span key={i} className="chip improve">↗ {s}</span>)}
          </div>
          {qf?.comment && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>{qf.comment}</div>}
        </div>
      )}
    </div>
  )
}

export default function FeedbackPage({ feedback, qaPairs, onPracticeAgain, onRoadmap, onHistory }) {
  if (!feedback) {
    return (
      <div className="page">
        <div className="page-inner empty-state">
          <div className="empty-icon">📊</div>
          Complete an interview to see your feedback here.
        </div>
      </div>
    )
  }

  const { overall_score, grade, summary, recommendations, q_feedback, next_role } = feedback

  return (
    <div className="page">
      <div className="page-inner">
        {/* Hero */}
        <div className="feedback-hero">
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, color: 'var(--text3)' }}>
            Interview Complete
          </div>
          <div className="feedback-score" style={{ color: scoreColor(overall_score) }}>{overall_score}</div>
          <span className={`grade-badge ${gradeClass(grade)}`}>{grade}</span>
          <div style={{ fontSize: 13, color: 'var(--text2)', maxWidth: 560, margin: '0 auto', lineHeight: 1.7 }}>{summary}</div>
          {next_role && (
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text3)' }}>
              Readiness: <span style={{ color: 'var(--accent)' }}>{next_role}</span>
            </div>
          )}
        </div>

        {/* Metric cards */}
        <div className="metrics-grid">
          {METRICS.map(m => (
            <div key={m.key} className="metric-card">
              <div className="metric-icon">{m.icon}</div>
              <div className="metric-name">{m.name}</div>
              <div className="metric-score" style={{ color: m.color }}>{feedback[m.key] ?? '—'}</div>
              <div className="metric-bar"><div className="metric-fill" style={{ width: (feedback[m.key] ?? 0) + '%', background: m.color }} /></div>
            </div>
          ))}
        </div>

        {/* Recommendations */}
        {recommendations?.length > 0 && (
          <div className="reco-section">
            <h3>🎯 Personalised Recommendations</h3>
            {recommendations.map((r, i) => (
              <div key={i} className="reco-item" style={{ borderLeftColor: r.priority === 'high' ? 'var(--red)' : 'var(--accent4)' }}>
                <div className="reco-title" style={{ color: r.priority === 'high' ? 'var(--red)' : 'var(--accent4)' }}>
                  {r.priority === 'high' ? '🔴' : '🟡'} {r.title}
                </div>
                <div className="reco-action">{r.action}</div>
              </div>
            ))}
          </div>
        )}

        {/* Q&A review */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>📝 Question-by-Question Review</div>
          {qaPairs.map((qa, i) => (
            <QAItem key={i} qa={qa} qf={q_feedback?.[i]} idx={i} />
          ))}
        </div>

        {/* Action row */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
          <button className="btn btn-primary"     onClick={onPracticeAgain}>🔄 Practice Again</button>
          <button className="btn btn-secondary"   onClick={onRoadmap}>🗺 View Roadmap</button>
          <button className="btn btn-secondary"   onClick={onHistory}>📁 View History</button>
        </div>
      </div>
    </div>
  )
}
