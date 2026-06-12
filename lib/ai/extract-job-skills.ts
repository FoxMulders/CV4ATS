import { generateText, NoObjectGeneratedError, Output } from 'ai'

import {
  buildJobSkillExtractionUserPrompt,
  JOB_SKILL_EXTRACTION_SYSTEM_PROMPT,
} from '@/lib/ai/job-skill-extraction-prompts'
import {
  jobSkillExtractionResultSchema,
  type ExtractedJobSkill,
  type ExtractedSkillClass,
  type JobSkillExtractionResult,
} from '@/lib/ai/job-skill-extraction-schemas'
import { parseJsonFromModelText } from '@/lib/ai/normalize-output'
import { shouldUseLocalFallback, unwrapAiError } from '@/lib/ai/errors'
import {
  AI_STREAM_MAX_RETRIES,
  assertDirectAiProviderConfigured,
  buildFreeProviderChain,
  KEYWORD_WEAVING_TEMPERATURE,
} from '@/lib/ai/provider'
import {
  classifySkillPriorityTier,
  extractFoundationalSkillsFromText,
  isFoundationalSkillTerm,
  isProprietaryPlatformTerm,
} from '@/lib/resume/skill-priority'
import {
  categorizeSkill,
  extrapolateTargetSkills,
  type SkillPriorityTier,
  type TargetSkill,
} from '@/lib/resume/skill-extrapolation'
import { phraseWithoutStopWords, tokenize } from '@/lib/resume/stopwords'

const STRUCTURED_EXTRACTION = Output.object({
  schema: jobSkillExtractionResultSchema,
  name: 'JobSkillExtraction',
  description: 'Job description skills split into core methodologies and desirable proprietary tools.',
})

function normalizeTerm(term: string): string {
  return tokenize(phraseWithoutStopWords(term)).join(' ')
}

function resolveSkillClass(entry: ExtractedJobSkill): ExtractedSkillClass {
  if (entry.skillClass) return entry.skillClass

  if (entry.tier === 'desirable' || isProprietaryPlatformTerm(entry.term)) {
    return 'vendorSpecific'
  }

  if (isFoundationalSkillTerm(entry.term)) return 'foundational'
  return 'methodology'
}

function priorityTierForSkillClass(skillClass: ExtractedSkillClass): SkillPriorityTier {
  return skillClass === 'vendorSpecific' || skillClass === 'preferred' ? 'desirable' : 'core'
}

function toTargetSkill(term: string, tier: SkillPriorityTier): TargetSkill | null {
  const normalized = normalizeTerm(term)
  if (!normalized) return null

  return {
    term: normalized,
    category: categorizeSkill(normalized),
    priorityTier: tier,
  }
}

function addTargetSkill(
  skills: TargetSkill[],
  term: string,
  skillClass: ExtractedSkillClass
): void {
  const tier = priorityTierForSkillClass(skillClass)
  const skill = toTargetSkill(term, tier)
  if (!skill) return

  const existingIndex = skills.findIndex(
    (entry) => normalizeTerm(entry.term) === normalizeTerm(skill.term)
  )
  if (existingIndex < 0) {
    skills.push(skill)
    return
  }

  if (skills[existingIndex]!.priorityTier === 'desirable' && tier === 'core') {
    skills[existingIndex] = { ...skill, priorityTier: 'core' }
  }
}

function mergeTargetSkills(primary: TargetSkill[], secondary: TargetSkill[]): TargetSkill[] {
  const byTerm = new Map<string, TargetSkill>()

  for (const skill of [...primary, ...secondary]) {
    const key = normalizeTerm(skill.term)
    if (!key) continue

    const existing = byTerm.get(key)
    if (!existing) {
      byTerm.set(key, skill)
      continue
    }

    if (existing.priorityTier === 'desirable' && skill.priorityTier === 'core') {
      byTerm.set(key, { ...skill, priorityTier: 'core' })
    }
  }

  return [...byTerm.values()]
}

