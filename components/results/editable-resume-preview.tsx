'use client'

import type { TailoredResume } from '@/lib/ai/schemas'
import { addExperienceToResume } from '@/lib/resume/experience-utils'

import { AddExperiencePanel } from '@/components/resume/add-experience-panel'
import { ProposedSkillAdditions } from '@/components/resume/proposed-skill-additions'
import { EditableParsedResumeForm } from '@/components/results/editable-parsed-resume-form'
import { ResumeChangeHighlight } from '@/components/results/resume-change-highlight'

interface EditableResumePreviewProps {
  resume: TailoredResume
  baselineResume: TailoredResume
  onResumeChange: (resume: TailoredResume) => void
  originalText?: string | null
  jobDescription?: string
}

export function EditableResumePreview({
  resume,
  baselineResume,
  onResumeChange,
  originalText,
  jobDescription,
}: EditableResumePreviewProps) {
  return (
    <div className="space-y-4">
      {originalText?.trim() ? (
        <ProposedSkillAdditions
          resumeText={originalText}
          tailoredResume={resume}
          onTailoredResumeChange={onResumeChange}
        />
      ) : null}
      <AddExperiencePanel
        onAdd={(experience) => {
          onResumeChange(addExperienceToResume(resume, experience))
        }}
      />
      <EditableParsedResumeForm
        resume={resume}
        baseline={baselineResume}
        onChange={onResumeChange}
        jobDescription={jobDescription}
      />
      {originalText?.trim() ? (
        <ResumeChangeHighlight
          originalText={originalText}
          resume={resume}
          onResumeChange={onResumeChange}
          jobDescription={jobDescription}
        />
      ) : null}
    </div>
  )
}
