'use client'

import { useMemo } from 'react'

import { Badge } from '@/components/ui/badge'
import {
  auditExactPhrasingMatch,
  buildPhrasingHighlightSpans,
} from '@/lib/resume/exact-phrasing-auditor'
import { cn } from '@/lib/utils'

interface PhrasingSimilarityPreviewProps {
  text: string
  jobDescription: string
  showBadge?: boolean
  badgeClassName?: string
  previewClassName?: string
}

export function usePhrasingSimilarityAudit(text: string, jobDescription: string) {
  return useMemo(
    () => auditExactPhrasingMatch(text, jobDescription),
    [text, jobDescription]
  )
}

export function PhrasingSimilarityBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'border-amber-300/80 bg-amber-50/90 text-[11px] font-medium text-amber-900',
        className
      )}
    >
      ⚠️ High Similarity Match
    </Badge>
  )
}

export function PhrasingSimilarityPreview({
  text,
  jobDescription,
  showBadge = true,
  badgeClassName,
  previewClassName,
}: PhrasingSimilarityPreviewProps) {
  const audit = usePhrasingSimilarityAudit(text, jobDescription)
  const spans = useMemo(
    () => buildPhrasingHighlightSpans(text, audit.matches),
    [text, audit.matches]
  )

  if (!audit.hasHighSimilarity) {
    return null
  }

  return (
    <div className="space-y-1.5">
      {showBadge ? <PhrasingSimilarityBadge className={badgeClassName} /> : null}
      <p
        className={cn(
          'rounded-md border border-amber-200/80 bg-amber-50/50 px-2.5 py-2 text-xs leading-relaxed text-foreground',
          previewClassName
        )}
      >
        <span className="font-medium text-amber-950">Matched job description phrasing: </span>
        {spans.map((span, index) =>
          span.highlighted ? (
            <mark
              key={`${index}-${span.text}`}
              className="rounded-sm bg-amber-200/90 px-0.5 text-amber-950"
            >
              {span.text}
            </mark>
          ) : (
            <span key={`${index}-${span.text}`}>{span.text}</span>
          )
        )}
      </p>
    </div>
  )
}
