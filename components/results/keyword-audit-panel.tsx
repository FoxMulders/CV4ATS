'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  auditKeywordTerms,
  type AuditedKeyword,
} from '@/lib/resume/keyword-audit'
import { extractHighValueKeywords } from '@/lib/resume/keyword-extraction'

interface KeywordAuditPanelProps {
  jobDescription: string
  resumeText?: string
}

function AuditGroup({
  title,
  icon,
  items,
  emptyMessage,
}: {
  title: string
  icon: string
  items: AuditedKeyword[]
  emptyMessage: string
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

export function KeywordAuditPanel({ jobDescription, resumeText = '' }: KeywordAuditPanelProps) {
  const rawTerms = extractHighValueKeywords(jobDescription)
  const audit = auditKeywordTerms(rawTerms, resumeText)

  if (audit.purged.length === 0 && audit.modified.length === 0 && audit.approved.length === 0) {
    return null
  }

  return (
    <Card className="border-amber-200/80 bg-amber-50/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">ATS compliance auditor</CardTitle>
        <CardDescription>
          Keywords extracted from the job description are verified for truthfulness and human
          readability before they influence your resume. Coherence beats a superficial 100% match.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-3">
        <AuditGroup
          title="Purged"
          icon="❌"
          items={audit.purged}
          emptyMessage="No scraper junk or irrelevant domain terms detected."
        />
        <AuditGroup
          title="Modified for context"
          icon="⚠️"
          items={audit.modified}
          emptyMessage="No bare keywords needed rephrasing."
        />
        <AuditGroup
          title="Approved"
          icon="✅"
          items={audit.approved}
          emptyMessage="No approved ATS keywords detected."
        />
      </CardContent>
    </Card>
  )
}
