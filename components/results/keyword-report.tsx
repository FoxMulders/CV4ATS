import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { KeywordReport } from '@/lib/ai/schemas'
import { sanitizeKeywordList } from '@/lib/resume/keyword-sanitize'

import {
  SelectableMissingKeywords,
  type SkillSnippetSelection,
} from '@/components/results/editable-skill-snippet-picker'

interface KeywordReportPanelProps {
  report: KeywordReport
  label?: string
  onIncorporateKeywords?: (selections: SkillSnippetSelection[]) => void | Promise<void>
  isRerunning?: boolean
  jobDescription?: string
  resumeText?: string
}

export function KeywordReportPanel({
  report,
  label = 'After tailoring',
  onIncorporateKeywords,
  isRerunning = false,
  jobDescription,
  resumeText,
}: KeywordReportPanelProps) {
  const matchedKeywords = sanitizeKeywordList(report.matchedKeywords)
  const missingKeywords = sanitizeKeywordList(report.missingKeywords)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{label} — matched keywords</CardTitle>
        </CardHeader>
        <CardContent>
          {matchedKeywords.length ? (
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
          ) : null}
        </CardHeader>
        <CardContent>
          {onIncorporateKeywords ? (
            <SelectableMissingKeywords
              keywords={missingKeywords}
              onIncorporate={onIncorporateKeywords}
              isLoading={isRerunning}
              jobDescription={jobDescription}
              resumeText={resumeText}
            />
          ) : missingKeywords.length ? (
            <div className="flex flex-wrap gap-2">
              {missingKeywords.map((keyword) => (
                <Badge key={keyword} variant="outline">
                  {keyword}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No major gaps identified.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Improvement suggestions</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-2 pl-5 text-sm">
            {report.suggestions.map((suggestion) => (
              <li key={suggestion}>{suggestion}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
