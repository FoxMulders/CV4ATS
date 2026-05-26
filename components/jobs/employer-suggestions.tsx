import { ExternalLink } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  EDMONTON_EMPLOYER_TARGETS,
  groupEmployersBySector,
} from '@/lib/jobs/edmonton-employers'

export function EmployerSuggestions() {
  const groups = groupEmployersBySector()

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader>
        <CardTitle className="font-heading text-xl">
          Where to find open roles
        </CardTitle>
        <CardDescription>
          {EDMONTON_EMPLOYER_TARGETS.length} Edmonton-area employers scanned for matching openings.
          Open careers portals directly or run a keyword search above.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {groups.map((group) => (
          <div key={group.sector} className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group.label}
            </p>
            <div className="flex flex-wrap gap-2">
              {group.employers.map((employer) => (
                <a
                  key={employer.id}
                  href={employer.careersUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex"
                >
                  <Badge
                    variant="outline"
                    className="gap-1 border-brand-gold/30 bg-background px-2.5 py-1 text-sm font-normal hover:bg-brand-gold/10"
                  >
                    {employer.name}
                    <ExternalLink className="size-3 opacity-60" />
                  </Badge>
                </a>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