/** Map structured LLM extraction output to weighted target skills (exported for tests). */
export function mapJobSkillExtractionResult(result: JobSkillExtractionResult): TargetSkill[] {
  const skills: TargetSkill[] = []

  for (const entry of result.coreMethodologies) {
    const skillClass = resolveSkillClass(entry)

    if (skillClass === 'vendorSpecific' || skillClass === 'preferred' || isProprietaryPlatformTerm(entry.term)) {
      addTargetSkill(skills, entry.term, 'vendorSpecific')
      const equivalent = entry.functionalEquivalent?.trim()
      if (equivalent && !isProprietaryPlatformTerm(equivalent)) {
        addTargetSkill(skills, equivalent, isFoundationalSkillTerm(equivalent) ? 'foundational' : 'methodology')
      }
      continue
    }

    addTargetSkill(skills, entry.term, skillClass)

    const equivalent = entry.functionalEquivalent?.trim()
    if (equivalent && !isProprietaryPlatformTerm(equivalent)) {
      addTargetSkill(
        skills,
        equivalent,
        isFoundationalSkillTerm(equivalent) ? 'foundational' : 'methodology'
      )
    }
  }

  for (const entry of result.desirablePreferred) {
    const skillClass = resolveSkillClass(entry)
    addTargetSkill(skills, entry.term, skillClass)

    const equivalent = entry.functionalEquivalent?.trim()
    if (equivalent && !isProprietaryPlatformTerm(equivalent)) {
      addTargetSkill(
        skills,
        equivalent,
        isFoundationalSkillTerm(equivalent) ? 'foundational' : 'methodology'
      )
    }
  }

  return skills
}

function parseLlmExtraction(raw: string): JobSkillExtractionResult | null {
  try {
    return jobSkillExtractionResultSchema.parse(parseJsonFromModelText(raw))
  } catch {
    return null
  }
}

async function extractJobSkillsWithLlm(
  jobDescription: string,
  options: JobSkillExtractionOptions = {}
): Promise<TargetSkill[] | null> {
  assertDirectAiProviderConfigured()
  const chain = buildFreeProviderChain()
  let lastError: unknown

  for (let index = 0; index < chain.length; index += 1) {
    const entry = chain[index]!
    try {
      const result = await generateText({
        model: entry.model,
        system: JOB_SKILL_EXTRACTION_SYSTEM_PROMPT,
        prompt: buildJobSkillExtractionUserPrompt(jobDescription, {
          employerName: options.employerName,
        }),
        temperature: KEYWORD_WEAVING_TEMPERATURE,
        maxOutputTokens: 1024,
        maxRetries: AI_STREAM_MAX_RETRIES,
        output: STRUCTURED_EXTRACTION,
        providerOptions: entry.providerOptions,
      })

      const parsed = result.output ?? parseLlmExtraction(result.text)
      if (!parsed) {
        throw new Error('LLM skill extraction returned empty output.')
      }

      return mapJobSkillExtractionResult(parsed)
    } catch (error) {
      lastError = error
      const root = unwrapAiError(error)
      if (NoObjectGeneratedError.isInstance(root) && root.text) {
        const recovered = parseLlmExtraction(root.text)
        if (recovered) {
          return mapJobSkillExtractionResult(recovered)
        }
      }

      const hasNext = index < chain.length - 1
      if (hasNext && shouldUseLocalFallback(root)) {
        continue
      }
      break
    }
  }

  if (shouldUseLocalFallback(lastError)) {
    return null
  }

  throw lastError instanceof Error ? lastError : new Error('Failed to extract job skills with AI.')
}

function applyHeuristicPriorityTiers(skills: TargetSkill[], jobDescription: string): TargetSkill[] {
  const foundational = extractFoundationalSkillsFromText(jobDescription).map((term) =>
    toTargetSkill(term, 'core')
  ).filter(Boolean) as TargetSkill[]

  const classified = skills.map((skill) => ({
    ...skill,
    priorityTier: classifySkillPriorityTier(skill.term),
  }))

  return mergeTargetSkills(classified, foundational)
}

export type JobSkillExtractionOptions = {
  /** Attempt LLM parsing during ingestion (falls back to rule-based extraction). */
  useLlm?: boolean
  /** Hiring company — demotes the employer's own product brands from core scoring. */
  employerName?: string
}

/**
 * Step 3 ingestion: extract JD target skills with vendor/brand separation and priority tiers.
 */
export async function extractTargetSkillsFromJobDescription(
  jobDescription: string,
  options: JobSkillExtractionOptions = {}
): Promise<TargetSkill[]> {
  const heuristic = applyHeuristicPriorityTiers(extrapolateTargetSkills(jobDescription), jobDescription)

  if (!options.useLlm) {
    return heuristic
  }

  try {
    const llmSkills = await extractJobSkillsWithLlm(jobDescription, options)
    if (!llmSkills?.length) {
      return heuristic
    }

    return applyHeuristicPriorityTiers(mergeTargetSkills(llmSkills, heuristic), jobDescription)
  } catch {
    return heuristic
  }
}

/** Synchronous rule-based extraction with priority tiers — used by debounced pre-scan. */
export function extractTargetSkillsFromJobDescriptionSync(jobDescription: string): TargetSkill[] {
  return applyHeuristicPriorityTiers(extrapolateTargetSkills(jobDescription), jobDescription)
}

export { extrapolateTargetSkills } from '@/lib/resume/skill-extrapolation'
