'use client'

import { Loader2, Search } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

import { JobCard, type JobTailorResult } from '@/components/jobs/job-card'
import { ResumeInputStep } from '@/components/wizard/resume-input-step'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { JobListing, JobSearchResult } from '@/lib/jobs/types'

export function JobSearchPanel() {
  const [resumeText, setResumeText] = useState('')
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [jobs, setJobs] = useState<JobListing[]>([])
  const [searchMeta, setSearchMeta] = useState<{ source: string; query: string } | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [tailorResults, setTailorResults] = useState<Record<string, JobTailorResult>>({})

  const hasResume = resumeText.trim().length > 0 || resumeFile !== null

  const searchJobs = useCallback(async () => {
    setIsSearching(true)
    try {
      const response = await fetch(
        '/api/jobs/search?query=project%20manager&location=Edmonton'
      )
      const data = (await response.json()) as JobSearchResult | { error?: string }

      if (!response.ok) {
        throw new Error('error' in data ? data.error : 'Job search failed')
      }

      const result = data as JobSearchResult
      setJobs(result.jobs)
      setSearchMeta({ source: result.source, query: result.query })
      toast.success(`Found ${result.jobs.length} Edmonton project management roles`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Job search failed')
    } finally {
      setIsSearching(false)
    }
  }, [])

  useEffect(() => {
    void searchJobs()
  }, [searchJobs])

  function handleTailorComplete(result: JobTailorResult) {
    setTailorResults((current) => ({ ...current, [result.jobId]: result }))
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Your resume</CardTitle>
          <CardDescription>
            Upload or paste your resume once — we&apos;ll tailor it for each Edmonton PM role
            below
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResumeInputStep
            resumeText={resumeText}
            onResumeTextChange={setResumeText}
            resumeFile={resumeFile}
            onResumeFileChange={setResumeFile}
          />
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Edmonton project management jobs</h2>
          <p className="text-sm text-muted-foreground">
            {searchMeta
              ? `${jobs.length} roles found (${searchMeta.source === 'adzuna' ? 'Adzuna + curated' : 'curated listings'})`
              : 'Searching…'}
          </p>
        </div>
        <Button variant="outline" onClick={searchJobs} disabled={isSearching}>
          {isSearching ? <Loader2 className="animate-spin" /> : <Search />}
          Refresh jobs
        </Button>
      </div>

      {!hasResume ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Add your resume above to tailor applications and see match scores for each job.
        </div>
      ) : null}

      <div className="space-y-4">
        {isSearching && jobs.length === 0 ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="animate-spin" />
            Loading Edmonton project management jobs…
          </div>
        ) : null}

        {jobs.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            resumeText={resumeText}
            resumeFile={resumeFile}
            tailorResult={tailorResults[job.id]}
            onTailorComplete={handleTailorComplete}
          />
        ))}
      </div>
    </div>
  )
}
