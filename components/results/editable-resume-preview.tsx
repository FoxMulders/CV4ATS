'use client'

import type { TailoredResume } from '@/lib/ai/schemas'
import { addExperienceToResume } from '@/lib/resume/experience-utils'

import { AddExperiencePanel } from '@/components/resume/add-experience-panel'
import { ProposedSkillAdditions } from '@/components/resume/proposed-skill-additions'
import { ResumeChangeHighlight } from '@/components/results/resume-change-highlight'
import { ResumePreview } from '@/components/results/resume-preview'

interface EditableResumePreviewProps {
  resume: TailoredResume
  onResumeChange: (resume: TailoredResume) => void
  originalText?: string | null
  jobDescription?: string
}

export function EditableResumePreview({
  resume,
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
      {originalText?.trim() ? (
        <ResumeChangeHighlight
          originalText={originalText}
          resume={resume}
          onResumeChange={onResumeChange}
          jobDescription={jobDescription}
        />
      ) : (
        <ResumePreview resume={resume} jobDescription={jobDescription} />
      )}
    </div>
  )
}
