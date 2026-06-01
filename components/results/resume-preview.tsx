'use client'

import { useMemo } from 'react'

import type { TailoredResume } from '@/lib/ai/schemas'
import { isPlaceholderDateRange } from '@/lib/ai/generation-hygiene'
import { prepareResumeForDisplay } from '@/lib/resume/prepare-resume-for-display'

import { PhrasingSimilarityPreview } from '@/components/results/phrasing-similarity-preview'

interface ResumePreviewProps {
  resume: TailoredResume
  jobDescription?: string
  /** Strip card chrome when rendered inside the letter-page canvas. */
  variant?: 'card' | 'letter'
}

const PREVIEW_TEXT_CLASS = 'break-words [overflow-wrap:anywhere] whitespace-normal'

export function ResumePreview({ resume, jobDescription, variant = 'card' }: ResumePreviewProps) {
  const displayResume = useMemo(() => prepareResumeForDisplay(resume), [resume])

  const experienceEntries = displayResume.experience ?? []
  const educationEntries = displayResume.education ?? []
  const contactParts = [
    displayResume.contact.email,
    displayResume.contact.phone,
    displayResume.contact.location,
    displayResume.contact.linkedin,
  ].filter(Boolean)

  const rootClass =
    variant === 'letter'
      ? `space-y-5 font-sans text-sm leading-relaxed text-foreground ${PREVIEW_TEXT_CLASS}`
      : `mx-auto max-w-2xl space-y-5 rounded-lg border border-border/80 bg-card p-8 font-sans text-sm leading-relaxed text-foreground shadow-md ${PREVIEW_TEXT_CLASS}`

  return (
    <div className={rootClass}>
      <header className="border-b border-primary/20 pb-4">
        <h2 className="font-heading text-2xl font-semibold">{displayResume.contact.name}</h2>
        {contactParts.length > 0 ? (
          <p className="mt-1 text-muted-foreground">{contactParts.join(' | ')}</p>
        ) : null}
      </header>

      {displayResume.summary ? (
        <section>
          <h3 className="mb-2 border-b border-primary/30 pb-1 text-xs font-bold uppercase tracking-[0.15em] text-primary">
            Professional Summary
          </h3>
          <p>{displayResume.summary}</p>
          {jobDescription?.trim() ? (
            <PhrasingSimilarityPreview
              text={displayResume.summary}
              jobDescription={jobDescription}
              previewClassName="mt-2"
            />
          ) : null}
        </section>
      ) : null}

      {displayResume.skills.length > 0 ? (
        <section>
          <h3 className="mb-2 border-b border-primary/30 pb-1 text-xs font-bold uppercase tracking-[0.15em] text-primary">
            Skills
          </h3>
          <p>{displayResume.skills.join(' • ')}</p>
        </section>
      ) : null}

      <section>
        <h3 className="mb-2 border-b border-primary/30 pb-1 text-xs font-bold uppercase tracking-[0.15em] text-primary">
          Work Experience
        </h3>
        <div className="space-y-4">
          {experienceEntries.length > 0 ? (
            experienceEntries.map((job, jobIndex) => {
              const bullets = job.bullets ?? []
              const jobKey = `${job.company}-${job.title}-${job.startDate}-${jobIndex}`

              return (
                <div key={jobKey}>
                  <p className="font-semibold">
                    {job.title} — {job.company}
                    {job.location ? ` | ${job.location}` : ''}
                  </p>
                  {!isPlaceholderDateRange(job.startDate, job.endDate) ? (
                    <p className="text-muted-foreground">
                      {[job.startDate, job.endDate].filter(Boolean).join(' – ')}
                    </p>
                  ) : null}
                  {bullets.length > 0 ? (
                    <ul className="mt-2 list-disc space-y-2 pl-5">
                      {bullets.map((bullet, bulletIndex) => (
                        <li key={`${jobKey}-bullet-${bulletIndex}`}>
                          {bullet}
                          {jobDescription?.trim() ? (
                            <PhrasingSimilarityPreview
                              text={bullet}
                              jobDescription={jobDescription}
                              previewClassName="mt-1"
                            />
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              )
            })
          ) : (
            <p className="text-muted-foreground">No work experience to display.</p>
          )}
        </div>
      </section>

      <section>
        <h3 className="mb-2 border-b border-primary/30 pb-1 text-xs font-bold uppercase tracking-[0.15em] text-primary">
          Education
        </h3>
        <div className="space-y-3">
          {educationEntries.length > 0 ? (
            educationEntries.map((edu, eduIndex) => (
              <div key={`${edu.school}-${edu.degree}-${eduIndex}`}>
                <p className="font-semibold">
                  {edu.degree}, {edu.school}
                  {edu.graduationDate ? ` — ${edu.graduationDate}` : ''}
                </p>
                {edu.details ? <p className="text-muted-foreground">{edu.details}</p> : null}
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">No education to display.</p>
          )}
        </div>
      </section>

      {displayResume.certifications?.length ? (
        <section>
          <h3 className="mb-2 border-b border-primary/30 pb-1 text-xs font-bold uppercase tracking-[0.15em] text-primary">
            Certifications
          </h3>
          <ul className="list-disc space-y-1 pl-5">
            {displayResume.certifications.map((cert, certIndex) => (
              <li key={`${cert}-${certIndex}`}>{cert}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
