import { generateText, Output } from 'ai'
import { z } from 'zod'

import { shouldUseLocalFallback, unwrapAiError } from '@/lib/ai/errors'
import {
  AI_GENERATION_TEMPERATURE,
  AI_STREAM_MAX_RETRIES,
  buildFreeProviderChain,
} from '@/lib/ai/provider'

export interface BulletQaContext {
  candidateBullet: string
  originalBullet?: string
  /** Other bullets in the same role or pending revisions — used to detect repetitive openers. */
  siblingBullets?: string[]
  targetRoleTitle?: string
  targetCompany?: string
  domainLabel?: string
  keyword?: string
  modificationType?: 'inline-bullet' | 'skills-section' | 'summary'
}

export interface BulletQaEvaluation {
  professorPass: boolean
  writerPass: boolean
  passed: boolean
  issues: string[]
  regenerationGuidance: string
  source: 'local' | 'ai'
}

const MAX_QA_REGENERATION_ATTEMPTS = 4

const WEAK_OPENERS =
  /^(helped|assisted|participated|worked|was responsible|responsible for|involved in|supported|handled)\b/i

const FILLER_PHRASES = [
  'in order to',
  'responsible for',
  'various different',
  'successfully successfully',
  'utilize',
  'leverage leverage',
  'on a daily basis',
  'etc.',
]

const PRESENT_TENSE_START =
  /^(is|are|am|be|being|help|helps|helping|manage|manages|managing|lead|leads|leading|work|works|working|develop|develops|developing|support|supports|supporting)\b/i

const METRIC_PATTERN =
  /\b\d+\+?\s*(%|percent|hours|days|weeks|months|years|users|clients|teams|projects|releases|tickets|dollars|\$|k|m)\b|\b\d+\+?\b/i

const IMPACT_PATTERN =
  /\b(reduc|increas|improv|eliminat|accelerat|optimiz|streamlin|automat|deliver|achiev|save|cut|boost|enhanc)/i

const EXECUTIVE_FRAMEWORKS = /\b(enterprise[- ]wide|portfolio[- ]level|c[- ]?suite|executive steering|P&L|org[- ]wide transformation)\b/i

const TECH_FRAMEWORKS = /\b(agile|scrum|kanban|aws|azure|gcp|devops|ci\/cd|itil|safe)\b/i

const JUNIOR_TITLE_PATTERN =
  /\b(analyst|associate|coordinator|specialist|support|assistant|intern|junior|entry)\b/i

const bulletQaSchema = z.object({
  professorPass: z.boolean(),
  writerPass: z.boolean(),
  issues: z.array(z.string()),
  regenerationGuidance: z.string(),
})

const QA_EVALUATOR_SYSTEM = `You are running a dual-persona QA review on ONE resume bullet line.

Evaluate the CANDIDATE BULLET against BOTH checklists below. Be strict but fair — the bullet must pass BOTH personas to approve.

A) ENGLISH PROFESSOR (Syntax & Mechanics):
- No repetitive opener vs sibling bullets (same first verb or same 4-word opening rhythm).
- Historical experience bullets use active past-tense verbs (Led, Built, Delivered — not "Helping", "Responsible for", present tense).
- No wordiness, filler, or clumsy appended fragments.

B) EXECUTIVE RESUME WRITER (Impact & Marketability):
- Prefer X-Y-Z structure: Accomplished [X], as measured by [Y], by doing [Z]. A metric or concrete outcome strengthens the bullet.
- Scope must match role seniority — do not claim enterprise-wide executive scope for analyst/associate titles.
- Upgrade weak verbs (Helped, Worked on, Responsible for) to high-impact verbs when credible (Orchestrated, Architected, Spearheaded, Synthesized, Automated).

Return JSON only with: professorPass, writerPass, issues (array of short strings), regenerationGuidance (actionable rewrite instructions if either failed).`

function openingVerb(text: string): string {
  const cleaned = text
    .trim()
    .replace(/^[\s•\-*–—]+/, '')
    .replace(/^(at\s+[^,]+,\s*)/i, '')
  const firstWord = cleaned.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '') ?? ''
  return firstWord
}

function openingRhythm(text: string): string {
  return text
    .trim()
    .replace(/^[\s•\-*–—]+/, '')
    .split(/\s+/)
    .slice(0, 4)
    .join(' ')
    .toLowerCase()
}

