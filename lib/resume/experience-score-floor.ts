/**
 * Tailored scores must not fall below the measured baseline for the same job.
 * Baseline scores are never artificially raised — they reflect raw weighted keyword alignment.
 */
export function applyExperienceScoreFloor(
  displayScore: number,
  _rawScore: number,
  _resumeText: string,
  phase: 'baseline' | 'tailored',
  options: { sourceResumeText?: string; baselineScore?: number } = {}
): number {
  if (phase === 'baseline') {
    return displayScore
  }

  if (options.baselineScore != null) {
    return Math.max(displayScore, options.baselineScore)
  }

  return displayScore
}
