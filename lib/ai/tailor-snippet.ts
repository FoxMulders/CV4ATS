import { generateText } from 'ai'

import {
  buildQaFeedbackPromptSection,
  polishBulletLocally,
  runBulletQaPipeline,
  runLocalBulletQa,
  type BulletQaEvaluation,
} from '@/lib/ai/bullet-qa-validation'
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
import { REPHRASE_JOB_DESCRIPTION_MATCH_INSTRUCTION } from '@/lib/resume/exact-phrasing-auditor'
import { keywordsToTargetSkills } from '@/lib/resume/skill-extrapolation'
import { buildSkillAnchor, integrateSkillIntoBulletLocal } from '@/lib/resume/thematic-skill-anchor'
import {
  buildSanitizedTailoringContext,
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
}

const TAILOR_SNIPPET_SYSTEM = `You are an executive resume writer specializing in ATS-optimized resume edits.

Rewrite exactly ONE existing resume line by gracefully integrating a target skill into the candidate's real history.

STRICT RULES:
1. IN-LINE MODIFICATION — Do not create a brand-new bullet. Modify the provided original bullet/summary so the target skill is woven into the existing achievement naturally.
2. CONTEXTUAL AWARENESS — Preserve the employer, role, metrics, tools, and facts from the original line. Never invent employers, dates, or outcomes that are not supported by the resume.
3. EMPLOYER SANITIZATION — Use only the company name provided in THEMATIC PLACEMENT. Never use contact headers, email addresses, phone numbers, or raw date strings (e.g. "07/2024") as an employer.
4. TENSE & FLOW — Keep past tense for experience bullets with human-written action verbs (Led, Built, Delivered, Improved, Automated). The result must read like a polished revision, not an appended fragment.
5. JOB ALIGNMENT — Match the job's competency level semantically. Never copy multi-word fragments from the job description (more than 3 consecutive identical words fails compliance).
6. CONCISION — One sentence, max ~45 words, impact-driven.
7. OUTPUT — Return ONLY the rewritten line (no bullet symbol, quotes, markdown, labels, or commentary).

When a VARIATION instruction is present, produce wording clearly different from every listed previous version while keeping the same factual anchor.`

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

function buildTailorSnippetPrompt(input: TailorSnippetInput, qaFeedback?: string): string {
  const pending = (input.otherSnippets ?? []).filter(Boolean).slice(0, 12)
  const previous = (input.previousVariations ?? []).filter(Boolean).slice(-6)
  const variationIndex = input.variationIndex ?? 0
  const matchedPhrases = (input.matchedJobDescriptionPhrases ?? []).filter(Boolean).slice(0, 6)
  const originalLine = input.originalBullet?.trim() || input.currentSnippet.trim()
  const structured = parseStructuredResumeDocument(input.resumeText)
  const sanitizedExperience = buildSanitizedTailoringContext(structured)
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

  const bannedOpeners = openingPatterns([
    ...pending,
    ...previous,
    input.currentSnippet,
    originalLine,
  ])

  return `JOB DESCRIPTION (match tone and vocabulary):
${truncateForPrompt(input.jobDescription.trim(), 6000)}

SANITIZED EXPERIENCE CONTEXT (use these employers and bullets only — contact headers and date tokens excluded):
${truncateForPrompt(sanitizedExperience, 9000)}

CANDIDATE NAME (reference only — do not inject into bullet text):
${structured.contact.name}

TARGET KEYWORD / SKILL TO INTEGRATE:
${input.keyword.trim()}

THEMATIC PLACEMENT:
${input.placementLabel?.trim() || 'Most relevant historical role'}
${input.targetRoleTitle ? `- Role: ${input.targetRoleTitle}` : ''}
${input.targetCompany ? `- Company: ${input.targetCompany}` : ''}
${input.domainLabel ? `- Professional domain: ${input.domainLabel}` : ''}
${input.modificationType ? `- Edit type: ${input.modificationType}` : 'inline-bullet'}

OTHER BULLETS IN THIS ROLE (do not duplicate their opening verbs or rhythm):
${roleSiblingBullets.length ? roleSiblingBullets.map((line) => `- ${line}`).join('\n') : '(none)'}

ORIGINAL LINE TO REVISE (preserve facts, tense, and impact):
${originalLine}

CURRENT DRAFT REVISION (rewrite — do not copy its structure if variation is requested):
${input.currentSnippet.trim()}

OTHER PENDING REVISIONS FOR OTHER SKILLS (must use different structures and openers):
${pending.length > 0 ? pending.map((line) => `- ${line}`).join('\n') : '(none)'}

PREVIOUS VERSIONS OF THIS SAME CARD (do NOT repeat phrasing or structure):
${previous.length > 0 ? previous.map((line) => `- ${line}`).join('\n') : '(none)'}

OPENING PATTERNS TO AVOID (already used above):
${bannedOpeners || '(none)'}

VARIATION INDEX: ${variationIndex}
${variationIndex > 0 ? 'VARIATION MODE: Rephrase completely differently from the current draft and every previous version. Change the opening verb, clause order, and framing.' : 'INITIAL MODE: Produce the first distinct in-line revision for this card.'}
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

TASK:
Revise the ORIGINAL LINE so "${input.keyword.trim()}" is integrated naturally into the existing achievement for ${input.targetRoleTitle ? `${input.targetRoleTitle} at ${input.targetCompany ?? 'the listed employer'}` : 'the best-matched historical role'}. Return only the revised line.`
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

function temperatureForVariation(variationIndex: number): number {
  const bump = Math.min(variationIndex, 6) * 0.07
  return Math.min(AI_GENERATION_TEMPERATURE + bump, 0.85)
}

function tailorSnippetLocally(input: TailorSnippetInput): string {
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
    const skill =
      keywordsToTargetSkills([input.keyword])[0] ?? {
        term: input.keyword,
        category: 'domainTech' as const,
      }
    for (let variant = 1; variant < 4; variant += 1) {
      const alternate = integrateSkillIntoBulletLocal(input.originalBullet, skill, variant)
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
        return polishBulletLocally(alternate)
      }
    }
  }

  return polishBulletLocally(snippet)
}

async function generateTailorSnippetDraft(
  input: TailorSnippetInput,
  qaFeedback: string | undefined,
  variationBump: number
): Promise<string> {
  const chain = buildFreeProviderChain()
  const prompt = buildTailorSnippetPrompt(input, qaFeedback)
  const variationIndex = (input.variationIndex ?? 0) + variationBump
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

export async function tailorSnippetWithAi(input: TailorSnippetInput): Promise<string> {
  assertDirectAiProviderConfigured()

  if (input.modificationType === 'skills-section') {
    return polishBulletLocally(normalizeSnippetOutput(input.currentSnippet))
  }

  let initialDraft: string
  try {
    initialDraft = await generateTailorSnippetDraft(input, undefined, 0)
  } catch {
    initialDraft = tailorSnippetLocally(input)
  }

  const qaContext = {
    candidateBullet: initialDraft,
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
        return await generateTailorSnippetDraft(input, qaSection, attempt)
      } catch {
        return polishBulletLocally(tailorSnippetLocally(input))
      }
    }
  )

  return bullet
}
