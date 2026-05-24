import type { TailoredResume } from '@/lib/ai/schemas'

interface ResumePreviewProps {
  resume: TailoredResume
}

export function ResumePreview({ resume }: ResumePreviewProps) {
  const contactParts = [
    resume.contact.email,
    resume.contact.phone,
    resume.contact.location,
    resume.contact.linkedin,
  ].filter(Boolean)

  return (
    <div className="mx-auto max-w-2xl space-y-5 rounded-lg border bg-white p-8 font-sans text-sm leading-relaxed text-neutral-900 shadow-sm">
      <header className="border-b pb-4">
        <h2 className="text-2xl font-bold">{resume.contact.name}</h2>
        {contactParts.length > 0 ? (
          <p className="mt-1 text-neutral-600">{contactParts.join(' | ')}</p>
        ) : null}
      </header>

      <section>
        <h3 className="mb-2 border-b border-neutral-900 pb-1 text-xs font-bold uppercase tracking-wide">
          Professional Summary
        </h3>
        <p>{resume.summary}</p>
      </section>

      <section>
        <h3 className="mb-2 border-b border-neutral-900 pb-1 text-xs font-bold uppercase tracking-wide">
          Skills
        </h3>
        <p>{resume.skills.join(' • ')}</p>
      </section>

      <section>
        <h3 className="mb-2 border-b border-neutral-900 pb-1 text-xs font-bold uppercase tracking-wide">
          Work Experience
        </h3>
        <div className="space-y-4">
          {resume.experience.map((job) => (
            <div key={`${job.company}-${job.title}-${job.startDate}`}>
              <p className="font-semibold">
                {job.title} — {job.company}
                {job.location ? ` | ${job.location}` : ''}
              </p>
              <p className="text-neutral-600">
                {job.startDate} – {job.endDate}
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {job.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 border-b border-neutral-900 pb-1 text-xs font-bold uppercase tracking-wide">
          Education
        </h3>
        <div className="space-y-3">
          {resume.education.map((edu) => (
            <div key={`${edu.school}-${edu.degree}`}>
              <p className="font-semibold">
                {edu.degree}, {edu.school}
                {edu.graduationDate ? ` — ${edu.graduationDate}` : ''}
              </p>
              {edu.details ? <p className="text-neutral-700">{edu.details}</p> : null}
            </div>
          ))}
        </div>
      </section>

      {resume.certifications?.length ? (
        <section>
          <h3 className="mb-2 border-b border-neutral-900 pb-1 text-xs font-bold uppercase tracking-wide">
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
