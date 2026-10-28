import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AppProvider } from './AppContext'
import App from './App'
import * as api from './api'

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

async function startInterview(user) {
  const view = renderApp()
  await user.click(screen.getByRole('button', { name: /Software Engineer/ }))
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
    }))
    expect(count(chat(), 'Question 1 of 3')).toBe(1)   // regression: Q1 used to be shown again

    await user.click(screen.getByRole('button', { name: /Skip this question/ }))
    await waitFor(() => expect(chat()).toContain('Question 3 of 3'), WAIT)

    await answer(user, 'My answer to the third one')
    expect(await screen.findByText(/Question-by-Question Review/, {}, WAIT)).toBeTruthy()

    expect(api.evaluateAnswer).toHaveBeenCalledTimes(2)
    expect(api.evaluateAnswer).toHaveBeenLastCalledWith(expect.objectContaining({ question: 'Third question?' }))

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
})
