import { Fragment } from 'react'

function Inline({ text }) {
  return text.split('\n').map((line, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {line.split(/\*\*(.+?)\*\*/g).map((part, j) => (j % 2 ? <strong key={j}>{part}</strong> : part))}
    </Fragment>
  ))
}

// Very light markdown: **bold**, line breaks and ``` code fences, rendered as elements (never raw HTML)
export default function Formatted({ text }) {
  // split() with two capture groups gives [text, lang, code, text, lang, code, ...]
  return text.split(/```(\w*)\n([\s\S]*?)\n?```/g).map((part, i) => {
    if (i % 3 === 1) return null
    if (i % 3 === 2) return <pre key={i} className="code-block"><code>{part}</code></pre>
    return <Inline key={i} text={part} />
  })
}
