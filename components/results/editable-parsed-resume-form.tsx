'use client'

import type { ReactNode } from 'react'

import type { TailoredResume } from '@/lib/ai/schemas'
import { isFieldEdited } from '@/lib/form/field-diff'

import { EditableFieldShell } from '@/components/form/editable-field-shell'
import { EditableTagList } from '@/components/form/editable-tag-list'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { PhrasingSimilarityPreview } from '@/components/results/phrasing-similarity-preview'
import { WorkspaceAccordion } from '@/components/workspace/workspace-accordion'
import { cn } from '@/lib/utils'

interface EditableParsedResumeFormProps {
  resume: TailoredResume
  baseline: TailoredResume
  onChange: (resume: TailoredResume) => void
  jobDescription?: string
  layout?: 'card' | 'accordion'
}

function updateExperience(
  resume: TailoredResume,
  index: number,
  patch: Partial<TailoredResume['experience'][number]>
): TailoredResume {
  return {
    ...resume,
    experience: resume.experience.map((job, jobIndex) =>
      jobIndex === index ? { ...job, ...patch } : job
    ),
  }
}

function updateBullet(
  resume: TailoredResume,
  jobIndex: number,
  bulletIndex: number,
  text: string
): TailoredResume {
  return updateExperience(resume, jobIndex, {
    bullets: resume.experience[jobIndex]!.bullets.map((bullet, index) =>
      index === bulletIndex ? text : bullet
    ),
  })
}

function FormSection({
  layout,
  id,
  title,
  description,
  defaultOpen = false,
  children,
  className,
}: {
  layout: 'card' | 'accordion'
  id: string
  title: string
  description?: string
  defaultOpen?: boolean
  children: ReactNode
  className?: string
}) {
  if (layout === 'accordion') {
    return (
      <WorkspaceAccordion
        id={id}
        title={title}
        description={description}
        defaultOpen={defaultOpen}
        className={className}
      >
        {children}
      </WorkspaceAccordion>
    )
  }

  return (
    <section className={cn('space-y-3', className)}>
      <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary">{title}</p>
      {children}
    </section>
  )
}

