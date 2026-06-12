import { generateTailoredResumeLocally } from '@/lib/ai/local-fallback'
import type { AiGenerationResult } from '@/lib/ai/schemas'
import { applyKeywordImprovementsToDraft } from '@/lib/api/apply-keyword-improvements'
import { normalizeGenerationDraftForApi } from '@/lib/api/normalize-generation-draft'
import { BROWSER_NANO_RESUME_BLOCKS } from '@/lib/ai/resume-block-schema-directive'
import { LOCAL_ON_DEVICE_RESUME_DIRECTIVE } from '@/lib/resume/local-on-device-resume-engine'
import { promptBrowserAi } from '@/lib/ai/browser/chrome-language-model'
import {
  extractCoverLetterFromModelOutput,
  extractSummaryFromModelOutput,
  modelOutputLooksLikeCommentary,
  modelSummaryLooksInvalid,
} from '@/lib/ai/sanitize-model-output'
import { buildAtsComparison, serializeTailoredResume } from '@/lib/resume/ats-score'
import { auditCoverLetterCompliance } from '@/lib/resume/cover-letter-compliance'
import { extractCleanJobContext } from '@/lib/resume/extract-job-title'
import { runSkillExtrapolationAndInjection, type PreScanResult } from '@/lib/resume/pre-scan-preparation'

export type BrowserGenerationResult = AiGenerationResult & {
  keywordReport: ReturnType<typeof buildAtsComparison>['keywordReport']
  baselineKeywordReport: ReturnType<typeof buildAtsComparison>['baselineKeywordReport']
  incorporatedKeywords: string[]
  preScan: PreScanResult
  rawKeywordScore: number
}

const COVER_SYSTEM = `${BROWSER_NANO_RESUME_BLOCKS}

${LOCAL_ON_DEVICE_RESUME_DIRECTIVE}

You rewrite cover letters for ATS job applications. Rules:
- Plain text only, professional letter format with contact header, salutation, 3 short body paragraphs, closing.
- No banned clichés: "I am writing to express", "Throughout my career", "I am eager to bring", "partnered closely with", "Furthermore", "Passionate about", "Dear Hiring Team".
- Name the target role from the job description in paragraph 1.
- Include quantified proof only when present in the resume text — never invent metrics.
- Return ONLY the cover letter text. No markdown, no bold, no code fences, no "Key Changes" section, no explanations.`

const SUMMARY_SYSTEM = `${BROWSER_NANO_RESUME_BLOCKS}

${LOCAL_ON_DEVICE_RESUME_DIRECTIVE}

You rewrite resume professional summaries for ATS. Rules:
- 2 sentences max: executive value proposition + core expertise pipe line (Core Expertise: A | B | C).
- No first person. No cliché openers. Ground every claim in the source resume.
- Return ONLY the summary text — no markdown, no headings, no analysis, no commentary.`

function finalizeBrowserSummary(polished: string, fallback: string): string {
  const cleaned = extractSummaryFromModelOutput(polished)

  if (
    cleaned.length < 40 ||
    modelSummaryLooksInvalid(polished) ||
    modelSummaryLooksInvalid(cleaned)
  ) {
    return fallback
  }

  return cleaned
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return `${text.slice(0, max)}\n[truncated]`
}

async function polishCoverLetterWithBrowserAi(
  coverLetter: string,
  jobDescription: string,
  resumeText: string,
  candidateName: string,
  coverLetterContext?: string
): Promise<string> {
  const { jobTitle, companyName } = extractCleanJobContext(jobDescription)
  const contextBlock = coverLetterContext?.trim()
    ? `\nUSER COVER LETTER CONTEXT (ground truth — weave naturally; do not invent beyond this and the resume):\n${truncate(coverLetterContext.trim(), 2000)}\n`
    : ''

  return promptBrowserAi(
    COVER_SYSTEM,
    `CLEAN JOB CONTEXT (use exactly — do not parse JD headers into prose):
- candidateName: "${candidateName}"
- jobTitle: "${jobTitle}"
- companyName: "${companyName ?? 'the hiring company'}"
${contextBlock}
JOB DESCRIPTION:
${truncate(jobDescription, 6000)}

SOURCE RESUME:
${truncate(resumeText, 8000)}

CURRENT COVER LETTER (rewrite completely — fix banned phrases, use clean job context):
${truncate(coverLetter, 5000)}`
  )
}

