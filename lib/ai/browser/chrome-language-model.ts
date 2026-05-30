import type {
  LanguageModelAvailability,
  LanguageModelSession,
  LanguageModelStatic,
} from '@/types/chrome-ai'

export type { LanguageModelAvailability } from '@/types/chrome-ai'

export type BrowserAiStatus =
  | { supported: false; message: string }
  | {
      supported: true
      availability: LanguageModelAvailability
      message: string
      ready: boolean
    }

export function getChromeLanguageModel(): LanguageModelStatic | undefined {
  if (typeof window === 'undefined') return undefined
  return window.LanguageModel
}

export async function inspectBrowserAi(): Promise<BrowserAiStatus> {
  const lm = getChromeLanguageModel()

  if (!lm) {
    return {
      supported: false,
      message:
        'Chrome on-device AI is not available. Use Chrome desktop with the Prompt API enabled (chrome://flags → Prompt API for Gemini Nano), or use server generation when your quota resets.',
    }
  }

  try {
    const availability = await lm.availability({
      expectedInputs: [{ type: 'text', languages: ['en'] }],
      expectedOutputs: [{ type: 'text', languages: ['en'] }],
    })

    const ready = availability === 'available' || availability === 'readily'

    return {
      supported: true,
      availability,
      ready,
      message: ready
        ? 'Gemini Nano is ready — unlimited generation runs on your device.'
        : availability === 'downloadable'
          ? 'Click Generate to download Gemini Nano once (~1–2 GB). After that, generation is unlimited and free.'
          : availability === 'downloading'
            ? 'Gemini Nano is downloading…'
            : 'On-device AI is unavailable on this device.',
    }
  } catch {
    return {
      supported: false,
      message: 'Could not check Chrome on-device AI status.',
    }
  }
}

export async function createBrowserAiSession(systemPrompt: string): Promise<LanguageModelSession> {
  const lm = getChromeLanguageModel()
  if (!lm) {
    throw new Error('Chrome LanguageModel API is not available in this browser.')
  }

  return lm.create({
    systemPrompt,
    temperature: 0.35,
    topK: 32,
  })
}

export async function promptBrowserAi(systemPrompt: string, userPrompt: string): Promise<string> {
  const session = await createBrowserAiSession(systemPrompt)
  try {
    const text = await session.prompt(userPrompt)
    return text.trim()
  } finally {
    session.destroy()
  }
}
