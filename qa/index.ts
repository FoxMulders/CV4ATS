/**
 * QA review module barrel — debug instrumentation, quota interceptors, and iterative panel loop.
 */

export {
  SystemDebugProvider,
  useSystemDebugLog,
  useSystemDebugLogOptional,
  type SystemDebugContextValue,
} from '@/qa/components/SystemDebugProvider'

export {
  SystemDebugConsole,
  type SystemDebugConsoleProps,
  type SystemDebugConsoleVariant,
} from '@/qa/components/SystemDebugConsole'

export { SystemDebugDock } from '@/qa/components/SystemDebugDock'

export { useRateLimitCooldown, type RateLimitCooldownState } from '@/qa/hooks/useRateLimitCooldown'

export {
  ApiRateLimitError,
  interceptGeminiQuotaResponse,
  isApiRateLimitError,
  isQuotaFailureText,
  parseGeminiRetrySecondsFromBody,
  readRetryAfterSeconds,
  throwIfGeminiQuotaLimited,
  type QuotaInterceptBody,
} from '@/qa/lib/GeminiQuotaInterceptor'

export {
  MAX_HIRING_PANEL_REVISION_ROUNDS,
  runHiringPanelWithRevisions,
  type HiringPanelProgressCallback,
  type HiringPanelWithRevisionsResult,
} from '@/qa/lib/IterativePanelLoop'
