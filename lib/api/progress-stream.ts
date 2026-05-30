import type { DeepPartial } from 'ai'

import type { AiGenerationResult, GenerationResult, TailoredResume } from '@/lib/ai/schemas'

export type ScorePassEvent = {
  type: 'score-pass'
  pass: number
  phase: string
  scoreBefore: number
  scoreAfter: number
  injectedCount?: number
}

export type PartialGenerationEvent = {
  type: 'partial'
  preview: DeepPartial<AiGenerationResult>
}

export type StreamEvent =
  | { type: 'progress'; step: number; label: string }
  | { type: 'ping'; ts: number }
  | ScorePassEvent
  | PartialGenerationEvent
  | { type: 'complete'; result: GenerationResult & Record<string, unknown> }
  | { type: 'error'; error: string }

const STREAM_HEARTBEAT_MS = 4_000

export function encodeStreamEvent(event: StreamEvent): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`)
}

export function createNdjsonStream(
  handler: (emit: (event: StreamEvent) => void) => Promise<void>,
  options: { heartbeatMs?: number } = {}
): ReadableStream<Uint8Array> {
  const heartbeatMs = options.heartbeatMs ?? STREAM_HEARTBEAT_MS

  return new ReadableStream({
    async start(controller) {
      let settled = false
      let heartbeat: ReturnType<typeof setInterval> | null = null

      const emit = (event: StreamEvent) => {
        if (event.type === 'complete' || event.type === 'error') {
          settled = true
        }
        try {
          controller.enqueue(encodeStreamEvent(event))
        } catch (error) {
          if (!settled) {
            settled = true
            const message =
              error instanceof Error ? error.message : 'Failed to stream generation result.'
            controller.enqueue(
              encodeStreamEvent({
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
          controller.enqueue(encodeStreamEvent({ type: 'ping', ts: Date.now() }))
        } catch {
          if (heartbeat) clearInterval(heartbeat)
        }
      }, heartbeatMs)

      try {
        await handler(emit)

        if (!settled) {
          emit({
            type: 'error',
            error:
              'Generation finished without a result. The request likely timed out — try again with a shorter resume.',
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

export function ndjsonStreamResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

function parseStreamEvent(line: string): StreamEvent {
  try {
    return JSON.parse(line) as StreamEvent
  } catch {
    throw new Error('Received malformed progress data from the server.')
  }
}

export interface GenerationStreamCallbacks {
  onProgress?: (step: number, label: string) => void
  onScorePass?: (event: ScorePassEvent) => void
  onPartial?: (preview: DeepPartial<AiGenerationResult>) => void
}

/** Strip non-JSON-serializable values before streaming the final result. */
export function serializeStreamResult<T extends Record<string, unknown>>(result: T): T {
  return JSON.parse(JSON.stringify(result)) as T
}

export async function consumeGenerationStream<T extends GenerationResult = GenerationResult>(
  response: Response,
  callbacks: GenerationStreamCallbacks = {}
): Promise<T> {
  const { onProgress, onScorePass, onPartial } = callbacks

  if (!response.body) {
    throw new Error('Empty response from server.')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result: GenerationResult | null = null
  let streamError: string | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.trim()) continue

      const event = parseStreamEvent(line)
      if (event.type === 'progress') {
        onProgress?.(event.step, event.label)
      } else if (event.type === 'score-pass') {
        onScorePass?.(event)
      } else if (event.type === 'partial') {
        onPartial?.(event.preview)
      } else if (event.type === 'complete') {
        result = event.result
      } else if (event.type === 'error') {
        streamError = event.error
      }
    }
  }

  if (buffer.trim()) {
    const event = parseStreamEvent(buffer)
    if (event.type === 'complete') {
      result = event.result
    } else if (event.type === 'error') {
      streamError = event.error
    } else if (event.type === 'score-pass') {
      onScorePass?.(event)
    } else if (event.type === 'partial') {
      onPartial?.(event.preview)
    } else if (event.type === 'progress') {
      onProgress?.(event.step, event.label)
    }
  }

  if (streamError) {
    throw new Error(streamError)
  }

  if (!result) {
    throw new Error(
      'Generation finished without a result. The server may have timed out — try again with a shorter resume.'
    )
  }

  return result as T
}

/** Backward-compatible wrapper for simple progress-only consumers. */
export async function consumeGenerationStreamLegacy<T extends GenerationResult = GenerationResult>(
  response: Response,
  onProgress?: (step: number, label: string) => void
): Promise<T> {
  return consumeGenerationStream<T>(response, { onProgress })
}

export const GENERATION_TIMEOUT_MS = 270_000
/** Legacy edge cap — generate/tailor routes now run on Node.js with maxDuration. */
export const EDGE_GENERATION_TIMEOUT_MS = 28_000

export function getGenerationTimeoutMs(): number {
  if (process.env.NEXT_RUNTIME === 'edge') {
    return EDGE_GENERATION_TIMEOUT_MS
  }
  return GENERATION_TIMEOUT_MS
}

export function withGenerationTimeout<T>(
  promise: Promise<T>,
  timeoutMs = getGenerationTimeoutMs()
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(
            'Generation timed out. Try a shorter resume or job description, then run tailoring again.'
          )
        )
      }, timeoutMs)
    }),
  ])
}

/** Merge streamed partial fields into a displayable resume snapshot. */
export function coalesceStreamingResume(
  partial: DeepPartial<AiGenerationResult> | undefined
): TailoredResume | null {
  const resume = partial?.tailoredResume
  if (!resume?.contact?.name?.trim() || !resume.summary?.trim()) {
    return null
  }

  return {
    contact: {
      name: resume.contact.name,
      email: resume.contact.email ?? '',
      phone: resume.contact.phone ?? '',
      location: resume.contact.location ?? '',
      linkedin: resume.contact.linkedin ?? '',
    },
    summary: resume.summary,
    skills: resume.skills?.filter((skill): skill is string => Boolean(skill?.trim())) ?? [],
    experience:
      resume.experience
        ?.filter((entry) => entry?.title?.trim() && entry.company?.trim())
        .map((entry) => ({
          title: entry!.title!,
          company: entry!.company!,
          location: entry!.location ?? '',
          startDate: entry!.startDate ?? '',
          endDate: entry!.endDate ?? '',
          bullets: entry!.bullets?.filter((bullet): bullet is string => Boolean(bullet?.trim())) ?? [
            'Generating experience details…',
          ],
        })) ?? [],
    education:
      resume.education
        ?.filter((entry) => entry?.degree?.trim() && entry.school?.trim())
        .map((entry) => ({
          degree: entry!.degree!,
          school: entry!.school!,
          graduationDate: entry!.graduationDate ?? '',
          details: entry!.details ?? '',
        })) ?? [],
    certifications:
      resume.certifications?.filter((item): item is string => Boolean(item?.trim())) ?? [],
  }
}
