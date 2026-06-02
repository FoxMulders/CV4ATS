import {
  buildBradMuldersCoverLetterAddendum,
  buildBradMuldersResumeEmphasisHint,
  isBradMuldersResume,
} from '@/lib/ai/candidate-narratives/brad-mulders'

export {
  BRAD_MULDERS_NARRATIVE_ID,
  BRAD_MULDERS_PLEASANT_SOLUTIONS_FACTS,
  buildBradMuldersCoverLetterAddendum,
  buildBradMuldersResumeEmphasisHint,
  classifyBradMuldersRoleFocus,
  isBradMuldersResume,
  type BradMuldersRoleFocus,
} from '@/lib/ai/candidate-narratives/brad-mulders'

/** Candidate-specific cover letter + resume narrative blocks (empty when no match). */
export function buildCandidateNarrativeAddendum(
  sourceResumeText: string,
  jobDescription: string
): string {
  if (!isBradMuldersResume(sourceResumeText)) return ''

  const blocks = [
    buildBradMuldersCoverLetterAddendum(jobDescription),
    '',
    '### Resume tailoring emphasis (Brad Mulders)',
    buildBradMuldersResumeEmphasisHint(jobDescription),
  ]

  return blocks.filter(Boolean).join('\n')
}
