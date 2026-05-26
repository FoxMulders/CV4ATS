'use client'

import { CheckCircle2, Eye, EyeOff, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatAppliedDate, type AppliedJobRecord } from '@/lib/jobs/applied-jobs'
import type { JobListing } from '@/lib/jobs/types'

interface AppliedJobsPanelProps {
  appliedJobs: AppliedJobRecord[]
  hideApplied: boolean
  onHideAppliedChange: (hide: boolean) => void
  onUnmarkApplied: (job: JobListing) => void
}

export function AppliedJobsPanel({
  appliedJobs,
  hideApplied,
  onHideAppliedChange,
  onUnmarkApplied,
}: AppliedJobsPanelProps) {
  if (appliedJobs.length === 0) {
    return null
  }

  return (
    <Card className="border-emerald-200/80 bg-emerald-50/40 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 font-heading text-xl">
              <CheckCircle2 className="size-5 text-emerald-700" />
              Applications tracked
            </CardTitle>
            <CardDescription>
              Saved in this browser only — {appliedJobs.length} role
              {appliedJobs.length === 1 ? '' : 's'} marked as applied.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onHideAppliedChange(!hideApplied)}
          >
            {hideApplied ? <Eye /> : <EyeOff />}
            {hideApplied ? 'Show applied roles' : 'Hide applied roles'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {appliedJobs.map((record) => (
            <li
              key={record.key}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-100 bg-background/80 px-3 py-2 text-sm"
            >
              <div className="min-w-0 space-y-0.5">
                <p className="font-medium">{record.title}</p>
                <p className="text-muted-foreground">
                  {record.company}
                  {record.location ? ` · ${record.location}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-900">
                  Applied {formatAppliedDate(record.appliedAt)}
                </Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    onUnmarkApplied({
                      id: record.jobId,
                      title: record.title,
                      company: record.company,
                      location: record.location,
                      description: '',
                      applyUrl: record.applyUrl,
                      source: 'applied-history',
                      targetEmployerId: record.targetEmployerId,
                    })
                  }
                >
                  <Trash2 className="size-3.5" />
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
