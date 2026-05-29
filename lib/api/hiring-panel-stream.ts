import type { HiringPanelResult } from '@/lib/ai/hiring-panel-schemas'
import { runHiringPanelSimulation } from '@/lib/ai/hiring-panel'
import { HIRING_PANEL_PROGRESS_LABELS } from '@/lib/api/hiring-panel-progress-labels'
import { withGenerationTimeout } from '@/lib/api/progress-stream'

export type HiringPanelStreamEvent =
  | { type: 'progress'; step: number; label: string }
  | { type: 'ping'; ts: number }
  | { type: 'complete'; result: HiringPanelResult }
  | { type: 'error'; error: string }

const STREAM_HEARTBEAT_MS = 4_000
const PROGRESS_INTERVAL_MS = 2_800

function encodeEvent(event: HiringPanelStreamEvent): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`)
}

export function createHiringPanelNdjsonStream(
  handler: (emit: (event: HiringPanelStreamEvent) => void) => Promise<void>
): ReadableStream<Uint8Array> {
  return new ReadableStream({
    async start(controller) {
      let settled = false
      let heartbeat: ReturnType<typeof setInterval> | null = null

      const emit = (event: HiringPanelStreamEvent) => {
        if (event.type === 'complete' || event.type === 'error') {
          settled = true
        }
        try {
          controller.enqueue(encodeEvent(event))
        } catch (error) {
          if (!settled) {
            settled = true
            const message =
              error instanceof Error ? error.message : 'Failed to stream hiring panel result.'
            controller.enqueue(
              encodeEvent({
                type: 'error',
                error: `Stream encoding failed: ${message}`,
              })
            )
          }
        }
      }

      heartbeat = setInterval(() => {
        if (settled) return
        try {
          controller.enqueue(encodeEvent({ type: 'ping', ts: Date.now() }))
        } catch {
          if (heartbeat) clearInterval(heartbeat)
        }
      }, STREAM_HEARTBEAT_MS)

      try {
        await handler(emit)

        if (!settled) {
          emit({
            type: 'error',
            error:
              'Hiring panel finished without a result. The request likely timed out — try again with a shorter resume.',
          })
        }

        controller.close()
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Request failed.'
        if (!settled) {
          emit({ type: 'error', error: message })
        }
        controller.close()
      } finally {
        if (heartbeat) clearInterval(heartbeat)
      }
    },
  })
}

export function hiringPanelStreamResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

export async function runStreamedHiringPanel(
  emit: (event: HiringPanelStreamEvent) => void,
  jobDescription: string,
  resumeText: string,
  coverLetter?: string
): Promise<void> {
  emit({
    type: 'progress',
    step: 0,
    label: HIRING_PANEL_PROGRESS_LABELS[0]!,
  })

  let step = 0
  const progressTimer = setInterval(() => {
    step += 1
    if (step < HIRING_PANEL_PROGRESS_LABELS.length) {
      emit({
        type: 'progress',
        step,
        label: HIRING_PANEL_PROGRESS_LABELS[step]!,
      })
    }
  }, PROGRESS_INTERVAL_MS)

  try {
    const result = await withGenerationTimeout(
      runHiringPanelSimulation(jobDescription, resumeText, coverLetter)
    )
    emit({ type: 'complete', result })
  } finally {
    clearInterval(progressTimer)
  }
}

function parseHiringPanelEvent(line: string): HiringPanelStreamEvent {
  try {
    return JSON.parse(line) as HiringPanelStreamEvent
  } catch {
    throw new Error('Received malformed progress data from the hiring panel.')
  }
}

export async function consumeHiringPanelStream(
  response: Response,
  onProgress?: (step: number, label: string) => void
): Promise<HiringPanelResult> {
  if (!response.body) {
    throw new Error('Empty response from server.')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result: HiringPanelResult | null = null
  let streamError: string | null = null

  const handleEvent = (event: HiringPanelStreamEvent) => {
    if (event.type === 'progress') {
      onProgress?.(event.step, event.label)
    } else if (event.type === 'complete') {
      result = event.result
    } else if (event.type === 'error') {
      streamError = event.error
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.trim()) continue
      handleEvent(parseHiringPanelEvent(line))
    }
  }

  if (buffer.trim()) {
    handleEvent(parseHiringPanelEvent(buffer))
  }

  if (streamError) {
    throw new Error(streamError)
  }

  if (!result) {
    throw new Error(
      'Hiring panel finished without a result. The server may have timed out — try again.'
    )
  }

  return result
}
