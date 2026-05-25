interface ResumeSourcePreviewProps {
  text: string
  sourceLabel?: string
}

export function ResumeSourcePreview({ text, sourceLabel }: ResumeSourcePreviewProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Resume preview</p>
        {sourceLabel ? (
          <p className="text-xs text-muted-foreground">{sourceLabel}</p>
        ) : null}
      </div>
      <div className="max-h-80 overflow-y-auto rounded-lg border bg-muted/30 p-4">
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
          {text}
        </pre>
      </div>
    </div>
  )
}
