'use client'

import type { TailoredResume } from '@/lib/ai/schemas'
import { addExperienceToResume } from '@/lib/resume/experience-utils'

import { AddExperiencePanel } from '@/components/resume/add-experience-panel'
import { ResumePreview } from '@/components/results/resume-preview'

interface EditableResumePreviewProps {
  resume: TailoredResume
  onResumeChange: (resume: TailoredResume) => void
}

export function EditableResumePreview({ resume, onResumeChange }: EditableResumePreviewProps) {
  return (
    <div className="space-y-4">
      <AddExperiencePanel
        onAdd={(experience) => {
          onResumeChange(addExperienceToResume(resume, experience))
        }}
      />
      <ResumePreview resume={resume} />
    </div>
  )
}
