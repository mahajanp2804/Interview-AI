import { createContext, useContext, useEffect, useReducer } from 'react'

// An interview in progress is kept here so a page refresh doesn't lose it
const STORAGE_KEY = 'iai_active_session'

const initialState = {
  // Setup
  config: {
    role: null,
    level: 'Senior (5+ yrs)',
    interview_type: 'Mixed',
    difficulty: 'Medium',
    company: null,
    num_questions: 5,
  },
  // Active session
  session: {
    uid: null,
    questions: [],
    fallback: false,  // questions came from the built-in bank, not the AI
    answers: [],      // [{q, a, eval, type}]
    scores: [],
    currentQ: 0,
    active: false,
    startTime: null,
    questionStartedAt: null,
    followup: null,   // { q, entry }: follow-up being asked, and the answer it follows
    hintUsed: false,  // for the current question
  },
  // UI
  loading: false,
  loadingMsg: 'Thinking...',
  statusBusy: false,
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_CONFIG':
      return { ...state, config: { ...state.config, ...action.payload } }
    case 'START_SESSION':
      return { ...state, session: { ...initialState.session, uid: action.uid, questions: action.questions, fallback: !!action.fallback, active: true, startTime: Date.now(), questionStartedAt: Date.now() } }
    case 'PUSH_ANSWER':
      return { ...state, session: { ...state.session, answers: [...state.session.answers, action.answer], scores: [...state.session.scores, action.answer.eval?.score ?? 0], currentQ: state.session.currentQ + 1, questionStartedAt: Date.now(), followup: null, hintUsed: false } }
    case 'SET_FOLLOWUP':
      return { ...state, session: { ...state.session, followup: action.followup } }
    case 'USE_HINT':
      return { ...state, session: { ...state.session, hintUsed: true } }
    case 'END_SESSION':
      return { ...state, session: { ...state.session, active: false } }
    case 'SET_LOADING':
      return { ...state, loading: action.value, loadingMsg: action.msg ?? state.loadingMsg }
    case 'SET_STATUS_BUSY':
      return { ...state, statusBusy: action.value }
    case 'RESET_SESSION':
      return { ...state, session: initialState.session }
    default:
      return state
  }
}

function loadInitialState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (saved?.session?.active) return { ...initialState, config: saved.config, session: saved.session }
  } catch {
    // storage unavailable or corrupt: start fresh
  }
  return initialState
}

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitialState)

  useEffect(() => {
    try {
      if (state.session.active) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ config: state.config, session: state.session }))
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch {
      // storage unavailable (private mode, quota): persistence is best-effort
    }
  }, [state.config, state.session])

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>
}

export const useApp = () => useContext(AppContext)
