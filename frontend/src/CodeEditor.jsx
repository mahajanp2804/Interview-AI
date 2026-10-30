import { useMemo, useRef } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { Prec } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { python } from '@codemirror/lang-python'
import { javascript } from '@codemirror/lang-javascript'
import { java } from '@codemirror/lang-java'
import { cpp } from '@codemirror/lang-cpp'

const LANGUAGES = { python, javascript, java, cpp }

export default function CodeEditor({ value, onChange, language, onSubmit, disabled }) {
  const submit = useRef(onSubmit)
  submit.current = onSubmit

  const extensions = useMemo(() => [
    LANGUAGES[language](),
    Prec.highest(keymap.of([{ key: 'Mod-Enter', run: () => { submit.current(); return true } }])),
  ], [language])

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      theme="dark"
      editable={!disabled}
      minHeight="140px"
      maxHeight="280px"
      placeholder="Write your solution here..."
      aria-label="Code answer"
    />
  )
}
