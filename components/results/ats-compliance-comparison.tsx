import { ArrowRight, TrendingUp } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import type { KeywordReport } from '@/lib/ai/schemas'

interface AtsComplianceComparisonProps {
  before: KeywordReport
  after: KeywordReport
  refinementPasses?: number
  targetScoreMet?: boolean
}

function scoreLabel(score: number): string {
  if (score >= 90) return 'Excellent'
  if (score >= 80) return 'Strong'
  if (score >= 60) return 'Moderate'
  if (score >= 40) return 'Needs work'
  return 'Low'
}

function scoreVariant(score: number): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (score >= 90) return 'default'
  if (score >= 60) return 'secondary'
  if (score >= 40) return 'outline'
  return 'destructive'
}

export function AtsComplianceComparison({
  before,
  after,
  refinementPasses = 0,
  targetScoreMet,
}: AtsComplianceComparisonProps) {
  const improvement = after.matchScore - before.matchScore

  return (
    <Card className="border-brand-gold/30 bg-gradient-to-br from-primary/5 via-background to-brand-gold/5 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading text-xl">
          <TrendingUp className="size-4" />
          ATS compliance rank
        </CardTitle>
        <CardDescription>
          Role-specific keyword alignment before and after tailoring
          {refinementPasses > 0
            ? ` · ${refinementPasses} auto-refinement pass${refinementPasses === 1 ? '' : 'es'} applied`
            : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
          <div className="space-y-2 rounded-lg border bg-background p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-muted-foreground">Before tailoring</p>
              <Badge variant={scoreVariant(before.matchScore)}>{scoreLabel(before.matchScore)}</Badge>
            </div>
            <p className="text-3xl font-bold">{before.matchScore}%</p>
            <Progress value={before.matchScore} />
            <p className="text-xs text-muted-foreground">
              {before.matchedKeywords.length} matched · {before.missingKeywords.length} missing
            </p>
          </div>

          <div className="flex flex-col items-center gap-1 text-center">
            <ArrowRight className="hidden size-5 text-muted-foreground md:block" />
            <Badge variant={improvement > 0 ? 'default' : improvement < 0 ? 'destructive' : 'secondary'}>
              {improvement > 0 ? `+${improvement}` : improvement} pts
            </Badge>
          </div>

          <div className="space-y-2 rounded-lg border border-primary/30 bg-background p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-muted-foreground">After tailoring</p>
              <Badge variant={scoreVariant(after.matchScore)}>{scoreLabel(after.matchScore)}</Badge>
            </div>
            <p className="text-3xl font-bold">{after.matchScore}%</p>
            <Progress value={after.matchScore} />
            <p className="text-xs text-muted-foreground">
              {after.matchedKeywords.length} matched · {after.missingKeywords.length} missing
            </p>
          </div>
        </div>

        {targetScoreMet ? (
          <p className="text-sm text-muted-foreground">
            Target ATS alignment of 90%+ reached. Review missing terms below and add only what
            truthfully reflects your background.
          </p>
        ) : improvement > 0 ? (
          <p className="text-sm text-muted-foreground">
            Tailoring improved ATS keyword alignment by {improvement} points. Review missing
            role-specific terms below and add only what truthfully reflects your background.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
