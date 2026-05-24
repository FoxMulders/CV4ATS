import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import type { KeywordReport } from '@/lib/ai/schemas'

interface KeywordReportPanelProps {
  report: KeywordReport
}

export function KeywordReportPanel({ report }: KeywordReportPanelProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Match score</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-end gap-3">
            <span className="text-4xl font-bold">{report.matchScore}%</span>
            <span className="pb-1 text-sm text-muted-foreground">
              alignment with job description
            </span>
          </div>
          <Progress value={report.matchScore} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Matched keywords</CardTitle>
        </CardHeader>
        <CardContent>
          {report.matchedKeywords.length ? (
            <div className="flex flex-wrap gap-2">
              {report.matchedKeywords.map((keyword) => (
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
          <CardTitle>Missing keywords</CardTitle>
        </CardHeader>
        <CardContent>
          {report.missingKeywords.length ? (
            <div className="flex flex-wrap gap-2">
              {report.missingKeywords.map((keyword) => (
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
          <CardTitle>Suggestions</CardTitle>
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
