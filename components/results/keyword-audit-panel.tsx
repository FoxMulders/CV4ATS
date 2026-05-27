'use client'

import { useMemo } from 'react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  SelectablePurgedKeywords,
  type SkillSnippetSelection,
} from '@/components/results/editable-skill-snippet-picker'
import {
  auditKeywordTerms,
  type AuditedKeyword,
} from '@/lib/resume/keyword-audit'
import { extrapolateTargetSkills } from '@/lib/resume/skill-extrapolation'
import {
  buildRestorationsForPurgedKeywords,
  isUserRestorablePurgedKeyword,
  prioritizeRestorablePurgedKeywords,
  resumeSupportsPurgedTerm,
} from '@/lib/resume/purged-keyword-restore'

interface KeywordAuditPanelProps {
  jobDescription: string
  resumeText?: string
  onRestorePurged?: (selections: SkillSnippetSelection[]) => void | Promise<void>
  isRerunning?: boolean
}

function AuditGroup({
  title,
  icon,
  items,
  emptyMessage,
  resumeText = '',
  showResumeSupportBadge = false,
}: {
  title: string
  icon: string
  items: AuditedKeyword[]
  emptyMessage: string
  resumeText?: string
  showResumeSupportBadge?: boolean
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">
        {icon} {title}
      </p>
      {items.length ? (
        <ul className="space-y-2 text-sm">
          {items.map((item) => (
            <li
              key={`${title}-${item.original}`}
              className="rounded-md border border-border/70 bg-background/80 px-3 py-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{item.original}</Badge>
                {item.term !== item.original ? (
                  <>
                    <span className="text-muted-foreground">→</span>
                    <Badge variant="secondary">{item.term}</Badge>
                  </>
                ) : null}
                {showResumeSupportBadge &&
                resumeText &&
                resumeSupportsPurgedTerm(item.original, resumeText) ? (
                  <Badge variant="secondary" className="text-[10px]">
                    Resume supports
                  </Badge>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{item.reason}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">{emptyMessage}</p>
      )}
    </div>
  )
}

export function KeywordAuditPanel({
  jobDescription,
  resumeText = '',
  onRestorePurged,
  isRerunning = false,
}: KeywordAuditPanelProps) {
  const targetSkills = extrapolateTargetSkills(jobDescription)
  const rawTerms = targetSkills.map((skill) => skill.term)
  const audit = auditKeywordTerms(rawTerms, resumeText)
  const activeCount = audit.approved.length + audit.modified.length
  const evaluatedCount = audit.approved.length + audit.modified.length + audit.purged.length

  const restorablePurged = useMemo(
    () =>
      prioritizeRestorablePurgedKeywords(
        audit.purged.filter(isUserRestorablePurgedKeyword),
        resumeText
      ),
    [audit.purged, resumeText]
  )

  const restorationItems = useMemo(
    () =>
      buildRestorationsForPurgedKeywords(restorablePurged, {
        resumeText,
        jobDescription,
      }),
    [restorablePurged, resumeText, jobDescription]
  )

  if (audit.purged.length === 0 && audit.modified.length === 0 && audit.approved.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      <Card className="border-amber-200/80 bg-amber-50/40">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">ATS compliance auditor</CardTitle>
              <CardDescription>
                Keywords extracted from the job description are verified for truthfulness and human
                readability before they influence your resume. Coherence beats a superficial 100%
                match.
              </CardDescription>
            </div>
            <Badge variant="default" className="shrink-0">
              Active · {activeCount}/{targetSkills.length} skills aligned
            </Badge>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Scoring denominator locked to {targetSkills.length} target skill
            {targetSkills.length === 1 ? '' : 's'} · {evaluatedCount} evaluated ·{' '}
            {audit.modified.length} soft-matched for context
          </p>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-3">
          <AuditGroup
            title="Purged"
            icon="❌"
            items={audit.purged}
            emptyMessage="No scraper junk or irrelevant domain terms detected."
            resumeText={resumeText}
            showResumeSupportBadge
          />
          <AuditGroup
            title="Modified for context"
            icon="⚠️"
            items={audit.modified}
            emptyMessage="No semantic or contextual skill matches detected yet."
          />
          <AuditGroup
            title="Approved"
            icon="✅"
            items={audit.approved}
            emptyMessage="No approved ATS keywords detected."
          />
        </CardContent>
      </Card>

      {onRestorePurged && restorationItems.length > 0 ? (
        <Card className="border-sky-200/80 bg-sky-50/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Restore purged competencies</CardTitle>
            <CardDescription>
              Some terms were filtered out automatically — but you can restore competencies you
              genuinely possess. Select a purged phrase to preview suggested placement, edit the
              wording, and re-tailor your resume.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SelectablePurgedKeywords
              items={restorationItems}
              onIncorporate={onRestorePurged}
              isLoading={isRerunning}
              jobDescription={jobDescription}
              resumeText={resumeText}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
