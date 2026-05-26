'use client'

import { RotateCcw, X } from 'lucide-react'

import type { TailoredResume } from '@/lib/ai/schemas'
import {
  PhrasingSimilarityPreview,
} from '@/components/results/phrasing-similarity-preview'
import {
  applyResumeChangeRevert,
  buildHighlightSpans,
  extractOriginalSummary,
  findBestOriginalMatch,
  hasHighlightedChanges,
  isSubstantiallyChanged,
  phraseExistsInOriginal,
  type ResumeChangeTarget,
} from '@/lib/resume/resume-diff'

interface ResumeChangeHighlightProps {
  originalText: string
  resume: TailoredResume
  onResumeChange: (resume: TailoredResume) => void
  jobDescription?: string
  /** Drop outer card styling when embedded in the side-by-side diff layout. */
  embedded?: boolean
}

function HighlightedText({
  text,
  comparisonCorpus,
  onRevertPhrase,
}: {
  text: string
  comparisonCorpus: string
  onRevertPhrase: (phrase: string) => void
}) {
  const spans = buildHighlightSpans(text, comparisonCorpus)

  return (
    <span>
      {spans.map((span, index) =>
        span.highlighted ? (
          <button
            key={`${index}-${span.text}`}
            type="button"
            className="mx-0.5 inline rounded-sm bg-amber-200/90 px-0.5 text-amber-950 underline decoration-amber-700/70 decoration-dotted underline-offset-2 transition hover:bg-red-200 hover:text-red-950 hover:decoration-red-700"
            title="Click to revert this change"
            onClick={() => onRevertPhrase(span.text.trim())}
          >
            {span.text}
          </button>
        ) : (
          <span key={`${index}-${span.text}`}>{span.text}</span>
        )
      )}
    </span>
  )
}

