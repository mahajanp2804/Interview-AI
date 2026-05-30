export default function LoadingOverlay({ msg }) {
  return (
    <div className="loading-overlay">
      <div className="loading-box">
        <div className="spinner" />
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{msg}</div>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>Powered by Claude Sonnet 4</div>
      </div>
    </div>
  )
}
