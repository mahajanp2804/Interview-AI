import { useEffect, useState } from 'react'
import { ROADMAP, METRIC_PHASE, autoProgress, taskText } from '../roadmap'
import { listSessions, getProgress } from '../api'
import { DrillButton, METRIC_LABELS } from '../ProgressDashboard'

const STORAGE_KEY = 'iai_roadmap'

function loadState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') } catch { return {} }
}

export default function RoadmapPage() {
  const [checked, setChecked] = useState(loadState)
  const [open, setOpen]       = useState({})
  const [sessions, setSessions] = useState([])
  const [progress, setProgress] = useState(null)

  useEffect(() => {
    Promise.all([listSessions(), getProgress()])
      .then(([s, p]) => { setSessions(s); setProgress(p) })
      .catch(() => {})   // the roadmap still works as a plain checklist
  }, [])

  const isDone = (pi, ti) => {
    const auto = autoProgress(ROADMAP[pi].tasks[ti], sessions)
    return auto ? auto.done >= auto.count : !!checked[`${pi}-${ti}`]
  }

  const totalTasks = ROADMAP.reduce((s, p) => s + p.tasks.length, 0)
  const doneTasks  = ROADMAP.reduce((s, p, pi) => s + p.tasks.filter((_, ti) => isDone(pi, ti)).length, 0)

  // The weakest recent skill points at the phase to work on next
  const [weakestMetric, weakestScore] = Object.entries(progress?.metrics ?? {}).sort((a, b) => a[1] - b[1])[0] ?? []
  const recommendedPhase = weakestMetric ? METRIC_PHASE[weakestMetric] : null
  const isOpen = (pi) => open[pi] ?? pi === recommendedPhase

  function toggleTask(pi, ti) {
    const key = `${pi}-${ti}`
    const next = { ...checked, [key]: !checked[key] }
    setChecked(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  function togglePhase(pi) {
    setOpen(o => ({ ...o, [pi]: !isOpen(pi) }))
  }

  return (
    <div className="page">
      <div className="page-inner">
        {/* Intro */}
        <div className="roadmap-intro">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <span style={{ fontSize: 24 }}>🗺</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Interview Mastery Roadmap</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                Structured path from beginner to confident interviewer — check tasks as you complete them
              </div>
            </div>
          </div>
          <div className="roadmap-stats">
            <div className="rm-stat">
              <div className="rm-stat-num" style={{ color: 'var(--accent)' }}>{doneTasks}</div>
              <div className="rm-stat-label">Completed</div>
            </div>
            <div className="rm-stat">
              <div className="rm-stat-num" style={{ color: 'var(--text2)' }}>{totalTasks}</div>
              <div className="rm-stat-label">Total Tasks</div>
            </div>
            <div className="rm-bar-wrap">
              <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1 }}>Overall Progress</div>
              <div className="rm-bar-track">
                <div className="rm-bar-fill" style={{ width: Math.round((doneTasks / totalTasks) * 100) + '%' }} />
              </div>
            </div>
          </div>
        </div>

        {recommendedPhase != null && (
          <div className="focus-panel">
            <div className="chart-title">Your focus</div>
            <div className="focus-text">
              Your weakest skill lately is <strong>{METRIC_LABELS[weakestMetric] ?? weakestMetric}</strong> ({weakestScore}),
              so <strong>{ROADMAP[recommendedPhase].title}</strong> is the best phase to work on next.
            </div>
            {progress.weak_categories.length > 0 && (
              <div className="chip-row" style={{ marginBottom: 12 }}>
                {progress.weak_categories.slice(0, 3).map(c => <span key={c.category} className="chip improve">{c.category} · {c.avg_score}</span>)}
              </div>
            )}
            <DrillButton progress={progress} />
          </div>
        )}

        {/* Phases */}
        {ROADMAP.map((phase, pi) => {
          const total = phase.tasks.length
          const done  = phase.tasks.filter((_, ti) => isDone(pi, ti)).length
          const phasePct = Math.round((done / total) * 100)
          const expanded = isOpen(pi)

          return (
            <div key={pi} className="phase-card">
              <div className="phase-progress">
                <div className="phase-progress-fill" style={{ width: phasePct + '%', background: phase.color }} />
              </div>
              <div className="phase-header" onClick={() => togglePhase(pi)}>
                <div className="phase-num" style={{ background: phase.bg, color: phase.color }}>{pi + 1}</div>
                <div className="phase-title">
                  {phase.title}
                  {pi === recommendedPhase && <span className="phase-badge">Recommended next</span>}
                </div>
                <div className="phase-count">{done}/{total}</div>
                <div className="phase-duration">{phase.duration}</div>
                <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 8 }}>{expanded ? '▲' : '▼'}</span>
              </div>
              {expanded && (
                <div className="phase-body">
                  <div className="task-list">
                    {phase.tasks.map((task, ti) => {
                      const taskDone = isDone(pi, ti)
                      const auto = autoProgress(task, sessions)
                      return (
                        <div
                          key={ti}
                          className={`task-item ${taskDone ? 'done' : ''} ${auto ? 'auto' : ''}`}
                          onClick={auto ? undefined : () => toggleTask(pi, ti)}
                          title={auto ? 'Ticked automatically from your sessions' : undefined}
                        >
                          <div className="task-check">{taskDone ? '✓' : ''}</div>
                          <div className="task-text">{taskText(task)}</div>
                          {auto && <div className="task-auto">{auto.done}/{auto.count} sessions</div>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
