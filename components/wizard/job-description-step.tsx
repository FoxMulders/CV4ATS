'use client'

import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { WorkspaceEditorViewport } from '@/components/wizard/workspace-editor-viewport'
import { handleJobDescriptionPaste } from '@/components/wizard/paste-scroll'
import { MAX_JOB_DESCRIPTION_LENGTH } from '@/lib/ai/schemas'
import {
  WORKSPACE_COUNTER_AT_LIMIT_CLASS,
  WORKSPACE_COUNTER_CLASS,
  WORKSPACE_STEP_CONTENT_CLASS,
  WORKSPACE_TEXTAREA_CLASS,
} from '@/lib/wizard/workspace-panel-styles'
import { cn } from '@/lib/utils'

interface JobDescriptionStepProps {
  value: string
  onChange: (value: string) => void
  resumePopulated?: boolean
  onPasteFocusTarget?: (target: 'job' | 'resume' | 'generate') => void
}

export function JobDescriptionStep({
  value,
  onChange,
  resumePopulated = false,
  onPasteFocusTarget,
}: JobDescriptionStepProps) {
  const atLimit = value.length >= MAX_JOB_DESCRIPTION_LENGTH

  return (
    <div className={cn('space-y-2', WORKSPACE_STEP_CONTENT_CLASS)}>
      <Label htmlFor="job-description">Job description</Label>
      <WorkspaceEditorViewport
        aria-label="Job description editor"
        className="min-h-0 flex-1"
      >
        <Textarea
          id="job-description"
          placeholder="Paste the full job description here..."
          value={value}
          onChange={(event) =>
            onChange(event.target.value.slice(0, MAX_JOB_DESCRIPTION_LENGTH))
          }
          onPaste={(event) =>
            handleJobDescriptionPaste(event, {
              resumePopulated,
              onFocusTarget: onPasteFocusTarget,
            })
          }
          className={WORKSPACE_TEXTAREA_CLASS}
        />
      </WorkspaceEditorViewport>
      <p className={atLimit ? WORKSPACE_COUNTER_AT_LIMIT_CLASS : WORKSPACE_COUNTER_CLASS}>
        {value.length.toLocaleString()} / {MAX_JOB_DESCRIPTION_LENGTH.toLocaleString()} characters
        {atLimit ? ' · Character limit reached' : ''}
      </p>
    </div>
  )
}