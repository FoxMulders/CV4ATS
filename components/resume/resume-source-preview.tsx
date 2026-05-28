import { WorkspaceEditorViewport } from '@/components/wizard/workspace-editor-viewport'
import { WORKSPACE_PREVIEW_HEIGHT_CLASS } from '@/lib/wizard/workspace-panel-styles'
import { cn } from '@/lib/utils'

interface ResumeSourcePreviewProps {
  text: string
  sourceLabel?: string
  className?: string
}

export function ResumeSourcePreview({ text, sourceLabel, className }: ResumeSourcePreviewProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="text-sm font-medium">Resume preview</p>
        {sourceLabel ? (
          <p className="text-xs text-muted-foreground">{sourceLabel}</p>
        ) : null}
      </div>
      <WorkspaceEditorViewport
        aria-label="Resume source preview"
        className={WORKSPACE_PREVIEW_HEIGHT_CLASS}
        bodyClassName="p-3"
      >
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
          {text}
        </pre>
      </WorkspaceEditorViewport>
    </div>
  )
}
