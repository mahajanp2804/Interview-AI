import { describe, it, expect, vi, afterEach } from 'vitest'
import { evaluateAnswer, errorMessage } from './api'

const encoder = new TextEncoder()

// A fetch response whose body arrives in the given pieces
function mockStream(pieces) {
  const body = new ReadableStream({
    start(controller) {
      pieces.forEach(piece => controller.enqueue(encoder.encode(piece)))
      controller.close()
    },
  })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status: 200 })))
}

const event = (name, data) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`

afterEach(() => vi.unstubAllGlobals())

describe('evaluateAnswer', () => {
  it('passes deltas along and resolves with the result', async () => {
    mockStream([event('delta', 'Good '), event('delta', 'work'), event('result', { score: 70 })])
    const deltas = []
    await expect(evaluateAnswer({}, d => deltas.push(d))).resolves.toEqual({ score: 70 })
    expect(deltas).toEqual(['Good ', 'work'])
  })

  it('handles events split across network chunks', async () => {
    const text = event('delta', 'héllo\nthere') + event('result', { score: 1 })
    const bytes = encoder.encode(text)
    const body = new ReadableStream({
      start(controller) {
        for (let i = 0; i < bytes.length; i += 3) controller.enqueue(bytes.slice(i, i + 3))
        controller.close()
      },
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)))

    const deltas = []
    await expect(evaluateAnswer({}, d => deltas.push(d))).resolves.toEqual({ score: 1 })
    expect(deltas).toEqual(['héllo\nthere'])
  })

  it('rejects with the reason from an error event', async () => {
    mockStream([event('delta', 'Par'), event('error', { detail: 'Gemini rate limit reached.' })])
    const error = await evaluateAnswer({}).catch(e => e)
    expect(errorMessage(error)).toBe('Gemini rate limit reached.')
  })

  it('rejects if the stream ends without a result', async () => {
    mockStream([event('delta', 'Par')])
    const error = await evaluateAnswer({}).catch(e => e)
    expect(errorMessage(error)).toBe('The response ended before the evaluation finished.')
  })

  it('rejects on an HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 500 })))
    const error = await evaluateAnswer({}).catch(e => e)
    expect(errorMessage(error)).toBe('Request failed (500).')
  })
})
