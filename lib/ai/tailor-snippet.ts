import { generateText } from 'ai'

import { shouldUseLocalFallback, unwrapAiError } from '@/lib/ai/errors'
import {
  AI_GENERATION_TEMPERATURE,
  AI_STREAM_MAX_RETRIES,
  assertDirectAiProviderConfigured,
  buildFreeProviderChain,
} from '@/lib/ai/provider'
import {
  buildSnippetForKeyword,
  type SnippetGenerationContext,
} from '@/lib/resume/skill-snippets'
import {
  extractCareerContext,
} from '@/lib/resume/resume-career-context'
import { REPHRASE_JOB_DESCRIPTION_MATCH_INSTRUCTION } from '@/lib/resume/exact-phrasing-auditor'

export interface TailorSnippetInput {
  jobDescription: string
  resumeText: string
  keyword: string
  currentSnippet: string
  otherSnippets?: string[]
  variationIndex?: number
  previousVariations?: string[]
  rephraseJobDescriptionMatch?: boolean
  matchedJobDescriptionPhrases?: string[]
}

const TAILOR_SNIPPET_SYSTEM = `You are an executive resume writer specializing in ATS-optimized, non-repetitive resume bullet additions.

Rewrite exactly ONE addition sentence for a single target skill/keyword.

STRICT RULES:
1. CONTEXTUAL AWARENESS — Use the full resume and job description provided. Anchor the sentence in the candidate's real employers, roles, and seniority. Prefer referencing a plausible recent employer or role from their history when it fits naturally.
2. DIVERSIFICATION — Never reuse sentence structures, opening verbs, or filler phrases used in other pending additions or existing resume bullets. Each card must read structurally distinct (different opener, clause order, and rhythm).
3. AUTHENTIC FRAMING — No generic corporate filler such as "Directed [skill] initiatives with executive scope oversight". Write an achievement-oriented sentence that sounds like it belongs on THIS candidate's resume.
4. JOB ALIGNMENT — Match the job's competency level and tone semantically. Never copy sentences or multi-word fragments from the job description (more than 3 consecutive identical words fails compliance).
5. CONCISION — One sentence, max ~35 words, impact-driven.
6. OUTPUT — Return ONLY the rewritten sentence. No quotes, markdown, labels, or commentary.

When a VARIATION instruction is present, produce wording clearly different from every listed previous version.`

function truncateForPrompt(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength)}\n\n[truncated for length]`
}

function openingPatterns(texts: string[]): string {
  return texts
    .map((text) =>
      text
        .trim()
        .split(/\s+/)
        .slice(0, 5)
        .join(' ')
    )
    .filter(Boolean)
    .map((line) => `- ${line}`)
    .join('\n')
}

function buildTailorSnippetPrompt(input: TailorSnippetInput): string {
  const career = extractCareerContext(input.resumeText)
  const pending = (input.otherSnippets ?? []).filter(Boolean).slice(0, 12)
  const previous = (input.previousVariations ?? []).filter(Boolean).slice(-6)
  const variationIndex = input.variationIndex ?? 0
  const matchedPhrases = (input.matchedJobDescriptionPhrases ?? []).filter(Boolean).slice(0, 6)

  const bannedOpeners = openingPatterns([
    ...pending,
    ...previous,
    input.currentSnippet,
  ])

  return `JOB DESCRIPTION (match tone and vocabulary):
${truncateForPrompt(input.jobDescription.trim(), 6000)}

FULL RESUME TEXT (ground truth — do not invent beyond this):
${truncateForPrompt(input.resumeText.trim(), 12000)}

CAREER ANCHORS EXTRACTED FROM RESUME:
- Employers: ${career.employers.length ? career.employers.join(', ') : '(none detected)'}
- Recent roles: ${career.recentRoles.length ? career.recentRoles.join(', ') : '(none detected)'}

TARGET KEYWORD / SKILL TO WEAVE IN:
${input.keyword.trim()}

CURRENT DRAFT (rewrite — do not copy its structure if variation is requested):
${input.currentSnippet.trim()}

OTHER PENDING ADDITIONS FOR OTHER CARDS (must use different structures and openers):
${pending.length > 0 ? pending.map((line) => `- ${line}`).join('\n') : '(none)'}

PREVIOUS VERSIONS OF THIS SAME CARD (do NOT repeat phrasing or structure):
${previous.length > 0 ? previous.map((line) => `- ${line}`).join('\n') : '(none)'}

OPENING PATTERNS TO AVOID (already used above):
${bannedOpeners || '(none)'}

VARIATION INDEX: ${variationIndex}
${variationIndex > 0 ? 'VARIATION MODE: Rephrase completely differently from the current draft and every previous version. Change the opening verb, clause order, and framing.' : 'INITIAL MODE: Produce the first distinct phrasing for this card.'}
${
  input.rephraseJobDescriptionMatch
    ? `
${REPHRASE_JOB_DESCRIPTION_MATCH_INSTRUCTION}
${
  matchedPhrases.length
    ? `Detected overlapping job-description phrasing to eliminate:\n${matchedPhrases.map((phrase) => `- "${phrase}"`).join('\n')}`
    : ''
}`
    : ''
}

TASK:
Write one new sentence that weaves "${input.keyword.trim()}" into an achievement grounded in the candidate's actual career context, aligned to the job description, and structurally distinct from every bullet and pending addition above.`
}

function normalizeSnippetOutput(text: string): string {
  return text
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/^```[\s\S]*?\n|```$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function temperatureForVariation(variationIndex: number): number {
  const bump = Math.min(variationIndex, 6) * 0.07
  return Math.min(AI_GENERATION_TEMPERATURE + bump, 0.85)
}

function tailorSnippetLocally(input: TailorSnippetInput): string {
  const context: SnippetGenerationContext = {
    resumeText: input.resumeText,
    jobDescription: input.jobDescription,
    siblingSnippets: [...(input.otherSnippets ?? []), ...(input.previousVariations ?? [])],
    variationIndex: input.variationIndex ?? 0,
  }

  return buildSnippetForKeyword(input.keyword, context).snippet
}

export async function tailorSnippetWithAi(input: TailorSnippetInput): Promise<string> {
  assertDirectAiProviderConfigured()

  const chain = buildFreeProviderChain()
  const prompt = buildTailorSnippetPrompt(input)
  const variationIndex = input.variationIndex ?? 0
  let lastError: unknown

  for (let index = 0; index < chain.length; index += 1) {
    const entry = chain[index]!
    try {
      const systemPrompt = input.rephraseJobDescriptionMatch
        ? `${TAILOR_SNIPPET_SYSTEM}\n\n${REPHRASE_JOB_DESCRIPTION_MATCH_INSTRUCTION}`
        : TAILOR_SNIPPET_SYSTEM

      const result = await generateText({
        model: entry.model,
        system: systemPrompt,
        prompt,
        temperature: temperatureForVariation(variationIndex),
        maxOutputTokens: 256,
        maxRetries: AI_STREAM_MAX_RETRIES,
        providerOptions: entry.providerOptions,
      })

      const snippet = normalizeSnippetOutput(result.text)
      if (snippet.length >= 12) {
        return snippet
      }

      throw new Error('AI returned an empty snippet.')
    } catch (error) {
      lastError = error
      const hasNext = index < chain.length - 1
      if (hasNext && shouldUseLocalFallback(unwrapAiError(error))) {
        continue
      }
      break
    }
  }

  if (shouldUseLocalFallback(lastError)) {
    return tailorSnippetLocally(input)
  }

  throw lastError instanceof Error ? lastError : new Error('Failed to tailor snippet.')
}
