import { createContext, useContext, useReducer } from 'react'

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
  },
  // UI
  loading: false,
  loadingMsg: 'Thinking...',
  tab: 'setup',
  statusBusy: false,
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_CONFIG':
      return { ...state, config: { ...state.config, ...action.payload } }
    case 'START_SESSION':
      return { ...state, session: { ...initialState.session, uid: action.uid, questions: action.questions, fallback: !!action.fallback, active: true, startTime: Date.now() } }
    case 'PUSH_ANSWER':
      return { ...state, session: { ...state.session, answers: [...state.session.answers, action.answer], scores: [...state.session.scores, action.answer.eval?.score ?? 0], currentQ: state.session.currentQ + 1 } }
    case 'END_SESSION':
      return { ...state, session: { ...state.session, active: false } }
    case 'SET_LOADING':
      return { ...state, loading: action.value, loadingMsg: action.msg ?? state.loadingMsg }
    case 'SET_TAB':
      return { ...state, tab: action.tab }
    case 'SET_STATUS_BUSY':
      return { ...state, statusBusy: action.value }
    case 'RESET_SESSION':
      return { ...state, session: initialState.session }
    default:
      return state
  }
}

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>
}

export const useApp = () => useContext(AppContext)
