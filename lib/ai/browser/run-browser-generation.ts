import { generateTailoredResumeLocally } from '@/lib/ai/local-fallback'
import type { AiGenerationResult } from '@/lib/ai/schemas'
import { promptBrowserAi } from '@/lib/ai/browser/chrome-language-model'
import { buildAtsComparison, serializeTailoredResume } from '@/lib/resume/ats-score'
import { runSkillExtrapolationAndInjection, type PreScanResult } from '@/lib/resume/pre-scan-preparation'

export type BrowserGenerationResult = AiGenerationResult & {
  keywordReport: ReturnType<typeof buildAtsComparison>['keywordReport']
  baselineKeywordReport: ReturnType<typeof buildAtsComparison>['baselineKeywordReport']
  incorporatedKeywords: string[]
  preScan: PreScanResult
  rawKeywordScore: number
}

const COVER_SYSTEM = `You rewrite cover letters for ATS job applications. Rules:
- Plain text only, professional letter format with contact header, salutation, 3 short body paragraphs, closing.
- No banned clichés: "I am writing to express", "Throughout my career", "I am eager to bring", "partnered closely with", "Furthermore", "Passionate about".
- Name the target role from the job description in paragraph 1.
- Include quantified proof only when present in the resume text — never invent metrics.
- Return ONLY the cover letter text, no markdown fences.`

const SUMMARY_SYSTEM = `You rewrite resume professional summaries for ATS. Rules:
- 2 sentences max: executive value proposition + core expertise pipe line (Core Expertise: A | B | C).
- No first person. No cliché openers. Ground every claim in the source resume.
- Return ONLY the summary text, no markdown.`

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return `${text.slice(0, max)}\n[truncated]`
}

async function polishCoverLetterWithBrowserAi(
  coverLetter: string,
  jobDescription: string,
  resumeText: string
): Promise<string> {
  const rewritten = await promptBrowserAi(
    COVER_SYSTEM,
    `JOB DESCRIPTION:
${truncate(jobDescription, 6000)}

SOURCE RESUME:
${truncate(resumeText, 8000)}

CURRENT COVER LETTER (rewrite completely — fix banned phrases, add JD specificity):
${truncate(coverLetter, 5000)}`
  )

  return rewritten.length > 120 ? rewritten : coverLetter
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
  useChromeNano?: boolean
  onProgress?: (label: string) => void
}

/** Unlimited client-side generation — no server API calls, no rate limits. */
export async function runBrowserGeneration(
  options: BrowserGenerationOptions
): Promise<BrowserGenerationResult> {
  const { jobDescription, resumeText, useChromeNano = true, onProgress } = options

  onProgress?.('Running unlimited browser tailoring (local keywords)…')

  let aiResult: AiGenerationResult = generateTailoredResumeLocally(jobDescription, resumeText)

  if (useChromeNano) {
    try {
      onProgress?.('Polishing summary with Gemini Nano (on your device)…')
      aiResult = {
        ...aiResult,
        tailoredResume: {
          ...aiResult.tailoredResume,
          summary: await polishSummaryWithBrowserAi(
            aiResult.tailoredResume.summary,
            jobDescription,
            resumeText
          ),
        },
      }

      onProgress?.('Polishing cover letter with Gemini Nano…')
      aiResult = {
        ...aiResult,
        coverLetter: await polishCoverLetterWithBrowserAi(
          aiResult.coverLetter,
          jobDescription,
          resumeText
        ),
      }
    } catch (error) {
      console.warn('Browser AI polish skipped:', error)
      onProgress?.('Nano polish skipped — using local keyword tailoring.')
    }
  }

  onProgress?.('Scoring ATS match…')

  const preScan = runSkillExtrapolationAndInjection(resumeText, jobDescription, { autoInject: false })
  const comparison = buildAtsComparison(
    resumeText,
    serializeTailoredResume(aiResult.tailoredResume),
    jobDescription,
    undefined,
    resumeText
  )

  return {
    ...aiResult,
    keywordReport: comparison.keywordReport,
    baselineKeywordReport: comparison.baselineKeywordReport,
    incorporatedKeywords: preScan.autoInjectedSkills,
    preScan,
    rawKeywordScore: comparison.keywordReport.matchScore,
  }
}
