import type {
  LanguageModelAvailability,
  LanguageModelSession,
  LanguageModelStatic,
} from '@/types/chrome-ai'
import { isChromeDesktopBrowser } from '@/lib/ai/browser/chrome-setup'

export type { LanguageModelAvailability } from '@/types/chrome-ai'

export type BrowserAiStatus =
  | { supported: false; message: string; needsFlagSetup: boolean }
  | {
      supported: true
      availability: LanguageModelAvailability
      message: string
      ready: boolean
      needsFlagSetup: false
    }

export function getChromeLanguageModel(): LanguageModelStatic | undefined {
  if (typeof window === 'undefined') return undefined
  return window.LanguageModel
}

export async function inspectBrowserAi(): Promise<BrowserAiStatus> {
  const lm = getChromeLanguageModel()

  if (!lm) {
    const needsFlagSetup = isChromeDesktopBrowser()
    return {
      supported: false,
      needsFlagSetup,
      message: needsFlagSetup
        ? 'Gemini Nano is not enabled yet. Follow the setup steps below (one-time, ~2 minutes). Keyword tailoring still works without Nano.'
        : 'Use Chrome desktop for on-device AI, or turn off browser AI below to use server generation.',
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
      needsFlagSetup: false,
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
      needsFlagSetup: isChromeDesktopBrowser(),
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