export function EditableParsedResumeForm({
  resume,
  baseline,
  onChange,
  jobDescription,
  layout = 'card',
}: EditableParsedResumeFormProps) {
  const isAccordion = layout === 'accordion'

  const personalFields = (
    <div className="space-y-3">
      <EditableFieldShell
        label="Name"
        htmlFor="parsed-resume-name"
        edited={isFieldEdited(resume.contact.name, baseline.contact.name)}
      >
        <Input
          id="parsed-resume-name"
          value={resume.contact.name}
          onChange={(event) =>
            onChange({
              ...resume,
              contact: { ...resume.contact, name: event.target.value },
            })
          }
        />
      </EditableFieldShell>

      <div className="grid gap-3 sm:grid-cols-2">
        {(['email', 'phone', 'location', 'linkedin'] as const).map((field) => (
          <EditableFieldShell
            key={field}
            label={field}
            htmlFor={`parsed-resume-${field}`}
            edited={isFieldEdited(resume.contact[field], baseline.contact[field])}
          >
            <Input
              id={`parsed-resume-${field}`}
              value={resume.contact[field]}
              onChange={(event) =>
                onChange({
                  ...resume,
                  contact: { ...resume.contact, [field]: event.target.value },
                })
              }
            />
          </EditableFieldShell>
        ))}
      </div>
    </div>
  )

  const summaryFields = (
    <EditableFieldShell
      label="Professional summary"
      htmlFor="parsed-resume-summary"
      edited={isFieldEdited(resume.summary, baseline.summary)}
    >
      <Textarea
        id="parsed-resume-summary"
        value={resume.summary}
        rows={4}
        onChange={(event) => onChange({ ...resume, summary: event.target.value })}
      />
      {jobDescription?.trim() ? (
        <PhrasingSimilarityPreview
          text={resume.summary}
          jobDescription={jobDescription}
          previewClassName="mt-2"
        />
      ) : null}
    </EditableFieldShell>
  )

  const skillsFields = (
    <EditableTagList
      label="Skills"
      values={resume.skills}
      baselineValues={baseline.skills}
      onChange={(skills) => onChange({ ...resume, skills })}
      placeholder="Add a skill…"
    />
  )

  const experienceFields = (
    <div className="space-y-4">
      {resume.experience.map((job, jobIndex) => {
        const baselineJob = baseline.experience[jobIndex]
        const jobKey = `${job.company}-${job.title}-${job.startDate}-${jobIndex}`

        return (
          <div key={jobKey} className="space-y-3 rounded-lg border border-border/70 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <EditableFieldShell
                label="Job title"
                htmlFor={`job-title-${jobIndex}`}
                edited={isFieldEdited(job.title, baselineJob?.title)}
              >
                <Input
                  id={`job-title-${jobIndex}`}
                  value={job.title}
                  onChange={(event) =>
                    onChange(updateExperience(resume, jobIndex, { title: event.target.value }))
                  }
                />
              </EditableFieldShell>

              <EditableFieldShell
                label="Company"
                htmlFor={`job-company-${jobIndex}`}
                edited={isFieldEdited(job.company, baselineJob?.company)}
              >
                <Input
                  id={`job-company-${jobIndex}`}
                  value={job.company}
                  onChange={(event) =>
                    onChange(updateExperience(resume, jobIndex, { company: event.target.value }))
                  }
                />
              </EditableFieldShell>

              <EditableFieldShell
                label="Location"
                htmlFor={`job-location-${jobIndex}`}
                edited={isFieldEdited(job.location, baselineJob?.location)}
              >
                <Input
                  id={`job-location-${jobIndex}`}
                  value={job.location}
                  onChange={(event) =>
                    onChange(updateExperience(resume, jobIndex, { location: event.target.value }))
                  }
                />
              </EditableFieldShell>

              <div className="grid grid-cols-2 gap-3">
                <EditableFieldShell
                  label="Start date"
                  htmlFor={`job-start-${jobIndex}`}
                  edited={isFieldEdited(job.startDate, baselineJob?.startDate)}
                >
                  <Input
                    id={`job-start-${jobIndex}`}
                    value={job.startDate}
                    onChange={(event) =>
                      onChange(updateExperience(resume, jobIndex, { startDate: event.target.value }))
                    }
                  />
                </EditableFieldShell>

                <EditableFieldShell
                  label="End date"
                  htmlFor={`job-end-${jobIndex}`}
                  edited={isFieldEdited(job.endDate, baselineJob?.endDate)}
                >
                  <Input
                    id={`job-end-${jobIndex}`}
                    value={job.endDate}
                    onChange={(event) =>
                      onChange(updateExperience(resume, jobIndex, { endDate: event.target.value }))
                    }
                  />
                </EditableFieldShell>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Experience bullets & metrics
              </p>
              {job.bullets.map((bullet, bulletIndex) => (
                <EditableFieldShell
                  key={`${jobKey}-bullet-${bulletIndex}`}
                  label={`Bullet ${bulletIndex + 1}`}
                  htmlFor={`job-${jobIndex}-bullet-${bulletIndex}`}
                  edited={isFieldEdited(bullet, baselineJob?.bullets[bulletIndex])}
                >
                  <Textarea
                    id={`job-${jobIndex}-bullet-${bulletIndex}`}
                    value={bullet}
                    rows={3}
                    onChange={(event) =>
                      onChange(updateBullet(resume, jobIndex, bulletIndex, event.target.value))
                    }
                  />
                  {jobDescription?.trim() ? (
                    <PhrasingSimilarityPreview
                      text={bullet}
                      jobDescription={jobDescription}
                      previewClassName="mt-2"
                    />
                  ) : null}
                </EditableFieldShell>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )

  const educationFields =
    resume.education.length > 0 ? (
      <div className="space-y-3">
        {resume.education.map((edu, eduIndex) => {
          const baselineEdu = baseline.education[eduIndex]
          return (
            <div key={`${edu.school}-${edu.degree}-${eduIndex}`} className="grid gap-3 sm:grid-cols-2">
              <EditableFieldShell
                label="Degree"
                edited={isFieldEdited(edu.degree, baselineEdu?.degree)}
              >
                <Input
                  value={edu.degree}
                  onChange={(event) =>
                    onChange({
                      ...resume,
                      education: resume.education.map((entry, index) =>
                        index === eduIndex ? { ...entry, degree: event.target.value } : entry
                      ),
                    })
                  }
                />
              </EditableFieldShell>
              <EditableFieldShell
                label="School"
                edited={isFieldEdited(edu.school, baselineEdu?.school)}
              >
                <Input
                  value={edu.school}
                  onChange={(event) =>
                    onChange({
                      ...resume,
                      education: resume.education.map((entry, index) =>
                        index === eduIndex ? { ...entry, school: event.target.value } : entry
                      ),
                    })
                  }
                />
              </EditableFieldShell>
            </div>
          )
        })}
      </div>
    ) : (
      <p className="text-sm text-muted-foreground">No education entries on this resume.</p>
    )

  const certificationsFields =
    resume.certifications?.length ? (
      <EditableTagList
        label="Certifications"
        values={resume.certifications}
        baselineValues={baseline.certifications}
        onChange={(certifications) => onChange({ ...resume, certifications })}
        placeholder="Add a certification…"
      />
    ) : null

  if (isAccordion) {
    return (
      <div className="space-y-3">
        <FormSection
          layout="accordion"
          id="resume-personal"
          title="Personal info"
          description="Name, email, phone, location, LinkedIn"
          defaultOpen
        >
          {personalFields}
        </FormSection>

        <FormSection
          layout="accordion"
          id="resume-summary"
          title="Professional summary"
          description="Hook-first value proposition"
        >
          {summaryFields}
        </FormSection>

        <FormSection
          layout="accordion"
          id="resume-skills"
          title="Skills"
          description="Add or remove keyword-aligned skills"
        >
          {skillsFields}
        </FormSection>

        <FormSection
          layout="accordion"
          id="resume-experience"
          title="Work experience"
          description="Job titles, companies, dates, and bullet points"
        >
          {experienceFields}
        </FormSection>

        <FormSection
          layout="accordion"
          id="resume-education"
          title="Education"
          description="Degrees and institutions"
        >
          {educationFields}
          {certificationsFields ? <div className="mt-4">{certificationsFields}</div> : null}
        </FormSection>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 rounded-lg border border-border/80 bg-card p-6 font-sans text-sm leading-relaxed text-foreground shadow-md">
      <header className="space-y-3 border-b border-primary/20 pb-4">{personalFields}</header>

      <section>{summaryFields}</section>

      <section>{skillsFields}</section>

      <section className="space-y-4">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary">Work experience</p>
        {experienceFields}
      </section>

      {resume.education.length ? (
        <section className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary">Education</p>
          {educationFields}
        </section>
      ) : null}

      {certificationsFields ? <section>{certificationsFields}</section> : null}
    </div>
  )
}
