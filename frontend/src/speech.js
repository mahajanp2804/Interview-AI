import { useEffect, useRef, useState } from 'react'

const Recognition = () => window.SpeechRecognition ?? window.webkitSpeechRecognition

// Dictation: calls onText with each finished phrase while listening
export function useDictation(onText) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState(null)
  const recognition = useRef(null)
  const callback = useRef(onText)
  callback.current = onText

  function start() {
    const r = new (Recognition())()
    r.continuous = true
    r.interimResults = false
    r.lang = navigator.language || 'en-US'
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) callback.current(e.results[i][0].transcript.trim())
      }
    }
    r.onerror = (e) => {
      if (e.error === 'not-allowed') setError('Microphone access is blocked for this site.')
    }
    r.onend = () => {
      recognition.current = null
      setListening(false)
    }
    recognition.current = r
    setError(null)
    r.start()
    setListening(true)
  }

  const stop = () => recognition.current?.stop()
  const toggle = () => (listening ? stop() : start())

  useEffect(() => () => recognition.current?.abort(), [])

  return { supported: !!Recognition(), listening, error, toggle, stop }
}

export const canSpeak = () => 'speechSynthesis' in window

export function speak(text) {
  if (!canSpeak()) return
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text))
}

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel()
}
