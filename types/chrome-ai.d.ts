/** Chrome Prompt API (Gemini Nano on-device). https://developer.chrome.com/docs/ai/prompt-api */

export type LanguageModelAvailability =
  | 'unavailable'
  | 'downloadable'
  | 'downloading'
  | 'available'
  | 'readily'

export interface LanguageModelCreateOptions {
  systemPrompt?: string
  temperature?: number
  topK?: number
  monitor?: (monitor: EventTarget) => void
}

export interface LanguageModelSession {
  prompt(input: string): Promise<string>
  promptStreaming(input: string): AsyncIterable<string>
  destroy(): void
}

export interface LanguageModelStatic {
  availability(options?: {
    expectedInputs?: Array<{ type: 'text'; languages?: string[] }>
    expectedOutputs?: Array<{ type: 'text'; languages?: string[] }>
  }): Promise<LanguageModelAvailability>
  create(options?: LanguageModelCreateOptions): Promise<LanguageModelSession>
}

declare global {
  interface Window {
    LanguageModel?: LanguageModelStatic
  }
}

export {}
