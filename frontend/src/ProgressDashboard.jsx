import { useEffect, useRef, useState } from 'react'
import { useStartInterview } from './useStartInterview'

export const METRIC_LABELS = {
  technical: 'Technical', communication: 'Communication', clarity: 'Clarity',
  confidence: 'Confidence', problem_solving: 'Problem Solving',
}

const HEIGHT = 190
const PAD = { top: 16, right: 34, bottom: 26, left: 30 }

const shortDate = (iso) => new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' })

function TrendChart({ trend }) {
  const wrap = useRef(null)
  const [width, setWidth] = useState(600)
  const [active, setActive] = useState(null)

  useEffect(() => {
    if (!window.ResizeObserver) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(wrap.current)
    return () => observer.disconnect()
  }, [])

  const plotW = Math.max(width - PAD.left - PAD.right, 1)
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const last = trend.length - 1
  const x = (i) => (last === 0 ? PAD.left + plotW / 2 : PAD.left + (i * plotW) / last)
  const y = (score) => PAD.top + ((100 - score) * plotH) / 100

  function handlePointer(e) {
    const left = e.currentTarget.getBoundingClientRect().left
    const i = last === 0 ? 0 : Math.round(((e.clientX - left - PAD.left) / plotW) * last)
    setActive(Math.min(last, Math.max(0, i)))
  }

  function handleKey(e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const step = e.key === 'ArrowRight' ? 1 : -1
    setActive(i => Math.min(last, Math.max(0, (i ?? (step > 0 ? -1 : last + 1)) + step)))
  }

  const point = active == null ? null : trend[active]
  const latest = trend[last]

  return (
    <div className="trend-wrap" ref={wrap}>
      <svg
        width={width}
        height={HEIGHT}
        role="img"
        tabIndex={0}
        aria-label={`Overall score over ${trend.length} sessions, from ${trend[0].score} to ${latest.score}. Use left and right arrow keys to read each session.`}
        onPointerMove={handlePointer}
        onPointerLeave={() => setActive(null)}
        onFocus={() => setActive(last)}
        onBlur={() => setActive(null)}
        onKeyDown={handleKey}
      >
        {[0, 50, 100].map(tick => (
          <g key={tick}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} className="chart-grid" />
            <text x={PAD.left - 8} y={y(tick) + 3} textAnchor="end" className="chart-axis">{tick}</text>
          </g>
        ))}
        <text x={PAD.left} y={HEIGHT - 6} className="chart-axis">{shortDate(trend[0].date)}</text>
        {last > 0 && <text x={width - PAD.right} y={HEIGHT - 6} textAnchor="end" className="chart-axis">{shortDate(latest.date)}</text>}

        {point && <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={PAD.top + plotH} className="chart-crosshair" />}
        <polyline points={trend.map((p, i) => `${x(i)},${y(p.score)}`).join(' ')} className="chart-line" />
        {trend.map((p, i) => (
          <circle key={p.session_uid} cx={x(i)} cy={y(p.score)} r={i === active ? 6 : 4} className="chart-dot" />
        ))}
        <text x={x(last) + 9} y={y(latest.score) + 4} className="chart-value">{latest.score}</text>
      </svg>
      {point && (
        <div
          className="chart-tooltip"
          role="status"
          style={{ left: Math.min(x(active), width - 90), top: Math.max(y(point.score) - 62, 0) }}
        >
          <strong>{point.score}</strong>
          <span>{shortDate(point.date)} · {point.role}</span>
        </div>
      )}
    </div>
  )
}

function BarList({ items }) {
  return (
    <div className="bar-list">
      {items.map(item => (
        <div key={item.label} className="bar-row" title={`${item.label}: ${item.value}`}>
          <span className="bar-label">{item.label}</span>
          <span className="bar-track"><span className="bar-fill" style={{ width: `${item.value}%` }} /></span>
          <span className="bar-value">{item.value}</span>
        </div>
      ))}
    </div>
  )
}

// Starts a short interview on the weakest topics, using the settings of the latest session
export function DrillButton({ progress, className = 'btn btn-primary' }) {
  const startInterview = useStartInterview()
  const topics = progress.weak_categories.slice(0, 3).map(c => c.category)
  if (!topics.length || !progress.last_config) return null

  return (
    <button
      className={className}
      onClick={() => startInterview(
        { ...progress.last_config, interview_type: 'Mixed', company: null, num_questions: 5 },
        { focus_areas: topics },
      )}
    >
      🎯 Practice my {topics.length === 1 ? 'weakest topic' : `${topics.length} weakest topics`}
    </button>
  )
}

export default function ProgressDashboard({ progress }) {
  if (!progress?.trend.length) return null

  const skills = Object.entries(progress.metrics)
    .map(([key, value]) => ({ label: METRIC_LABELS[key] ?? key, value }))
    .sort((a, b) => a.value - b.value)
  const topics = progress.weak_categories.map(c => ({ label: c.category, value: c.avg_score }))

  return (
    <div className="progress-dashboard">
      <div className="chart-card">
        <div className="chart-title">Overall score by session</div>
        <TrendChart trend={progress.trend} />
      </div>
      <div className="progress-columns">
        {skills.length > 0 && (
          <div className="chart-card">
            <div className="chart-title">Skills, last 10 sessions</div>
            <BarList items={skills} />
          </div>
        )}
        {topics.length > 0 && (
          <div className="chart-card">
            <div className="chart-title">Weakest topics</div>
            <BarList items={topics} />
            <div style={{ marginTop: 14 }}><DrillButton progress={progress} /></div>
          </div>
        )}
      </div>
    </div>
  )
}
