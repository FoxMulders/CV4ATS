import { generateText } from 'ai'

import {
  enforceTailorSnippetOutput,
  parseTailorSnippetModelOutput,
  tailorSnippetOutputFromPlainText,
  type TailorSnippetOutput,
} from '@/lib/ai/ats-keyword-injection-directive'
import {
  buildQaFeedbackPromptSection,
  polishBulletLocally,
  runBulletQaPipeline,
  runLocalBulletQa,
  type BulletQaEvaluation,
} from '@/lib/ai/bullet-qa-validation'
import { shouldUseLocalFallback, unwrapAiError } from '@/lib/ai/errors'
import {
  AI_STREAM_MAX_RETRIES,
  assertDirectAiProviderConfigured,
  buildFreeProviderChain,
  KEYWORD_WEAVING_TEMPERATURE,
} from '@/lib/ai/provider'
import {
  buildFoundationalPivotUserPromptOverride,
  buildFoundationalPivotSnippet,
  type SkillWeavingStrategy,
} from '@/lib/resume/proprietary-skill-weaving'
import {
  buildSnippetForKeyword,
  type SnippetGenerationContext,
} from '@/lib/resume/skill-snippets'
import { REPHRASE_JOB_DESCRIPTION_MATCH_INSTRUCTION } from '@/lib/resume/exact-phrasing-auditor'
import { resumeSemanticallyMatchesSkill } from '@/lib/resume/semantic-keyword-match'
import { keywordsToTargetSkills } from '@/lib/resume/skill-extrapolation'
import { buildSkillAnchor, integrateSkillIntoBulletLocal } from '@/lib/resume/thematic-skill-anchor'
import {
  buildActiveSectionTailoringContext,
  parseStructuredResumeDocument,
} from '@/lib/resume/structured-resume-document'

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
  originalBullet?: string
  targetRoleTitle?: string
  targetCompany?: string
  placementLabel?: string
  domainLabel?: string
  modificationType?: 'inline-bullet' | 'skills-section' | 'summary'
  siblingBullets?: string[]
  weavingStrategy?: SkillWeavingStrategy
}

export interface TailorSnippetOptions {
  systemPrompt: string
}

export type TailorSnippetResult = TailorSnippetOutput

