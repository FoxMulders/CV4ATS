'use client'

import { EditableFieldShell } from '@/components/form/editable-field-shell'
import { EditableTagList } from '@/components/form/editable-tag-list'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import type { KeywordReport } from '@/lib/ai/schemas'
import { isFieldEdited } from '@/lib/form/field-diff'
import { sanitizeKeywordList } from '@/lib/resume/keyword-sanitize'

import {
  SelectableMissingKeywords,
  type SkillSnippetSelection,
} from '@/components/results/editable-skill-snippet-picker'
import { KeywordAuditPanel } from '@/components/results/keyword-audit-panel'
import { AnimatedAtsScoreGauge } from '@/components/results/animated-ats-score-gauge'
import { DynamicKeywordFeedback } from '@/components/results/dynamic-keyword-feedback'

interface KeywordReportPanelProps {
  report: KeywordReport
  baselineReport?: KeywordReport
  onReportChange?: (report: KeywordReport) => void
  label?: string
  onIncorporateKeywords?: (selections: SkillSnippetSelection[]) => void | Promise<void>
  onRestorePurged?: (selections: SkillSnippetSelection[]) => void | Promise<void>
  isRerunning?: boolean
  isRecalculatingScore?: boolean
  jobDescription?: string
  resumeText?: string
}

export function KeywordReportPanel({
  report,
  baselineReport = report,
  onReportChange,
  label = 'After tailoring',
  onIncorporateKeywords,
  onRestorePurged,
  isRerunning = false,
  isRecalculatingScore = false,
  jobDescription,
  resumeText,
}: KeywordReportPanelProps) {
  const editable = Boolean(onReportChange)
  const matchedKeywords = sanitizeKeywordList(report.matchedKeywords)
  const missingKeywords = sanitizeKeywordList(report.missingKeywords)
  const baselineMatched = sanitizeKeywordList(baselineReport.matchedKeywords)
  const baselineMissing = sanitizeKeywordList(baselineReport.missingKeywords)

  function updateReport(patch: Partial<KeywordReport>) {
    onReportChange?.({ ...report, ...patch })
  }

  return (
    <div className="space-y-6">
      {jobDescription?.trim() ? (
        <KeywordAuditPanel
          jobDescription={jobDescription}
          resumeText={resumeText}
          onRestorePurged={onRestorePurged ?? onIncorporateKeywords}
          isRerunning={isRerunning}
        />
      ) : null}

      <DynamicKeywordFeedback
        missingKeywords={missingKeywords}
        matchedKeywords={matchedKeywords}
        suggestions={report.suggestions}
        isUpdating={isRecalculatingScore}
      />

      <Card>
        <CardHeader>
          <CardTitle>{label} — matched keywords</CardTitle>
          {editable ? (
            <CardDescription>
              Click tags to remove or add keywords. Edited rows are highlighted.
            </CardDescription>
          ) : null}
        </CardHeader>
        <CardContent>
          {editable ? (
            <EditableTagList
              label="Matched keywords"
              values={matchedKeywords}
              baselineValues={baselineMatched}
              onChange={(matchedKeywords) => updateReport({ matchedKeywords })}
              placeholder="Add matched keyword…"
              emptyMessage="No matched keywords identified."
            />
          ) : matchedKeywords.length ? (
            <div className="flex flex-wrap gap-2">
              {matchedKeywords.map((keyword) => (
                <Badge key={keyword} variant="secondary">
                  {keyword}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No matched keywords identified.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{label} — missing keywords</CardTitle>
          {onIncorporateKeywords ? (
            <CardDescription>
              Keywords are woven into your resume automatically during tailoring. Click any remaining
              gap below to preview, edit, and re-tailor if needed.
            </CardDescription>
          ) : editable ? (
            <CardDescription>
              Edit missing keyword gaps manually or use the incorporate flow below.
            </CardDescription>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {editable ? (
            <EditableTagList
              label="Missing keywords"
              values={missingKeywords}
              baselineValues={baselineMissing}
              onChange={(missingKeywords) => updateReport({ missingKeywords })}
              placeholder="Add missing keyword…"
              variant="outline"
              emptyMessage="No major gaps identified."
            />
          ) : null}

          {onIncorporateKeywords ? (
            <SelectableMissingKeywords
              keywords={missingKeywords}
              onIncorporate={onIncorporateKeywords}
              isLoading={isRerunning}
              jobDescription={jobDescription}
              resumeText={resumeText}
            />
          ) : !editable && missingKeywords.length ? (
            <div className="flex flex-wrap gap-2">
              {missingKeywords.map((keyword) => (
                <Badge key={keyword} variant="outline">
                  {keyword}
                </Badge>
              ))}
            </div>
          ) : !editable ? (
            <p className="text-sm text-muted-foreground">No major gaps identified.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Improvement suggestions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {editable
            ? report.suggestions.map((suggestion, index) => (
                <EditableFieldShell
                  key={`suggestion-${index}`}
                  label={`Suggestion ${index + 1}`}
                  edited={isFieldEdited(suggestion, baselineReport.suggestions[index])}
                >
                  <Textarea
                    value={suggestion}
                    rows={2}
                    onChange={(event) =>
                      updateReport({
                        suggestions: report.suggestions.map((entry, entryIndex) =>
                          entryIndex === index ? event.target.value : entry
                        ),
                      })
                    }
                  />
                </EditableFieldShell>
              ))
            : (
              <ul className="list-disc space-y-2 pl-5 text-sm">
                {report.suggestions.map((suggestion) => (
                  <li key={suggestion}>{suggestion}</li>
                ))}
              </ul>
            )}

          {editable ? (
            <AnimatedAtsScoreGauge
              score={report.matchScore}
              baselineScore={baselineReport.matchScore}
              label="Match score"
              isUpdating={isRecalculatingScore}
              size="compact"
              structuralWarnings={report.structuralWarnings}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