function runProfessorHeuristics(context: BulletQaContext): string[] {
  const issues: string[] = []
  const bullet = context.candidateBullet.trim()
  if (!bullet) return ['Bullet is empty.']

  const opener = openingVerb(bullet)
  const rhythm = openingRhythm(bullet)

  for (const sibling of context.siblingBullets ?? []) {
    if (!sibling.trim()) continue
    if (openingVerb(sibling) === opener && opener.length > 2) {
      issues.push(`Repeats the same opening verb "${opener}" as another bullet in this role.`)
      break
    }
    if (openingRhythm(sibling) === rhythm && rhythm.split(' ').length >= 3) {
      issues.push('Uses the same opening rhythm as a sibling bullet in this role.')
      break
    }
  }

  if (context.modificationType !== 'summary' && PRESENT_TENSE_START.test(bullet)) {
    issues.push('Historical bullet should start with an active past-tense verb, not present tense.')
  }

  if (WEAK_OPENERS.test(bullet)) {
    issues.push('Opens with a weak or passive phrase instead of a strong past-tense action verb.')
  }

  for (const filler of FILLER_PHRASES) {
    if (bullet.toLowerCase().includes(filler)) {
      issues.push(`Contains filler or weak phrasing ("${filler}").`)
    }
  }

  if (bullet.length > 220) {
    issues.push('Bullet is too long — tighten to one crisp impact sentence.')
  }

  if (/,\s*(applying|leveraging|incorporating|while exercising)\s+[^,]+,\s*(applying|leveraging)/i.test(bullet)) {
    issues.push('Reads like a clumsy double-appended keyword fragment — integrate the skill once, naturally.')
  }

  return issues
}

function runWriterHeuristics(context: BulletQaContext): string[] {
  const issues: string[] = []
  const bullet = context.candidateBullet.trim()
  if (!bullet) return ['Bullet is empty.']

  if (WEAK_OPENERS.test(bullet)) {
    issues.push('Replace weak verbs (Helped, Worked, Responsible for) with high-impact past-tense verbs.')
  }

  const hasMetric = METRIC_PATTERN.test(bullet)
  const hasImpact = IMPACT_PATTERN.test(bullet)
  if (!hasMetric && !hasImpact && context.modificationType === 'inline-bullet') {
    issues.push('Missing measurable outcome or clear result — strengthen using X-Y-Z (result + action).')
  }

  const title = context.targetRoleTitle ?? ''
  if (title && JUNIOR_TITLE_PATTERN.test(title) && EXECUTIVE_FRAMEWORKS.test(bullet)) {
    issues.push('Executive-level scope language does not match the seniority of this historical role.')
  }

  if (title && JUNIOR_TITLE_PATTERN.test(title) && TECH_FRAMEWORKS.test(bullet)) {
    const original = context.originalBullet ?? ''
    if (!TECH_FRAMEWORKS.test(original) && TECH_FRAMEWORKS.test(bullet)) {
      issues.push(
        'Introduced a senior technical framework not supported by the original bullet — keep scope credible.'
      )
    }
  }

  if (/\bwhile exercising\b.*\bwhile exercising\b/i.test(bullet)) {
    issues.push('Redundant competency phrasing — merge into one natural clause.')
  }

  return issues
}

export function runLocalBulletQa(context: BulletQaContext): BulletQaEvaluation {
  const professorIssues = runProfessorHeuristics(context)
  const writerIssues = runWriterHeuristics(context)
  const issues = [...professorIssues, ...writerIssues]

  return {
    professorPass: professorIssues.length === 0,
    writerPass: writerIssues.length === 0,
    passed: issues.length === 0,
    issues,
    regenerationGuidance: issues.join(' '),
    source: 'local',
  }
}

function buildQaEvaluationPrompt(context: BulletQaContext): string {
  const siblings = (context.siblingBullets ?? []).filter(Boolean).slice(0, 8)

  return `TARGET ROLE: ${context.targetRoleTitle ?? 'Unknown'} at ${context.targetCompany ?? 'Unknown'}
DOMAIN: ${context.domainLabel ?? 'General'}
KEYWORD INTEGRATED: ${context.keyword ?? '(none)'}
EDIT TYPE: ${context.modificationType ?? 'inline-bullet'}

ORIGINAL LINE:
${context.originalBullet?.trim() || '(none)'}

SIBLING BULLETS IN SAME ROLE (avoid matching their openers/rhythm):
${siblings.length ? siblings.map((line) => `- ${line}`).join('\n') : '(none)'}

CANDIDATE BULLET TO EVALUATE:
${context.candidateBullet.trim()}`
}

async function evaluateBulletWithAiQa(context: BulletQaContext): Promise<BulletQaEvaluation | null> {
  const chain = buildFreeProviderChain()
  if (chain.length === 0) return null

  const prompt = buildQaEvaluationPrompt(context)

  for (const entry of chain) {
    try {
      const result = await generateText({
        model: entry.model,
        system: QA_EVALUATOR_SYSTEM,
        prompt,
        temperature: 0.1,
        maxOutputTokens: 512,
        maxRetries: AI_STREAM_MAX_RETRIES,
        providerOptions: entry.providerOptions,
        output: Output.object({
          schema: bulletQaSchema,
          name: 'BulletQaEvaluation',
        }),
      })

      const parsed = bulletQaSchema.parse(result.output)
      return {
        professorPass: parsed.professorPass,
        writerPass: parsed.writerPass,
        passed: parsed.professorPass && parsed.writerPass,
        issues: parsed.issues,
        regenerationGuidance: parsed.regenerationGuidance,
        source: 'ai',
      }
    } catch (error) {
      if (shouldUseLocalFallback(unwrapAiError(error))) {
        continue
      }
      break
    }
  }

  return null
}

