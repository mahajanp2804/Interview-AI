import { useState } from 'react'
import { ROADMAP } from '../roadmap'

const STORAGE_KEY = 'iai_roadmap'

function loadState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') } catch { return {} }
}

export default function RoadmapPage() {
  const [checked, setChecked] = useState(loadState)
  const [open, setOpen]       = useState({})

  const totalTasks = ROADMAP.reduce((s, p) => s + p.tasks.length, 0)
  const doneTasks  = Object.values(checked).filter(Boolean).length

  function toggleTask(pi, ti) {
    const key = `${pi}-${ti}`
    const next = { ...checked, [key]: !checked[key] }
    setChecked(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  function togglePhase(pi) {
    setOpen(o => ({ ...o, [pi]: !o[pi] }))
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

        {/* Phases */}
        {ROADMAP.map((phase, pi) => {
          const total = phase.tasks.length
          const done  = phase.tasks.filter((_, ti) => checked[`${pi}-${ti}`]).length
          const phasePct = Math.round((done / total) * 100)
          const isOpen = !!open[pi]

          return (
            <div key={pi} className="phase-card">
              <div className="phase-progress">
                <div className="phase-progress-fill" style={{ width: phasePct + '%', background: phase.color }} />
              </div>
              <div className="phase-header" onClick={() => togglePhase(pi)}>
                <div className="phase-num" style={{ background: phase.bg, color: phase.color }}>{pi + 1}</div>
                <div className="phase-title">{phase.title}</div>
                <div className="phase-count">{done}/{total}</div>
                <div className="phase-duration">{phase.duration}</div>
                <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 8 }}>{isOpen ? '▲' : '▼'}</span>
              </div>
              {isOpen && (
                <div className="phase-body">
                  <div className="task-list">
                    {phase.tasks.map((task, ti) => {
                      const isDone = !!checked[`${pi}-${ti}`]
                      return (
                        <div
                          key={ti}
                          className={`task-item ${isDone ? 'done' : ''}`}
                          onClick={() => toggleTask(pi, ti)}
                        >
                          <div className="task-check">{isDone ? '✓' : ''}</div>
                          <div className="task-text">{task}</div>
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