function finalizeBrowserCoverLetter(polished: string, fallback: string): string {
  const cleaned = extractCoverLetterFromModelOutput(polished)

  if (
    cleaned.length < 120 ||
    modelOutputLooksLikeCommentary(polished) ||
    auditCoverLetterCompliance(cleaned).some((v) => v.type === 'banned-phrase')
  ) {
    return fallback
  }

  return cleaned
}

async function polishSummaryWithBrowserAi(
  summary: string,
  jobDescription: string,
  resumeText: string
): Promise<string> {
  const rewritten = await promptBrowserAi(
    SUMMARY_SYSTEM,
    `JOB DESCRIPTION:
${truncate(jobDescription, 4000)}

SOURCE RESUME:
${truncate(resumeText, 6000)}

CURRENT SUMMARY:
${summary}`
  )

  return rewritten.length > 40 ? rewritten : summary
}

export type BrowserGenerationOptions = {
  jobDescription: string
  resumeText: string
  coverLetterContext?: string
  useChromeNano?: boolean
  onProgress?: (label: string) => void
}

/** Unlimited client-side generation — no server API calls, no rate limits. */
export async function runBrowserGeneration(
  options: BrowserGenerationOptions
): Promise<BrowserGenerationResult> {
  const { jobDescription, resumeText, coverLetterContext, useChromeNano = true, onProgress } = options

  onProgress?.('Running unlimited browser tailoring (local keywords)…')

  let aiResult: AiGenerationResult = generateTailoredResumeLocally(jobDescription, resumeText)
  const localCoverLetter = aiResult.coverLetter
  const localSummary = aiResult.tailoredResume.summary

  if (useChromeNano) {
    try {
      onProgress?.('Polishing summary with Gemini Nano (on your device)…')
      const polishedRaw = await polishSummaryWithBrowserAi(localSummary, jobDescription, resumeText)
      aiResult = {
        ...aiResult,
        tailoredResume: {
          ...aiResult.tailoredResume,
          summary: finalizeBrowserSummary(polishedRaw, localSummary),
        },
      }

      onProgress?.('Polishing cover letter with Gemini Nano…')
      const polishedCover = await polishCoverLetterWithBrowserAi(
        localCoverLetter,
        jobDescription,
        resumeText,
        aiResult.tailoredResume.contact.name,
        coverLetterContext
      )
      aiResult = {
        ...aiResult,
        coverLetter: finalizeBrowserCoverLetter(polishedCover, localCoverLetter),
      }
    } catch (error) {
      console.warn('Browser AI polish skipped:', error)
      onProgress?.('Nano polish skipped — using local keyword tailoring.')
    }
  }

  onProgress?.('Weaving missing keywords into your resume…')

  const keywordImproved = applyKeywordImprovementsToDraft(aiResult, jobDescription, resumeText)
  aiResult = keywordImproved.aiResult

  onProgress?.('Scoring ATS match…')

  const preScan = runSkillExtrapolationAndInjection(resumeText, jobDescription, { autoInject: false })
  const comparison = buildAtsComparison(
    resumeText,
    serializeTailoredResume(aiResult.tailoredResume),
    jobDescription,
    undefined,
    resumeText,
    aiResult.tailoredResume
  )

  const normalized = normalizeGenerationDraftForApi(aiResult, resumeText)

  return {
    ...normalized,
    keywordReport: comparison.keywordReport,
    baselineKeywordReport: comparison.baselineKeywordReport,
    incorporatedKeywords: [
      ...new Set([...preScan.autoInjectedSkills, ...keywordImproved.injectedSkills]),
    ],
    preScan,
    rawKeywordScore: comparison.keywordReport.matchScore,
  }
}
