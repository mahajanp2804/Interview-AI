import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AppProvider } from './AppContext'
import App from './App'
import * as api from './api'

vi.mock('./CodeEditor', () => ({
  default: ({ value, onChange }) => <textarea aria-label="Code answer" value={value} onChange={e => onChange(e.target.value)} />,
}))

vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,   // keep errorMessage
    generateQuestions: vi.fn(),
    evaluateAnswer: vi.fn(),
    generateFeedback: vi.fn(),
    saveSession: vi.fn(),
    getHint: vi.fn(),
    getSession: vi.fn(),
    listSessions: vi.fn(),
    getStats: vi.fn(),
    deleteSession: vi.fn(),
  }
})

const QUESTIONS = ['First question?', 'Second question?', 'Third question?'].map(q => (
  { q, type: 'technical', hint: 'h', category: 'c', followup: 'f' }
))

const evalFor = (question, extra = {}) => ({
  score: 70, technical: 70, communication: 70, clarity: 70, confidence: 70, problem_solving: 70,
  feedback: `Feedback for ${question}`, strengths: ['s'], improvements: ['i'], followup_comment: 'Next one.',
  followup_question: `Why ${question}`, model_answer: 'A strong answer covers X.', hint_penalty: 0,
  ...extra,
})

const FEEDBACK = {
  overall_score: 74, grade: 'B+', summary: 'Solid session.', technical: 70, communication: 70,
  clarity: 70, confidence: 70, problem_solving: 70, top_strengths: ['a'], weak_areas: ['b'],
  recommendations: [{ title: 'Go deeper', action: 'Practice more', priority: 'high' }],
  q_feedback: [{ idx: 0, verdict: 'strong', comment: 'Great first answer' },
               { idx: 2, verdict: 'needs-work', comment: 'Thin third answer' }],
  next_role: 'Mid-level',
}

const WAIT = { timeout: 4000 }
const chat = () => document.querySelector('.messages')?.textContent ?? ''
const count = (text, needle) => text.split(needle).length - 1

function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppProvider><App /></AppProvider>
    </MemoryRouter>
  )
}

async function startInterview(user, type) {
  const view = renderApp()
  await user.click(screen.getByRole('button', { name: /Software Engineer/ }))
  if (type) await user.click(screen.getByRole('button', { name: type }))
  await user.click(screen.getByRole('button', { name: /3 Quick/ }))
  await user.click(screen.getByRole('button', { name: /Start Interview/ }))
  await waitFor(() => expect(chat()).toContain('First question?'), WAIT)
  return view
}

async function answer(user, text) {
  const box = screen.getByPlaceholderText(/Type your answer/)
  await user.clear(box)
  await user.type(box, text)
  await user.click(screen.getByRole('button', { name: /Send/ }))
}

beforeEach(() => {
  vi.resetAllMocks()
  api.generateQuestions.mockResolvedValue({ questions: QUESTIONS, fallback: false })
  api.evaluateAnswer.mockImplementation(({ question }) => Promise.resolve(evalFor(question)))
  api.generateFeedback.mockResolvedValue(FEEDBACK)
  api.saveSession.mockResolvedValue({ ok: true })
})