export function buildQaFeedbackPromptSection(evaluation: BulletQaEvaluation): string {
  if (evaluation.passed) return ''

  const failedPersonas = [
    !evaluation.professorPass ? 'English Professor (syntax & mechanics)' : null,
    !evaluation.writerPass ? 'Executive Resume Writer (impact & marketability)' : null,
  ].filter(Boolean)

  return `
QA REVISION REQUIRED — previous draft failed: ${failedPersonas.join(' AND ')}
Issues detected:
${evaluation.issues.map((issue) => `- ${issue}`).join('\n') || '- See guidance below'}

Regeneration guidance:
${evaluation.regenerationGuidance}

Rewrite to pass BOTH QA personas. Change the opening verb and rhythm if needed. Preserve facts from the original line.`
}

function polishBulletLocally(bullet: string): string {
  let polished = bullet.trim()

  polished = polished.replace(/^helped\b/i, 'Supported')
  polished = polished.replace(/^assisted\b/i, 'Partnered with teams to')
  polished = polished.replace(/^was responsible for\b/i, 'Owned')
  polished = polished.replace(/^responsible for\b/i, 'Delivered')
  polished = polished.replace(/^worked on\b/i, 'Built')
  polished = polished.replace(/^participated in\b/i, 'Contributed to')
  polished = polished.replace(/\bin order to\b/gi, 'to')
  polished = polished.replace(/\s{2,}/g, ' ').trim()

  if (polished && !/[.!?]$/.test(polished)) {
    polished = `${polished}.`
  }

  return polished
}

export interface BulletQaPipelineOptions {
  /** Skip AI evaluator when local checks already pass (still runs AI on final attempt). */
  preferLocalFirst?: boolean
  maxAttempts?: number
}

/**
 * Run local + AI dual-persona QA on a bullet. Returns the best passing candidate or the
 * most recently polished draft after exhausting regeneration attempts.
 */
export async function runBulletQaPipeline(
  context: BulletQaContext,
  regenerate: (feedback: BulletQaEvaluation | null, attempt: number) => Promise<string>,
  options: BulletQaPipelineOptions = {}
): Promise<{ bullet: string; evaluation: BulletQaEvaluation; attempts: number }> {
  const maxAttempts = options.maxAttempts ?? MAX_QA_REGENERATION_ATTEMPTS
  let candidate = polishBulletLocally(context.candidateBullet)
  let lastEvaluation = runLocalBulletQa({ ...context, candidateBullet: candidate })
  let bestCandidate = candidate
  let bestIssueCount = lastEvaluation.issues.length

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const localEval = runLocalBulletQa({ ...context, candidateBullet: candidate })
    lastEvaluation = localEval

    let aiEval: BulletQaEvaluation | null = null
    const shouldRunAi =
      !localEval.passed || attempt === maxAttempts - 1 || attempt >= 1

    if (shouldRunAi) {
      aiEval = await evaluateBulletWithAiQa({ ...context, candidateBullet: candidate })
      if (aiEval) {
        lastEvaluation = {
          ...aiEval,
          issues: [...new Set([...localEval.issues, ...aiEval.issues])],
          passed: localEval.passed && aiEval.passed,
          professorPass: localEval.professorPass && aiEval.professorPass,
          writerPass: localEval.writerPass && aiEval.writerPass,
          regenerationGuidance: aiEval.regenerationGuidance || localEval.regenerationGuidance,
        }
      }
    }

    if (lastEvaluation.passed) {
      return { bullet: candidate, evaluation: lastEvaluation, attempts: attempt + 1 }
    }

    if (lastEvaluation.issues.length < bestIssueCount) {
      bestIssueCount = lastEvaluation.issues.length
      bestCandidate = candidate
    }

    if (attempt >= maxAttempts - 1) break

    candidate = polishBulletLocally(
      await regenerate(lastEvaluation, attempt + 1)
    )
  }

  const finalEval = runLocalBulletQa({ ...context, candidateBullet: bestCandidate })
  return { bullet: bestCandidate, evaluation: finalEval, attempts: maxAttempts }
}

export { MAX_QA_REGENERATION_ATTEMPTS, polishBulletLocally, runProfessorHeuristics, runWriterHeuristics }
