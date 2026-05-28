'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface DynamicKeywordFeedbackProps {
  missingKeywords: string[]
  matchedKeywords: string[]
  suggestions: string[]
  isUpdating?: boolean
}

interface KeywordDiff {
  addedMissing: string[]
  removedMissing: string[]
  addedMatched: string[]
  removedMatched: string[]
}

function diffKeywordLists(previous: string[], current: string[]): { added: string[]; removed: string[] } {
  const prevSet = new Set(previous.map((item) => item.toLowerCase()))
  const currSet = new Set(current.map((item) => item.toLowerCase()))

  const added = current.filter((item) => !prevSet.has(item.toLowerCase()))
  const removed = previous.filter((item) => !currSet.has(item.toLowerCase()))

  return { added, removed }
}

function AnimatedKeywordTag({
  keyword,
  variant,
  highlight,
}: {
  keyword: string
  variant: 'missing' | 'matched' | 'urgent'
  highlight?: 'added' | 'removed' | null
}) {
  return (
    <Badge
      variant={variant === 'matched' ? 'secondary' : 'outline'}
      className={cn(
        'transition-all duration-500',
        variant === 'urgent' && 'border-amber-400/70 bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100',
        highlight === 'added' && 'ring-2 ring-emerald-400/80 scale-105',
        highlight === 'removed' && 'opacity-40 line-through scale-95'
      )}
    >
      {keyword}
    </Badge>
  )
}

export function DynamicKeywordFeedback({
  missingKeywords,
  matchedKeywords,
  suggestions,
  isUpdating = false,
}: DynamicKeywordFeedbackProps) {
  const snapshotRef = useRef({
    missingKeywords,
    matchedKeywords,
    suggestions,
  })
  const [diff, setDiff] = useState<KeywordDiff>({
    addedMissing: [],
    removedMissing: [],
    addedMatched: [],
    removedMatched: [],
  })

  useEffect(() => {
    const previous = snapshotRef.current
    const missingDiff = diffKeywordLists(previous.missingKeywords, missingKeywords)
    const matchedDiff = diffKeywordLists(previous.matchedKeywords, matchedKeywords)

    const hasChanges =
      missingDiff.added.length > 0 ||
      missingDiff.removed.length > 0 ||
      matchedDiff.added.length > 0 ||
      matchedDiff.removed.length > 0

    if (hasChanges) {
      setDiff({
        addedMissing: missingDiff.added,
        removedMissing: missingDiff.removed,
        addedMatched: matchedDiff.added,
        removedMatched: matchedDiff.removed,
      })

      const timer = window.setTimeout(() => {
        setDiff({
          addedMissing: [],
          removedMissing: [],
          addedMatched: [],
          removedMatched: [],
        })
      }, 2600)

      snapshotRef.current = { missingKeywords, matchedKeywords, suggestions }

      return () => window.clearTimeout(timer)
    }

    snapshotRef.current = { missingKeywords, matchedKeywords, suggestions }
  }, [missingKeywords, matchedKeywords, suggestions])

  const urgentItems = missingKeywords.slice(0, 6)

  function missingHighlight(keyword: string): 'added' | 'removed' | null {
    if (diff.removedMissing.some((item) => item.toLowerCase() === keyword.toLowerCase())) {
      return 'removed'
    }
    if (diff.addedMissing.some((item) => item.toLowerCase() === keyword.toLowerCase())) {
      return 'added'
    }
    return null
  }

  function matchedHighlight(keyword: string): 'added' | 'removed' | null {
    if (diff.removedMatched.some((item) => item.toLowerCase() === keyword.toLowerCase())) {
      return 'removed'
    }
    if (diff.addedMatched.some((item) => item.toLowerCase() === keyword.toLowerCase())) {
      return 'added'
    }
    return null
  }

  return (
    <div className="space-y-4">
      <Card className="border-amber-200/80 bg-amber-50/30 dark:border-amber-500/30 dark:bg-amber-950/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
            Urgent optimizations
          </CardTitle>
          <CardDescription>
            Priority gaps recalculated from your latest resume edits
            {isUpdating ? ' · updating…' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {urgentItems.length ? (
            <ul className="space-y-2">
              {urgentItems.map((keyword) => (
                <li
                  key={`urgent-${keyword}`}
                  className={cn(
                    'flex items-center gap-2 rounded-md border border-amber-200/60 bg-background/80 px-3 py-2 text-sm transition-all duration-500',
                    missingHighlight(keyword) === 'added' && 'border-emerald-300/70 bg-emerald-50/50',
                    missingHighlight(keyword) === 'removed' && 'opacity-50'
                  )}
                >
                  <AlertTriangle className="size-3.5 shrink-0 text-amber-600" />
                  <span className="font-medium">{keyword}</span>
                  <span className="ml-auto text-xs text-muted-foreground">Missing from resume</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="size-4" />
              No urgent keyword gaps — strong alignment with the job description.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4" />
            Live keyword shifts
          </CardTitle>
          <CardDescription>
            Newly matched terms appear in green; terms that dropped off fade out after recalculation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Newly matched ({matchedKeywords.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {matchedKeywords.length ? (
                matchedKeywords.map((keyword) => (
                  <AnimatedKeywordTag
                    key={`matched-live-${keyword}`}
                    keyword={keyword}
                    variant="matched"
                    highlight={matchedHighlight(keyword)}
                  />
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No matched keywords yet.</p>
              )}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Still missing ({missingKeywords.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {missingKeywords.length ? (
                missingKeywords.map((keyword) => (
                  <AnimatedKeywordTag
                    key={`missing-live-${keyword}`}
                    keyword={keyword}
                    variant="missing"
                    highlight={missingHighlight(keyword)}
                  />
                ))
              ) : (
                <p className="text-sm text-muted-foreground">All target keywords matched.</p>
              )}
            </div>
          </div>

          {suggestions.length ? (
            <div className="space-y-2 border-t border-border/70 pt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Analytical feedback
              </p>
              <ul className="space-y-2">
                {suggestions.map((suggestion, index) => (
                  <li
                    key={`${index}-${suggestion.slice(0, 24)}`}
                    className="rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-sm transition-all duration-500"
                  >
                    {suggestion}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
