import { z } from 'zod'

import { parseJsonFromModelText } from '@/lib/ai/normalize-output'
import {
  ANTI_COPY_CONSTRAINT,
  PHRASING_COMPLIANCE_WORD_LIMIT,
} from '@/lib/resume/exact-phrasing-auditor'
import {
  resumeContainsVerbatimTerm,
  resumeSemanticallyMatchesSkill,
} from '@/lib/resume/semantic-keyword-match'

export const tailorSnippetOutputSchema = z.object({
  modifiedText: z.string().min(1),
  injectedKeywords: z.array(z.string().min(1)),
})

export type TailorSnippetOutput = z.infer<typeof tailorSnippetOutputSchema>

/**
 * Strong semantic equivalents that remain visible to regex / word-boundary tokenizers.
 * Vague paraphrases (e.g. "hosted environments" for "cloud") are intentionally excluded.
 */
export const INDEXABLE_SEMANTIC_EQUIVALENTS: Record<string, readonly string[]> = {
  cloud: ['cloud', 'cloud-based', 'cloud computing', 'AWS', 'Azure', 'GCP', 'Google Cloud'],
  devops: ['DevOps', 'CI/CD', 'continuous integration', 'continuous delivery'],
  agile: ['Agile', 'Scrum', 'Kanban'],
  kubernetes: ['Kubernetes', 'K8s', 'container orchestration'],
  automation: ['automation', 'automated', 'RPA'],
  security: ['security', 'cybersecurity', 'InfoSec', 'information security'],
  'machine learning': ['machine learning', 'ML', 'deep learning'],
  'artificial intelligence': ['artificial intelligence', 'AI', 'generative AI'],
}

export function getIndexableEquivalents(missingSkill: string): string[] {
  const trimmed = missingSkill.trim()
  const normalized = trimmed.toLowerCase()
  const equivalents = INDEXABLE_SEMANTIC_EQUIVALENTS[normalized] ?? []
  const seen = new Set<string>()

  return [trimmed, ...equivalents].filter((term) => {
    const key = term.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export const ATS_KEYWORD_INJECTION_DIRECTIVE = `You are an ATS resume tailoring engine. Rewrite ONE resume structural node so a missing job skill becomes indexable by standard regex and string tokenizers.

## Inputs (provided in the user message)
1. **JOB DESCRIPTION** — competency context only; never copy phrasing from it.
2. **MISSING SKILL** — the exact scoring token that must become findable in the output.
3. **RESUME SECTION OBJECT** — the targeted structural node (e.g., work-experience bullet, summary line, skills entry) including role context and original text.

## Keyword injection (mandatory)
- Inject the MISSING SKILL verbatim OR one of its approved indexable equivalents into the **action verb phrase** or **measurable outcome clause** of the line — not as a trailing tag or awkward append.
- Approved equivalents must remain tokenizer-visible contiguous tokens (e.g., missing skill "cloud" → "cloud", "cloud-based", "AWS", "Azure"; NOT vague substitutes like "hosted environments" alone).
- The injected token must appear as an exact contiguous substring inside modifiedText so ATS stem matchers (word-boundary regex) can index it.

## Output format
Return ONLY valid JSON — no markdown fences, labels, or commentary:
{"modifiedText":"<rewritten line, plain text, max 2 sentences>","injectedKeywords":["<exact substring copied character-for-character from modifiedText>"]}

Rules for injectedKeywords:
- List every exact substring from modifiedText that satisfies the MISSING SKILL for ATS matching.
- Each entry MUST appear verbatim inside modifiedText (case-sensitive copy from modifiedText).
- At least one entry is required when a missing skill was requested.

## Structural node rules
- Preserve factual scope — same employer, role, metrics, and timeframe implied by the original line.
- Experience bullets: active past-tense verbs; prefer metric-driven X→Y→Z framing when credible.
- Never alter company names, titles, dates, or invent achievements.

## Anti-plagiarism guardrails
${ANTI_COPY_CONSTRAINT}

Hard limit: never reproduce ${PHRASING_COMPLIANCE_WORD_LIMIT}+ consecutive words from the job description. Competency tokens, tool names, and methodology labels may appear verbatim when grounded in the candidate's experience.`

export const ATS_SUMMARY_LOCATION_RULE = `When editing the professional summary, naturally weave the candidate location "{location}" into the narrative when it strengthens local market fit — never as a standalone address line.`

export function buildAtsKeywordInjectionSystemPrompt(options: {
  missingSkill: string
  modificationType?: 'inline-bullet' | 'skills-section' | 'summary'
  candidateLocation?: string
}): string {
  const equivalents = getIndexableEquivalents(options.missingSkill)
  const equivalentHint =
    equivalents.length > 1
      ? `\n\nApproved indexable equivalents for "${options.missingSkill}": ${equivalents.join(', ')}`
      : ''

  let prompt = `${ATS_KEYWORD_INJECTION_DIRECTIVE}${equivalentHint}

You MUST integrate the specific term "${options.missingSkill.trim()}" into the updated sentence structure. Do not return the sentence unchanged.`

  if (
    options.modificationType === 'summary' &&
    options.candidateLocation?.trim()
  ) {
    prompt += `\n\n${ATS_SUMMARY_LOCATION_RULE.replace('{location}', options.candidateLocation.trim())}`
  }

  return prompt
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Extract approved keyword substrings that appear verbatim in the modified line. */
export function extractInjectedKeywordsFromText(
  modifiedText: string,
  missingSkill: string
): string[] {
  const candidates = getIndexableEquivalents(missingSkill)
  const found: string[] = []
  const seen = new Set<string>()

  for (const candidate of candidates) {
    const pattern = new RegExp(escapeRegExp(candidate), 'i')
    const match = modifiedText.match(pattern)
    if (!match) continue

    const exact = match[0]
    const key = exact.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    found.push(exact)
  }

  if (found.length === 0 && resumeContainsVerbatimTerm(modifiedText, missingSkill)) {
    const pattern = new RegExp(escapeRegExp(missingSkill.trim()), 'i')
    const match = modifiedText.match(pattern)
    if (match) found.push(match[0])
  }

  return found
}

export function parseTailorSnippetModelOutput(raw: string): TailorSnippetOutput | null {
  try {
    const parsed = parseJsonFromModelText(raw)
    return tailorSnippetOutputSchema.parse(parsed)
  } catch {
    return null
  }
}

/** Normalize LLM JSON output and guarantee at least one indexable keyword injection. */
export function enforceTailorSnippetOutput(
  output: TailorSnippetOutput,
  missingSkill: string
): TailorSnippetOutput {
  const modifiedText = output.modifiedText.replace(/\s+/g, ' ').trim()
  const verified = output.injectedKeywords.filter((keyword) =>
    modifiedText.includes(keyword)
  )
  const extracted =
    verified.length > 0
      ? verified
      : extractInjectedKeywordsFromText(modifiedText, missingSkill)

  if (extracted.length > 0 && resumeSemanticallyMatchesSkill(modifiedText, missingSkill)) {
    return { modifiedText, injectedKeywords: extracted }
  }

  return { modifiedText, injectedKeywords: extracted }
}

export function tailorSnippetOutputFromPlainText(
  plainText: string,
  missingSkill: string
): TailorSnippetOutput {
  const modifiedText = plainText.replace(/\s+/g, ' ').trim()
  return enforceTailorSnippetOutput(
    {
      modifiedText,
      injectedKeywords: extractInjectedKeywordsFromText(modifiedText, missingSkill),
    },
    missingSkill
  )
}