describe('interview flow', () => {
  it('grades each answer against the question shown, skips, and ends on its own', async () => {
    const user = userEvent.setup()
    await startInterview(user)

    await answer(user, 'My answer to the first one')
    await waitFor(() => expect(chat()).toContain('Question 2 of 3'), WAIT)
    expect(api.evaluateAnswer).toHaveBeenLastCalledWith(expect.objectContaining({
      question: 'First question?', answer: 'My answer to the first one',
    }), expect.any(Function))
    expect(count(chat(), 'Question 1 of 3')).toBe(1)   // regression: Q1 used to be shown again

    await user.click(screen.getByRole('button', { name: /Skip this question/ }))
    await waitFor(() => expect(chat()).toContain('Question 3 of 3'), WAIT)

    await answer(user, 'My answer to the third one')
    expect(await screen.findByText(/Question-by-Question Review/, {}, WAIT)).toBeTruthy()

    expect(api.evaluateAnswer).toHaveBeenCalledTimes(2)
    expect(api.evaluateAnswer).toHaveBeenLastCalledWith(expect.objectContaining({ question: 'Third question?' }), expect.any(Function))

    const { qa_pairs } = api.generateFeedback.mock.calls[0][0]
    expect(qa_pairs.map(qa => qa.a)).toEqual(['My answer to the first one', '[SKIPPED]', 'My answer to the third one'])
    expect(api.saveSession).toHaveBeenCalledTimes(1)

    // Verdicts line up with questions by index, and the skipped one is labelled as such
    expect(screen.getByText('Strong ✅')).toBeTruthy()
    expect(screen.getByText('Skipped ⏭')).toBeTruthy()
    expect(screen.getByText('Needs Work ⚠')).toBeTruthy()
  }, 20000)

  it('keeps the answer and stays on the question when evaluation fails', async () => {
    const user = userEvent.setup()
    api.evaluateAnswer.mockRejectedValue({ response: { status: 503, data: { detail: 'Gemini rate limit reached.' } } })
    await startInterview(user)

    await answer(user, 'An answer that fails to grade')
    await waitFor(() => expect(chat()).toContain("I couldn't evaluate that answer"), WAIT)

    expect(chat()).toContain('Gemini rate limit reached.')
    expect(chat()).not.toContain('Question 2 of 3')
    expect(screen.getByPlaceholderText(/Type your answer/).value).toBe('An answer that fails to grade')
    expect(document.querySelector('.ring-center').textContent).toBe('—')   // no invented score
  }, 20000)

  it('renders AI and user text as text, never as HTML', async () => {
    const user = userEvent.setup()
    api.evaluateAnswer.mockResolvedValue(evalFor('x', { feedback: '<img src=x onerror="window.pwned=1"> **bold**' }))
    await startInterview(user)

    await answer(user, '<b>not bold</b>')
    await waitFor(() => expect(chat()).toContain('<img src=x'), WAIT)

    const messages = document.querySelector('.messages')
    expect(messages.querySelector('img')).toBeNull()
    expect(messages.querySelector('b')).toBeNull()
    expect([...messages.querySelectorAll('strong')].some(s => s.textContent === 'bold')).toBe(true)
  }, 20000)

  it('offers a retry when the feedback report fails', async () => {
    const user = userEvent.setup()
    api.generateFeedback
      .mockRejectedValueOnce({ response: { status: 503, data: { detail: 'Gemini API error (500): boom' } } })
      .mockResolvedValueOnce(FEEDBACK)
    await startInterview(user)

    await answer(user, 'Only answer')
    await waitFor(() => expect(chat()).toContain('Question 2 of 3'), WAIT)
    await user.click(screen.getByRole('button', { name: /End & get feedback/ }))

    expect(await screen.findByText(/Couldn't generate your feedback report/, {}, WAIT)).toBeTruthy()
    expect(screen.getByText('Gemini API error (500): boom')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Retry feedback/ }))
    expect(await screen.findByText(/Question-by-Question Review/, {}, WAIT)).toBeTruthy()
    expect(api.generateFeedback).toHaveBeenCalledTimes(2)
    expect(api.generateFeedback.mock.calls[1][0].qa_pairs).toHaveLength(1)
  }, 20000)

  it('resumes an interview in progress after a reload', async () => {
    const user = userEvent.setup()
    const view = await startInterview(user)
    await answer(user, 'Answer before reload')
    await waitFor(() => expect(chat()).toContain('Question 2 of 3'), WAIT)

    // Simulate a page refresh: unmount everything and start again from storage
    view.unmount()
    renderApp('/interview')

    await waitFor(() => expect(chat()).toContain('Welcome back'), WAIT)
    await waitFor(() => expect(chat()).toContain('Second question?'), WAIT)
    expect(chat()).not.toContain('First question?')
  }, 20000)

  it('asks a follow-up after a weak answer and lifts the score when it goes better', async () => {
    const user = userEvent.setup()
    api.evaluateAnswer
      .mockResolvedValueOnce(evalFor('First question?', { score: 40, technical: 40, followup_question: 'What about collisions?' }))
      .mockResolvedValueOnce(evalFor('What about collisions?', { score: 80, technical: 80 }))
      .mockImplementation(({ question }) => Promise.resolve(evalFor(question)))
    await startInterview(user)

    await answer(user, 'A thin answer')
    await waitFor(() => expect(chat()).toContain('Follow-up · What about collisions?'), WAIT)
    expect(chat()).not.toContain('Question 2 of 3')

    await answer(user, 'A better answer')
    await waitFor(() => expect(chat()).toContain('Question 2 of 3'), WAIT)
    expect(api.evaluateAnswer.mock.calls[1][0]).toMatchObject({
      question: 'What about collisions?', parent_question: 'First question?', parent_answer: 'A thin answer',
    })
    expect(document.querySelector('.ring-center').textContent).toBe('60')   // (40 + 80) / 2

    await user.click(screen.getByRole('button', { name: /End & get feedback/ }))
    await screen.findByText(/Question-by-Question Review/, {}, WAIT)
    const [entry] = api.generateFeedback.mock.calls[0][0].qa_pairs
    expect(entry.a).toBe('A thin answer')
    expect(entry.followup).toMatchObject({ q: 'What about collisions?', a: 'A better answer' })
    expect(entry.eval.score).toBe(60)
    expect(entry.time_sec).toEqual(expect.any(Number))
  }, 20000)

  it('never lets a worse follow-up lower the score, and only follows up once', async () => {
    const user = userEvent.setup()
    api.evaluateAnswer
      .mockResolvedValueOnce(evalFor('First question?', { score: 50 }))
      .mockResolvedValueOnce(evalFor('Why First question?', { score: 20 }))
      .mockImplementation(({ question }) => Promise.resolve(evalFor(question)))
    await startInterview(user)

    await answer(user, 'So-so')
    await waitFor(() => expect(chat()).toContain('Follow-up ·'), WAIT)
    await answer(user, 'Worse')
    await waitFor(() => expect(chat()).toContain('Question 2 of 3'), WAIT)

    expect(count(chat(), 'Follow-up ·')).toBe(1)
    expect(document.querySelector('.ring-center').textContent).toBe('50')
  }, 20000)

  it('keeps the original answer when a follow-up is skipped or the interview ends during it', async () => {
    const user = userEvent.setup()
    api.evaluateAnswer.mockImplementation(({ question }) => Promise.resolve(evalFor(question, { score: 50 })))
    await startInterview(user)

    await answer(user, 'First weak answer')
    await waitFor(() => expect(chat()).toContain('Follow-up ·'), WAIT)
    await user.click(screen.getByRole('button', { name: /Skip this follow-up/ }))
    await waitFor(() => expect(chat()).toContain('Question 2 of 3'), WAIT)

    await answer(user, 'Second weak answer')
    await waitFor(() => expect(count(chat(), 'Follow-up ·')).toBe(2), WAIT)
    await user.click(screen.getByRole('button', { name: /End & get feedback/ }))
    await screen.findByText(/Question-by-Question Review/, {}, WAIT)

    const { qa_pairs } = api.generateFeedback.mock.calls[0][0]
    expect(qa_pairs.map(qa => qa.a)).toEqual(['First weak answer', 'Second weak answer'])
    expect(qa_pairs.every(qa => !qa.followup)).toBe(true)
  }, 20000)

  it('resumes a follow-up after a reload', async () => {
    const user = userEvent.setup()
    api.evaluateAnswer.mockResolvedValue(evalFor('First question?', { score: 30, followup_question: 'Could you expand?' }))
    const view = await startInterview(user)

    await answer(user, 'Weak')
    await waitFor(() => expect(chat()).toContain('Follow-up · Could you expand?'), WAIT)

    view.unmount()
    renderApp('/interview')
    await waitFor(() => expect(chat()).toContain('Follow-up · Could you expand?'), WAIT)
    expect(chat()).toContain('Welcome back')
  }, 20000)

  it('shows feedback as it streams, then the final message', async () => {
    const user = userEvent.setup()
    let finish
    api.evaluateAnswer.mockImplementation((payload, onDelta) => new Promise(resolve => {
      onDelta('Good ')
      onDelta('start')
      finish = () => resolve(evalFor(payload.question, { feedback: 'Good start, well done.' }))
    }))
    await startInterview(user)

    await answer(user, 'Streaming answer')
    await waitFor(() => expect(chat()).toContain('Quick thoughts: Good start'), WAIT)
    expect(chat()).not.toContain('well done')

    finish()
    await waitFor(() => expect(chat()).toContain('Good start, well done.'), WAIT)
    expect(count(chat(), 'Quick thoughts:')).toBe(1)   // updated in place, not duplicated
  }, 20000)

  it('removes a partly streamed message if evaluation fails', async () => {
    const user = userEvent.setup()
    api.evaluateAnswer.mockImplementation(async (payload, onDelta) => {
      onDelta('Partial')
      throw { response: { status: 503, data: { detail: 'Connection lost.' } } }
    })
    await startInterview(user)

    await answer(user, 'Answer')
    await waitFor(() => expect(chat()).toContain('Connection lost.'), WAIT)
    expect(chat()).not.toContain('Partial')
  }, 20000)

  it('allows one hint per question and sends it with the answer', async () => {
    const user = userEvent.setup()
    api.getHint.mockResolvedValue('Think about hashing.')
    api.evaluateAnswer.mockImplementation(({ question, hints_used }) => Promise.resolve(
      evalFor(question, hints_used ? { hint_penalty: 5, score: 75 } : {})
    ))
    await startInterview(user)

    await user.click(screen.getByRole('button', { name: /Request a hint/ }))
    expect(await screen.findByText(/Think about hashing/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Hint used/ }).disabled).toBe(true)

    await answer(user, 'With a hint')
    await waitFor(() => expect(chat()).toContain('5 points off for using the hint'), WAIT)
    expect(api.evaluateAnswer.mock.calls[0][0].hints_used).toBe(1)
    await waitFor(() => expect(chat()).toContain('Question 2 of 3'), WAIT)

    // Fresh question: the hint is available again and isn't charged
    expect(screen.getByRole('button', { name: /Request a hint/ }).disabled).toBe(false)
    await answer(user, 'Without a hint')
    await waitFor(() => expect(api.evaluateAnswer).toHaveBeenCalledTimes(2), WAIT)
    expect(api.evaluateAnswer.mock.calls[1][0].hints_used).toBe(0)
  }, 20000)

  it('shows a countdown based on the question type', async () => {
    const user = userEvent.setup()
    api.generateQuestions.mockResolvedValue({
      questions: [{ ...QUESTIONS[0], type: 'behavioral' }], fallback: false,
    })
    await startInterview(user)
    expect(document.querySelector('.question-timer').textContent).toMatch(/[12]:\d\d/)
  }, 20000)

  it('opens the code editor for coding questions and fences the answer', async () => {
    const user = userEvent.setup()
    api.generateQuestions.mockResolvedValue({
      questions: QUESTIONS.map(q => ({ ...q, type: 'coding' })), fallback: false,
    })
    await startInterview(user, 'Coding')

    const editor = await screen.findByLabelText('Code answer')
    await user.selectOptions(screen.getByLabelText('Language'), 'javascript')
    await user.type(editor, 'const x = 1')
    await user.click(screen.getByRole('button', { name: /Send/ }))

    await waitFor(() => expect(api.evaluateAnswer).toHaveBeenCalled(), WAIT)
    expect(api.evaluateAnswer.mock.calls[0][0].answer).toBe('```javascript\nconst x = 1\n```')
    expect(document.querySelector('.messages .code-block').textContent).toBe('const x = 1')
  }, 20000)

  it('can switch any question to the code editor and back', async () => {
    const user = userEvent.setup()
    await startInterview(user)
    expect(screen.queryByLabelText('Code answer')).toBeNull()

    await user.click(screen.getByRole('button', { name: /Code/ }))
    expect(await screen.findByLabelText('Code answer')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Code/ }))
    expect(screen.getByPlaceholderText(/Type your answer/)).toBeTruthy()
  }, 20000)

  it('adds dictated speech to the answer box', async () => {
    const user = userEvent.setup()
    let recognition
    window.SpeechRecognition = class {
      constructor() { recognition = this }
      start() {}
      stop() { this.onend() }
      abort() {}
    }
    try {
      await startInterview(user)
      await user.click(screen.getByRole('button', { name: /Speak/ }))
      recognition.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: ' hello world ' }], { isFinal: true })] })
      await waitFor(() => expect(screen.getByPlaceholderText(/Type your answer/).value).toBe('hello world'))
      await user.click(screen.getByRole('button', { name: /Stop/ }))
      expect(screen.getByRole('button', { name: /Speak/ })).toBeTruthy()
    } finally {
      delete window.SpeechRecognition
    }
  }, 20000)

  it('reads questions aloud when turned on, and remembers it', async () => {
    const user = userEvent.setup()
    const spoken = []
    window.speechSynthesis = { cancel: vi.fn(), speak: u => spoken.push(u.text) }
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text } }
    try {
      await startInterview(user)
      await user.click(screen.getByRole('button', { name: /Read questions aloud: Off/ }))
      await answer(user, 'Answer one')
      await waitFor(() => expect(spoken).toContain('Second question?'), WAIT)
      expect(localStorage.getItem('iai_voice')).toBe('on')
    } finally {
      delete window.speechSynthesis
      delete window.SpeechSynthesisUtterance
    }
  }, 20000)
})

describe('feedback report', () => {
  it('reveals the model answer and shows follow-up, time and hint details', async () => {
    const user = userEvent.setup()
    api.getSession.mockResolvedValue({
      feedback_data: { ...FEEDBACK, q_feedback: [{ idx: 0, verdict: 'strong', comment: 'Nice' }] },
      qa_data: [{
        q: 'First question?', a: 'My answer', type: 'technical', time_sec: 83, hints_used: 1,
        eval: evalFor('First question?', { hint_penalty: 5 }),
        followup: { q: 'Why though?', a: 'Because', eval: { score: 66 } },
      }],
    })
    renderApp('/feedback/some-uid')

    await user.click(await screen.findByText(/Q1: First question/))
    expect(screen.getByText('Follow-up: Why though?')).toBeTruthy()
    expect(screen.getByText('Follow-up score: 66')).toBeTruthy()
    expect(screen.getByText(/1:23/)).toBeTruthy()
    expect(screen.getByText(/Hint used \(−5\)/)).toBeTruthy()

    expect(screen.queryByText('A strong answer covers X.')).toBeNull()
    await user.click(screen.getByRole('button', { name: /Show what a strong answer/ }))
    expect(screen.getByText('A strong answer covers X.')).toBeTruthy()
  })
})
