import { useNavigate } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'
import { useApp } from './AppContext'
import { generateQuestions, errorMessage } from './api'

// Generates questions for `config` and opens the interview.
// `extras` carries one-off context (resume, job description, focus areas) that isn't kept in state.
export function useStartInterview() {
  const { dispatch } = useApp()
  const navigate = useNavigate()

  return async function startInterview(config, extras = {}) {
    dispatch({ type: 'SET_CONFIG', payload: config })
    dispatch({ type: 'SET_LOADING', value: true, msg: 'Generating your interview questions...' })
    dispatch({ type: 'SET_STATUS_BUSY', value: true })

    try {
      const { questions, fallback } = await generateQuestions(config, extras)
      dispatch({ type: 'START_SESSION', uid: uuidv4(), questions, fallback })
      navigate('/interview')
    } catch (e) {
      alert(`Couldn't start the interview: ${errorMessage(e)}`)
    }
    dispatch({ type: 'SET_LOADING', value: false })
    dispatch({ type: 'SET_STATUS_BUSY', value: false })
  }
}
