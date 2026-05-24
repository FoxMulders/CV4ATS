import { Shield } from 'lucide-react'

import { JobSearchPanel } from '@/components/jobs/job-search-panel'
import { AppNav } from '@/components/nav/app-nav'

export default function JobsPage() {
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Edmonton Job Search</h1>
            <p className="text-sm text-muted-foreground">
              Project management roles in the Edmonton area — tailored resume, score, and apply
            </p>
          </div>
          <AppNav current="jobs" />
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
        <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
          <Shield className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>
            Your resume is processed in memory and never stored. Apply links open the employer&apos;s
            official application portal.
          </p>
        </div>

        <JobSearchPanel />
      </main>
    </div>
  )
}