const CONVERSATIONAL_RESPONSE_PREFIX =
  /^(?:sure,?\s*)?(?:here(?:'s| is)|absolutely|certainly|of course)[!,.\s]*(?:(?:the|your|a|an)\s+)?(?:(?:rewritten|revised|updated|tailored|optimized)\s+)?(?:bullet(?:\s+point)?|line|summary|snippet|text|version)?\s*(?:is\s*)?[:\s]+/i

function truncateForPrompt(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength)}\n\n[truncated for length]`
}

/** @deprecated Use buildAtsKeywordInjectionSystemPrompt from ats-keyword-injection-directive instead. */
export function buildAtsTailoringSystemPrompt(options: {
  keywords: string
  template: string
  locationRule?: string
  candidateLocation?: string
  modificationType?: 'inline-bullet' | 'skills-section' | 'summary'
}): string {
  const base = options.template.replace('{keywords}', options.keywords)

  if (
    options.modificationType === 'summary' &&
    options.candidateLocation?.trim() &&
    options.locationRule
  ) {
    return `${base}\n${options.locationRule.replace('{location}', options.candidateLocation.trim())}`
  }

  return base
}

function normalizeSnippetOutput(text: string): string {
  return text
    .trim()
    .replace(/^[\s•\-*–—]+/, '')
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/^```[\s\S]*?\n|```$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Strip whitespace and conversational LLM wrappers before returning to the UI. */
export function stripTailoringResponse(text: string): string {
  let result = normalizeSnippetOutput(text)

  for (let pass = 0; pass < 3; pass += 1) {
    const stripped = result.replace(CONVERSATIONAL_RESPONSE_PREFIX, '').trim()
    if (stripped === result) break
    result = normalizeSnippetOutput(stripped)
  }

  return result
}

function buildResumeSectionObject(
  input: TailorSnippetInput,
  sectionContext: string
): Record<string, unknown> {
  const sectionType = input.modificationType ?? 'inline-bullet'
  const originalText = input.originalBullet?.trim() || input.currentSnippet.trim()

  return {
    sectionType,
    roleTitle: input.targetRoleTitle ?? null,
    company: input.targetCompany ?? null,
    placementLabel: input.placementLabel ?? null,
    domainLabel: input.domainLabel ?? null,
    originalText,
    structuralContext: sectionContext,
  }
}

function buildTailorSnippetPrompt(input: TailorSnippetInput, qaFeedback?: string): string {
  const pending = (input.otherSnippets ?? []).filter(Boolean).slice(0, 6)
  const previous = (input.previousVariations ?? []).filter(Boolean).slice(-4)
  const variationIndex = input.variationIndex ?? 0
  const matchedPhrases = (input.matchedJobDescriptionPhrases ?? []).filter(Boolean).slice(0, 4)
  const structured = parseStructuredResumeDocument(input.resumeText)
  const { sectionContext } = buildActiveSectionTailoringContext(structured, {
    modificationType: input.modificationType,
    targetRoleTitle: input.targetRoleTitle,
    targetCompany: input.targetCompany,
    currentSnippet: input.currentSnippet,
  })

  const roleSiblingBullets =
    input.siblingBullets ??
    structured.experience
      .find(
        (position) =>
          (input.targetCompany && position.company === input.targetCompany) ||
          (input.targetRoleTitle && position.title === input.targetRoleTitle)
      )
      ?.bullets.map((bullet) => bullet.text) ??
    []

  const resumeSectionObject = buildResumeSectionObject(input, sectionContext)
  const missingSkillBlock =
    input.weavingStrategy === 'foundational-pivot'
      ? buildFoundationalPivotUserPromptOverride(input.keyword)
      : `MISSING SKILL (must be indexable in modifiedText):
${input.keyword.trim()}

You MUST integrate the specific term "${input.keyword.trim()}" into the updated sentence structure. Do not return the sentence unchanged.`

  return `JOB DESCRIPTION:
${truncateForPrompt(input.jobDescription.trim(), 4000)}

${missingSkillBlock}

RESUME SECTION OBJECT:
${JSON.stringify(resumeSectionObject, null, 2)}

CURRENT DRAFT:
${input.currentSnippet.trim()}

OTHER BULLETS IN THIS ROLE (avoid duplicating openers):
${roleSiblingBullets.length ? roleSiblingBullets.map((line) => `- ${line}`).join('\n') : '(none)'}

OTHER PENDING REVISIONS (use different structures):
${pending.length > 0 ? pending.map((line) => `- ${line}`).join('\n') : '(none)'}

PREVIOUS VERSIONS OF THIS CARD (do not repeat):
${previous.length > 0 ? previous.map((line) => `- ${line}`).join('\n') : '(none)'}

VARIATION INDEX: ${variationIndex}
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
${qaFeedback ? `\n${qaFeedback}` : ''}

Return ONLY the JSON object with modifiedText and injectedKeywords.`
}

function temperatureForVariation(variationIndex: number): number {
  const bump = Math.min(variationIndex, 6) * 0.07
  return Math.min(KEYWORD_WEAVING_TEMPERATURE + bump, 0.85)
}

function parseModelTailorResponse(raw: string, input: TailorSnippetInput): TailorSnippetOutput {
  const missingSkill = input.keyword.trim()
  const structured = parseTailorSnippetModelOutput(raw)
  if (structured) {
    return enforceTailorSnippetOutput(
      structured,
      missingSkill,
      input.weavingStrategy,
      input.resumeText
    )
  }

  const plainText = stripTailoringResponse(raw)
  return tailorSnippetOutputFromPlainText(
    plainText,
    missingSkill,
    input.weavingStrategy,
    input.resumeText
  )
}

function ensureKeywordIndexed(
  output: TailorSnippetOutput,
  input: TailorSnippetInput
): TailorSnippetOutput {
  if (input.weavingStrategy === 'foundational-pivot') {
    if (output.injectedKeywords.length > 0) return output
  } else if (resumeSemanticallyMatchesSkill(output.modifiedText, input.keyword)) {
    return output
  }

  const skill =
    keywordsToTargetSkills([input.keyword])[0] ?? {
      term: input.keyword,
      category: 'domainTech' as const,
    }

  const sourceLine = input.originalBullet?.trim() || output.modifiedText
  for (let variant = 0; variant < 4; variant += 1) {
    const candidate =
      input.weavingStrategy === 'foundational-pivot'
        ? buildFoundationalPivotSnippet(
            {
              snippet: output.modifiedText,
              originalBullet: sourceLine,
              modificationType: input.modificationType,
            },
            input.resumeText
          )
        : integrateSkillIntoBulletLocal(sourceLine, skill, variant)
    const enforced = enforceTailorSnippetOutput(
      tailorSnippetOutputFromPlainText(
        candidate,
        input.keyword,
        input.weavingStrategy,
        input.resumeText
      ),
      input.keyword,
      input.weavingStrategy,
      input.resumeText
    )
    if (
      input.weavingStrategy === 'foundational-pivot'
        ? enforced.injectedKeywords.length > 0
        : resumeSemanticallyMatchesSkill(enforced.modifiedText, input.keyword)
    ) {
      return enforced
    }
  }

  return output
}

function tailorSnippetLocally(input: TailorSnippetInput): TailorSnippetOutput {
  if (input.weavingStrategy === 'foundational-pivot') {
    const snippet = buildFoundationalPivotSnippet(
      {
        snippet: input.currentSnippet,
        originalBullet: input.originalBullet,
        modificationType: input.modificationType,
      },
      input.resumeText
    )
    return enforceTailorSnippetOutput(
      tailorSnippetOutputFromPlainText(
        polishBulletLocally(snippet),
        input.keyword,
        input.weavingStrategy,
        input.resumeText
      ),
      input.keyword,
      input.weavingStrategy,
      input.resumeText
    )
  }

  const skill =
    keywordsToTargetSkills([input.keyword])[0] ?? {
      term: input.keyword,
      category: 'domainTech' as const,
    }

  let snippet: string
  if (input.originalBullet?.trim()) {
    const anchor = buildSkillAnchor(skill, input.resumeText)
    snippet = anchor.modifiedBullet
  } else {
    const context: SnippetGenerationContext = {
      resumeText: input.resumeText,
      jobDescription: input.jobDescription,
      siblingSnippets: [...(input.otherSnippets ?? []), ...(input.previousVariations ?? [])],
      variationIndex: input.variationIndex ?? 0,
    }
    snippet = buildSnippetForKeyword(input.keyword, context).snippet
  }

  const qa = runLocalBulletQa({
    candidateBullet: snippet,
    originalBullet: input.originalBullet,
    siblingBullets: input.siblingBullets,
    targetRoleTitle: input.targetRoleTitle,
    targetCompany: input.targetCompany,
    domainLabel: input.domainLabel,
    keyword: input.keyword,
    modificationType: input.modificationType,
  })

  if (!qa.passed && input.originalBullet?.trim()) {
    const fallbackSkill =
      keywordsToTargetSkills([input.keyword])[0] ?? {
        term: input.keyword,
        category: 'domainTech' as const,
      }
    for (let variant = 1; variant < 4; variant += 1) {
      const alternate = integrateSkillIntoBulletLocal(input.originalBullet, fallbackSkill, variant)
      const alternateQa = runLocalBulletQa({
        candidateBullet: alternate,
        originalBullet: input.originalBullet,
        siblingBullets: input.siblingBullets,
        targetRoleTitle: input.targetRoleTitle,
        targetCompany: input.targetCompany,
        domainLabel: input.domainLabel,
        keyword: input.keyword,
        modificationType: input.modificationType,
      })
      if (alternateQa.passed) {
        return enforceTailorSnippetOutput(
          tailorSnippetOutputFromPlainText(
            polishBulletLocally(alternate),
            input.keyword,
            input.weavingStrategy,
            input.resumeText
          ),
          input.keyword,
          input.weavingStrategy,
          input.resumeText
        )
      }
    }
  }

  return enforceTailorSnippetOutput(
    tailorSnippetOutputFromPlainText(
      polishBulletLocally(snippet),
      input.keyword,
      input.weavingStrategy,
      input.resumeText
    ),
    input.keyword,
    input.weavingStrategy,
    input.resumeText
  )
}

async function generateTailorSnippetDraft(
  input: TailorSnippetInput,
  systemPrompt: string,
  qaFeedback: string | undefined,
  variationBump: number
): Promise<TailorSnippetOutput> {
  const chain = buildFreeProviderChain()
  const prompt = buildTailorSnippetPrompt(input, qaFeedback)
  const variationIndex = (input.variationIndex ?? 0) + variationBump
  let lastError: unknown

  const resolvedSystemPrompt = input.rephraseJobDescriptionMatch
    ? `${systemPrompt}\n\n${REPHRASE_JOB_DESCRIPTION_MATCH_INSTRUCTION}`
    : systemPrompt

  for (let index = 0; index < chain.length; index += 1) {
    const entry = chain[index]!
    try {
      const result = await generateText({
        model: entry.model,
        system: resolvedSystemPrompt,
        prompt,
        temperature: temperatureForVariation(variationIndex),
        maxOutputTokens: 384,
        maxRetries: AI_STREAM_MAX_RETRIES,
        providerOptions: entry.providerOptions,
      })

      const parsed = parseModelTailorResponse(result.text, input)
      if (parsed.modifiedText.length >= 12) {
        return ensureKeywordIndexed(parsed, input)
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

export async function tailorSnippetWithAi(
  input: TailorSnippetInput,
  options: TailorSnippetOptions
): Promise<TailorSnippetResult> {
  assertDirectAiProviderConfigured()

  if (input.modificationType === 'skills-section') {
    const modifiedText = polishBulletLocally(stripTailoringResponse(input.currentSnippet))
    return enforceTailorSnippetOutput(
      tailorSnippetOutputFromPlainText(
        modifiedText,
        input.keyword,
        input.weavingStrategy,
        input.resumeText
      ),
      input.keyword,
      input.weavingStrategy,
      input.resumeText
    )
  }

  let initialDraft: TailorSnippetResult
  try {
    initialDraft = await generateTailorSnippetDraft(input, options.systemPrompt, undefined, 0)
  } catch {
    initialDraft = tailorSnippetLocally(input)
  }

  const qaContext = {
    candidateBullet: initialDraft.modifiedText,
    originalBullet: input.originalBullet,
    siblingBullets: input.siblingBullets,
    targetRoleTitle: input.targetRoleTitle,
    targetCompany: input.targetCompany,
    domainLabel: input.domainLabel,
    keyword: input.keyword,
    modificationType: input.modificationType,
  }

  const { bullet } = await runBulletQaPipeline(
    qaContext,
    async (feedback: BulletQaEvaluation | null, attempt) => {
      const qaSection = feedback ? buildQaFeedbackPromptSection(feedback) : undefined
      try {
        const draft = await generateTailorSnippetDraft(
          input,
          options.systemPrompt,
          qaSection,
          attempt
        )
        return draft.modifiedText
      } catch {
        return polishBulletLocally(tailorSnippetLocally(input).modifiedText)
      }
    }
  )

  const polished = stripTailoringResponse(bullet)
  return ensureKeywordIndexed(
    enforceTailorSnippetOutput(
      tailorSnippetOutputFromPlainText(
        polished,
        input.keyword,
        input.weavingStrategy,
        input.resumeText
      ),
      input.keyword,
      input.weavingStrategy,
      input.resumeText
    ),
    input
  )
}
