import { assertDirectAiProviderConfigured, describeConfiguredProvider } from '@/lib/ai/provider'
import type { GenerationResult } from '@/lib/ai/schemas'
import { runGenerationPipeline } from '@/lib/api/generation-pipeline'
import type { StreamEvent } from '@/lib/api/progress-stream'
import {
  serializeStreamResult,
  withGenerationTimeout,
} from '@/lib/api/progress-stream'

type PipelineOptions = {
  selectedKeywords?: string[]
  customSnippets?: string[]
  achievementSupplement?: string
  currentResume?: import('@/lib/ai/schemas').TailoredResume
  anchoredModifications?: Array<{
    snippet: string
    positionId?: string
    bulletIndex?: number
    originalBullet?: string
    bulletLineIndex?: number
    modificationType?: 'inline-bullet' | 'skills-section' | 'summary'
  }>
}

export async function runStreamedGeneration(
  emit: (event: StreamEvent) => void,
  jobDescription: string,
  resumeText: string,
  options: PipelineOptions = {},
  mapComplete?: (result: GenerationResult & Record<string, unknown>) => GenerationResult &
    Record<string, unknown>
): Promise<void> {
  const providerLabel = describeConfiguredProvider()
  emit({ type: 'progress', step: 0, label: `Connecting to ${providerLabel}…` })

  try {
    assertDirectAiProviderConfigured()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI provider is not configured.'
    emit({ type: 'error', error: message })
    return
  }

  emit({ type: 'progress', step: 0, label: `Streaming tailored resume (${providerLabel})…` })

  try {
    const result = await withGenerationTimeout(
      runGenerationPipeline(
        jobDescription,
        resumeText,
        async (update) => {
          if (update.type === 'step') {
            emit({ type: 'progress', step: update.step, label: update.label })
          } else if (update.type === 'partial') {
            emit({
              type: 'partial',
              preview: serializeStreamResult(update.preview),
            })
          } else {
            emit(update)
          }
        },
        options
      )
    )

    const serialized = serializeStreamResult(result)
    console.log('FINAL MERGED PAYLOAD:', JSON.stringify(serialized, null, 2))
    emit({
      type: 'complete',
      result: mapComplete ? mapComplete(serialized) : serialized,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Generation failed.'
    emit({ type: 'error', error: message })
  }
}
