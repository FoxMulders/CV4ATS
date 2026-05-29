'use client'

import type { TailoredResume } from '@/lib/ai/schemas'

import { PhrasingSimilarityPreview } from '@/components/results/phrasing-similarity-preview'

interface ResumePreviewProps {
  resume: TailoredResume
  jobDescription?: string
  /** Strip card chrome when rendered inside the letter-page canvas. */
  variant?: 'card' | 'letter'
}

export function ResumePreview({ resume, jobDescription, variant = 'card' }: ResumePreviewProps) {
  const contactParts = [
    resume.contact.email,
    resume.contact.phone,
    resume.contact.location,
    resume.contact.linkedin,
  ].filter(Boolean)

  const rootClass =
    variant === 'letter'
      ? 'space-y-5 font-sans text-sm leading-relaxed text-foreground'
      : 'mx-auto max-w-2xl space-y-5 rounded-lg border border-border/80 bg-card p-8 font-sans text-sm leading-relaxed text-foreground shadow-md'

  return (
    <div className={rootClass}>
      <header className="border-b border-primary/20 pb-4">
        <h2 className="font-heading text-2xl font-semibold">{resume.contact.name}</h2>
        {contactParts.length > 0 ? (
          <p className="mt-1 text-muted-foreground">{contactParts.join(' | ')}</p>
        ) : null}
      </header>

      <section>
        <h3 className="mb-2 border-b border-primary/30 pb-1 text-xs font-bold uppercase tracking-[0.15em] text-primary">
          Professional Summary
        </h3>
        <p>{resume.summary}</p>
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
        <p>{resume.skills.join(' • ')}</p>
      </section>

      <section>
        <h3 className="mb-2 border-b border-primary/30 pb-1 text-xs font-bold uppercase tracking-[0.15em] text-primary">
          Work Experience
        </h3>
        <div className="space-y-4">
          {resume.experience.map((job) => (
            <div key={`${job.company}-${job.title}-${job.startDate}`}>
              <p className="font-semibold">
                {job.title} — {job.company}
                {job.location ? ` | ${job.location}` : ''}
              </p>
              <p className="text-muted-foreground">
                {job.startDate} – {job.endDate}
              </p>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                {job.bullets.map((bullet) => (
                  <li key={bullet}>
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
            </div>
          ))}
        </div>
      </section>

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

      {resume.certifications?.length ? (
        <section>
          <h3 className="mb-2 border-b border-primary/30 pb-1 text-xs font-bold uppercase tracking-[0.15em] text-primary">
            Certifications
          </h3>
          <ul className="list-disc space-y-1 pl-5">
            {resume.certifications.map((cert) => (
              <li key={cert}>{cert}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