export function ResumeChangeHighlight({
  originalText,
  resume,
  onResumeChange,
  jobDescription,
  embedded = false,
}: ResumeChangeHighlightProps) {
  function revertChange(target: ResumeChangeTarget) {
    onResumeChange(applyResumeChangeRevert(resume, target, originalText))
  }

  const originalSummary = extractOriginalSummary(originalText)
  const summaryChanged = isSubstantiallyChanged(resume.summary, originalText)
  const summarySpans = buildHighlightSpans(
    resume.summary,
    originalSummary || findBestOriginalMatch(resume.summary, originalText)
  )

  const contactParts = [
    resume.contact.email,
    resume.contact.phone,
    resume.contact.location,
    resume.contact.linkedin,
  ].filter(Boolean)

  return (
    <div className="space-y-4">
      {!embedded ? (
        <p className="rounded-lg border border-amber-200/80 bg-amber-50/60 px-3 py-2 text-sm text-amber-950">
          <span className="font-medium">Highlighted text</span> differs from your original resume.
          Click any highlight to revert that change.
        </p>
      ) : null}

      {jobDescription?.trim() ? (
        <p className="rounded-lg border border-amber-200/70 bg-amber-50/40 px-3 py-2 text-sm text-amber-950">
          <span className="font-medium">Exact phrasing auditor</span> flags resume text that repeats
          four or more consecutive job-description words (stop words excluded).
        </p>
      ) : null}

      <div
        className={
          embedded
            ? 'space-y-5 font-sans text-sm leading-relaxed'
            : 'mx-auto max-w-2xl space-y-5 rounded-lg border border-border/80 bg-card p-8 font-sans text-sm leading-relaxed text-foreground shadow-md'
        }
      >
        <header className="border-b border-primary/20 pb-4">
          <h2 className="font-heading text-2xl font-semibold">{resume.contact.name}</h2>
          {contactParts.length > 0 ? (
            <p className="mt-1 text-muted-foreground">{contactParts.join(' | ')}</p>
          ) : null}
        </header>

        <section>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="border-b border-primary/30 pb-1 text-xs font-bold uppercase tracking-[0.15em] text-primary">
              Professional Summary
            </h3>
            {summaryChanged ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-950 ring-1 ring-amber-300/70 transition hover:bg-red-100 hover:text-red-950"
                onClick={() => revertChange({ kind: 'summary-revert' })}
              >
                <RotateCcw className="size-3" />
                Revert summary
              </button>
            ) : null}
          </div>
          <p>
            {hasHighlightedChanges(summarySpans) || summaryChanged ? (
              <HighlightedText
                text={resume.summary}
                comparisonCorpus={
                  originalSummary || findBestOriginalMatch(resume.summary, originalText)
                }
                onRevertPhrase={(phrase) => revertChange({ kind: 'summary', phrase })}
              />
            ) : (
              resume.summary
            )}
          </p>
          {jobDescription?.trim() ? (
            <PhrasingSimilarityPreview
              text={resume.summary}
              jobDescription={jobDescription}
              previewClassName="mt-2"
            />
          ) : null}
        </section>

        <section>
          <h3 className="mb-2 border-b border-primary/30 pb-1 text-xs font-bold uppercase tracking-[0.15em] text-primary">
            Skills
          </h3>
          <div className="flex flex-wrap gap-2">
            {resume.skills.map((skill, index) => {
              const isAdded = !phraseExistsInOriginal(skill, originalText)
              if (!isAdded) {
                return (
                  <span
                    key={`${skill}-${index}`}
                    className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-foreground"
                  >
                    {skill}
                  </span>
                )
              }

              return (
                <button
                  key={`${skill}-${index}`}
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full bg-amber-200/90 px-2.5 py-0.5 text-xs text-amber-950 ring-1 ring-amber-400/60 transition hover:bg-red-200 hover:text-red-950"
                  title="Click to revert this skill"
                  onClick={() => revertChange({ kind: 'skill', index })}
                >
                  {skill}
                  <X className="size-3" />
                </button>
              )
            })}
          </div>
        </section>

        <section>
          <h3 className="mb-2 border-b border-primary/30 pb-1 text-xs font-bold uppercase tracking-[0.15em] text-primary">
            Work Experience
          </h3>
          <div className="space-y-4">
            {resume.experience.map((job, experienceIndex) => (
              <div key={`${job.company}-${job.title}-${job.startDate}`}>
                <p className="font-semibold">
                  {job.title} — {job.company}
                  {job.location ? ` | ${job.location}` : ''}
                </p>
                <p className="text-muted-foreground">
                  {job.startDate} – {job.endDate}
                </p>
                <ul className="mt-2 list-disc space-y-2 pl-5">
                  {job.bullets.map((bullet, bulletIndex) => {
                    const baseline = findBestOriginalMatch(bullet, originalText)
                    const bulletChanged = isSubstantiallyChanged(bullet, originalText)
                    const spans = buildHighlightSpans(bullet, baseline)

                    return (
                      <li key={`${experienceIndex}-${bulletIndex}-${bullet}`}>
                        <div className="flex flex-wrap items-start gap-2">
                          {bulletChanged ? (
                            <button
                              type="button"
                              className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-950 ring-1 ring-amber-300/70 transition hover:bg-red-100 hover:text-red-950"
                              onClick={() =>
                                revertChange({
                                  kind: 'bullet-revert',
                                  experienceIndex,
                                  bulletIndex,
                                })
                              }
                            >
                              <RotateCcw className="size-3" />
                              Revert bullet
                            </button>
                          ) : null}
                          <span className="min-w-0 flex-1">
                            {hasHighlightedChanges(spans) || bulletChanged ? (
                              <HighlightedText
                                text={bullet}
                                comparisonCorpus={baseline}
                                onRevertPhrase={(phrase) =>
                                  revertChange({
                                    kind: 'bullet',
                                    experienceIndex,
                                    bulletIndex,
                                    phrase,
                                  })
                                }
                              />
                            ) : (
                              bullet
                            )}
                          </span>
                        </div>
                        {jobDescription?.trim() ? (
                          <PhrasingSimilarityPreview
                            text={bullet}
                            jobDescription={jobDescription}
                            previewClassName="ml-5 mt-1"
                          />
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {resume.education.length > 0 ? (
          <section>
            <h3 className="mb-2 border-b border-primary/30 pb-1 text-xs font-bold uppercase tracking-[0.15em] text-primary">
              Education
            </h3>
            <div className="space-y-3">
              {resume.education.map((edu) => (
                <div key={`${edu.school}-${edu.degree}`}>
                  <p className="font-semibold">
                    {edu.degree}, {edu.school}
                    {edu.graduationDate ? ` — ${edu.graduationDate}` : ''}
                  </p>
                  {edu.details ? <p className="text-muted-foreground">{edu.details}</p> : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {resume.certifications.length > 0 ? (
          <section>
            <h3 className="mb-2 border-b border-primary/30 pb-1 text-xs font-bold uppercase tracking-[0.15em] text-primary">
              Certifications
            </h3>
            <ul className="list-disc space-y-1 pl-5">
              {resume.certifications.map((cert, index) => {
                const isAdded = !phraseExistsInOriginal(cert, originalText)
                if (!isAdded) {
                  return <li key={`${cert}-${index}`}>{cert}</li>
                }

                return (
                  <li key={`${cert}-${index}`}>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-sm bg-amber-200/90 px-1.5 py-0.5 text-left transition hover:bg-red-200 hover:text-red-950"
                      title="Click to revert this certification"
                      onClick={() => revertChange({ kind: 'certification', index })}
                    >
                      {cert}
                      <X className="size-3 shrink-0" />
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  )
}
