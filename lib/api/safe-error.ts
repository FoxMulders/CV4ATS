import { ResumeParseError } from '@/lib/resume/parse-errors'

const INTERNAL_PATTERNS = [
  /api key/i,
  /AI_GATEWAY/i,
  /OPENAI/i,
  /VERCEL/i,
  /gateway/i,
  /structured output/i,
  /invalid schema/i,
  /ECONNREF/i,
  /fetch failed/i,
  /Unexpected token/i,
  /SyntaxError/i,
  /TypeError/i,
  /at Object\./,
  /at async/i,
  /stack/i,
  /zod/i,
]

export function isUserFacingError(message: string): boolean {
  const trimmed = message.trim()
  if (!trimmed) return false
  return !INTERNAL_PATTERNS.some((pattern) => pattern.test(trimmed))
}

export function safeErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ResumeParseError) {
    return error.message
  }

  if (error instanceof Error) {
    const message = error.message.trim()
    if (message && isUserFacingError(message)) {
      return message
    }
  }

  return fallback
}
