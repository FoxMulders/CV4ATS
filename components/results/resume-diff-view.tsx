'use client'

import { X } from 'lucide-react'

import type { TailoredResume } from '@/lib/ai/schemas'
import {
  applyResumeChangeRemoval,
  buildHighlightSpans,
  phraseExistsInOriginal,
  type ResumeChangeTarget,
} from '@/lib/resume/resume-diff'

interface ResumeDiffViewProps {
  originalText: string
  resume: TailoredResume
  onResumeChange: (resume: TailoredResume) => void
}

function HighlightedText({
  text,
  originalText,
  onRemovePhrase,
}: {
  text: string
  originalText: string
  onRemovePhrase: (phrase: string) => void
}) {
  const spans = buildHighlightSpans(text, originalText)

  return (
    <span>
      {spans.map((span, index) =>
        span.highlighted ? (
          <button
            key={`${index}-${span.text}`}
            type="button"
            className="mx-0.5 inline rounded-sm bg-emerald-200/80 px-0.5 text-emerald-950 underline decoration-emerald-700/60 decoration-dotted underline-offset-2 transition hover:bg-red-200 hover:text-red-950 hover:decoration-red-700"
            title="Click to remove this change"
            onClick={() => onRemovePhrase(span.text.trim())}
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

export function ResumeDiffView({
  originalText,
  resume,
  onResumeChange,
}: ResumeDiffViewProps) {
  function dismissChange(target: ResumeChangeTarget) {
    onResumeChange(applyResumeChangeRemoval(resume, target))
  }

  const addedSkills = resume.skills
    .map((skill, index) => ({ skill, index }))
    .filter(({ skill }) => !phraseExistsInOriginal(skill, originalText))

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Green highlights are AI additions compared to your original resume. Click any highlight to
        remove it from the tailored version.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-border/80 bg-muted/20 p-4">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
            Before — your original
          </h3>
          <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
            {originalText}
          </pre>
        </section>

        <section className="rounded-lg border border-emerald-200/80 bg-emerald-50/30 p-4">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-emerald-800">
            After — tailored
          </h3>
          <div className="max-h-[32rem] space-y-5 overflow-auto font-sans text-sm leading-relaxed">
            <header className="border-b border-emerald-200/60 pb-3">
              <p className="text-lg font-semibold">{resume.contact.name}</p>
              <p className="text-muted-foreground">
                {[resume.contact.email, resume.contact.phone, resume.contact.location]
                  .filter(Boolean)
                  .join(' | ')}
              </p>
            </header>

            <section>
              <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-primary">
                Professional Summary
              </h4>
              <p>
                <HighlightedText
                  text={resume.summary}
                  originalText={originalText}
                  onRemovePhrase={(phrase) =>
                    dismissChange({ kind: 'summary', phrase })
                  }
                />
              </p>
            </section>

            <section>
              <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-primary">
                Skills
              </h4>
              <div className="flex flex-wrap gap-2">
                {resume.skills.map((skill, index) => {
                  const isAdded = addedSkills.some((entry) => entry.index === index)
                  if (!isAdded) {
                    return (
                      <span
                        key={`${skill}-${index}`}
                        className="rounded-full bg-background px-2.5 py-0.5 text-xs ring-1 ring-border/80"
                      >
                        {skill}
                      </span>
                    )
                  }

                  return (
                    <button
                      key={`${skill}-${index}`}
                      type="button"
                      className="inline-flex items-center gap-1 rounded-full bg-emerald-200/80 px-2.5 py-0.5 text-xs text-emerald-950 ring-1 ring-emerald-400/60 transition hover:bg-red-200 hover:text-red-950"
                      title="Click to remove this skill"
                      onClick={() => dismissChange({ kind: 'skill', index })}
                    >
                      {skill}
                      <X className="size-3" />
                    </button>
                  )
                })}
              </div>
            </section>

            <section>
              <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-primary">
                Work Experience
              </h4>
              <div className="space-y-4">
                {resume.experience.map((job, experienceIndex) => (
                  <div key={`${job.company}-${job.title}-${job.startDate}`}>
                    <p className="font-semibold">
                      {job.title} — {job.company}
                    </p>
                    <p className="text-muted-foreground">
                      {job.startDate} – {job.endDate}
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      {job.bullets.map((bullet, bulletIndex) => (
                        <li key={`${experienceIndex}-${bulletIndex}-${bullet}`}>
                          <HighlightedText
                            text={bullet}
                            originalText={originalText}
                            onRemovePhrase={(phrase) =>
                              dismissChange({
                                kind: 'bullet',
                                experienceIndex,
                                bulletIndex,
                                phrase,
                              })
                            }
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>

            {resume.certifications.length > 0 ? (
              <section>
                <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-primary">
                  Certifications
                </h4>
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
                          className="inline-flex items-center gap-1 rounded-sm bg-emerald-200/80 px-1.5 py-0.5 text-left transition hover:bg-red-200 hover:text-red-950"
                          title="Click to remove this certification"
                          onClick={() => dismissChange({ kind: 'certification', index })}
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
        </section>
      </div>
    </div>
  )
}
