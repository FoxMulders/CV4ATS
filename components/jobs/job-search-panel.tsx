'use client'

import { Link2, Loader2, Search } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

import { JobCard, type JobTailorResult } from '@/components/jobs/job-card'
import { AppliedJobsPanel } from '@/components/jobs/applied-jobs-panel'
import { EmployerSuggestions } from '@/components/jobs/employer-suggestions'
import {
  ResumeInputStep,
  isResumeInputReady,
  type ResumeFileParseState,
} from '@/components/wizard/resume-input-step'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAppliedJobs } from '@/hooks/use-applied-jobs'
import { useSavedResume } from '@/hooks/use-saved-resume'
import { parseApiErrorResponse } from '@/lib/api/client-fetch'
import { JOB_SEARCH_FILTER_LABEL } from '@/lib/jobs/filters'
import {
  EDMONTON_EMPLOYER_TARGETS,
  formatEmployerScanLabel,
} from '@/lib/jobs/edmonton-employers'
import { partitionJobsByApplied } from '@/lib/jobs/applied-jobs'
import type { JobIngestResult, JobListing, JobSearchResult } from '@/lib/jobs/types'

export function JobSearchPanel() {
  const [resumeText, setResumeText] = useState('')
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [jobs, setJobs] = useState<JobListing[]>([])
  const [manualJobs, setManualJobs] = useState<JobListing[]>([])
  const [roleQuery, setRoleQuery] = useState('')
  const [location, setLocation] = useState('Edmonton')
  const [jobUrl, setJobUrl] = useState('')
  const [searchMeta, setSearchMeta] = useState<{
    source: string
    query: string
    employerMatches?: number
    employerTargetsQueried?: number
  } | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isIngesting, setIsIngesting] = useState(false)
  const [automatedScanPaused, setAutomatedScanPaused] = useState(false)
  const [tailorResults, setTailorResults] = useState<Record<string, JobTailorResult>>({})
  const [fileParse, setFileParse] = useState<ResumeFileParseState>({
    status: 'idle',
    parsedText: '',
    error: null,
  })
  const {
    appliedJobs,
    hideApplied,
    setHideApplied,
    markApplied,
    unmarkApplied,
    getAppliedRecord,
  } = useAppliedJobs()

  useSavedResume(resumeText, setResumeText, fileParse)

  const handleFileParseChange = useCallback((state: ResumeFileParseState) => {
    setFileParse(state)
  }, [])

  const hasResume = isResumeInputReady(resumeText, resumeFile, fileParse)

  const searchJobs = useCallback(async () => {
    if (automatedScanPaused) return

    setIsSearching(true)
    try {
      const params = new URLSearchParams({
        location: location.trim() || 'Edmonton',
      })
      const trimmedRole = roleQuery.trim()
      if (trimmedRole) {
        params.set('query', trimmedRole)
      }

      const response = await fetch(`/api/jobs/search?${params.toString()}`)
      if (!response.ok) {
        throw new Error(await parseApiErrorResponse(response, 'Job search failed'))
      }

      const result = (await response.json()) as JobSearchResult
      setJobs(result.jobs)
      setSearchMeta({
        source: result.source,
        query: result.query,
        employerMatches: result.employerMatches,
        employerTargetsQueried: result.employerTargetsQueried,
      })
      const employerNote =
        result.employerMatches && result.employerMatches > 0
          ? ` · ${result.employerMatches} from suggested Edmonton employers`
          : ''
      const roleLabel = trimmedRole || 'open roles'
      toast.success(`Found ${result.jobs.length} ${roleLabel} in ${location.trim() || 'Edmonton'}${employerNote}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Job search failed')
    } finally {
      setIsSearching(false)
    }
  }, [automatedScanPaused, location, roleQuery])

  useEffect(() => {
    if (automatedScanPaused) return

    const timer = window.setTimeout(() => {
      void searchJobs()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [searchJobs, automatedScanPaused])

  async function ingestJobLink() {
    const url = jobUrl.trim()
    if (!url) {
      toast.error('Paste a job posting URL first.')
      return
    }

    setIsIngesting(true)
    setAutomatedScanPaused(true)

    try {
      const response = await fetch('/api/jobs/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      if (!response.ok) {
        throw new Error(await parseApiErrorResponse(response, 'Could not parse that job link'))
      }

      const result = (await response.json()) as JobIngestResult
      setManualJobs((current) => {
        const withoutDuplicate = current.filter((job) => job.id !== result.job.id)
        return [result.job, ...withoutDuplicate]
      })
      setJobUrl('')
      toast.success(`Parsed: ${result.job.title} at ${result.job.company}`)
    } catch (error) {
      setAutomatedScanPaused(false)
      toast.error(error instanceof Error ? error.message : 'Could not parse that job link')
    } finally {
      setIsIngesting(false)
    }
  }

  function handleTailorComplete(result: JobTailorResult) {
    setTailorResults((current) => ({ ...current, [result.jobId]: result }))
  }

  function resumeAutomatedScan() {
    setAutomatedScanPaused(false)
    void searchJobs()
  }

  function handleMarkApplied(job: JobListing) {
    if (getAppliedRecord(job)) return
    markApplied(job)
    toast.success(`Saved: applied to ${job.title} at ${job.company}`)
  }

  function handleUnmarkApplied(job: JobListing) {
    unmarkApplied(job)
    toast.message(`Removed ${job.title} from your applied list`)
  }

  function renderJobCard(job: JobListing, manuallyShared = false) {
    return (
      <JobCard
        key={job.id}
        job={job}
        resumeText={resumeText}
        resumeFile={resumeFile}
        fileParse={fileParse}
        tailorResult={tailorResults[job.id]}
        onTailorComplete={handleTailorComplete}
        manuallyShared={manuallyShared}
        appliedRecord={getAppliedRecord(job)}
        onMarkApplied={handleMarkApplied}
        onUnmarkApplied={handleUnmarkApplied}
      />
    )
  }

  const { open: openManualJobs, applied: appliedManualJobs } = partitionJobsByApplied(
    manualJobs,
    appliedJobs
  )
  const visibleManualJobs = hideApplied ? openManualJobs : [...openManualJobs, ...appliedManualJobs]

  const { open: openJobs, applied: appliedJobsInList } = partitionJobsByApplied(jobs, appliedJobs)
  const visibleJobs = hideApplied ? openJobs : [...openJobs, ...appliedJobsInList]

  return (
    <div className="flex flex-col gap-[var(--space-section)]">
      <Card className="border-border/80">
        <CardHeader>
          <CardTitle className="font-heading text-xl">Your resume</CardTitle>
          <CardDescription>
            Upload or paste your resume once — we&apos;ll tailor it for each role below
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResumeInputStep
            resumeText={resumeText}
            onResumeTextChange={setResumeText}
            resumeFile={resumeFile}
            onResumeFileChange={setResumeFile}
            onFileParseChange={handleFileParseChange}
            pasteScrollTargetId="job-results"
          />
        </CardContent>
      </Card>

      <AppliedJobsPanel
        appliedJobs={appliedJobs}
        hideApplied={hideApplied}
        onHideAppliedChange={setHideApplied}
        onUnmarkApplied={handleUnmarkApplied}
      />

      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-heading text-xl">
            <Search className="size-4" />
            Find roles
          </CardTitle>
          <CardDescription>
            Search any job title or keywords — project manager, nurse, accountant, software
            developer, and more. Leave keywords blank to browse Edmonton-area openings.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="job-role-query">Role or keywords</Label>
            <Input
              id="job-role-query"
              placeholder="e.g. project manager, registered nurse, marketing coordinator"
              value={roleQuery}
              onChange={(event) => setRoleQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void searchJobs()
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="job-location">Location</Label>
            <Input
              id="job-location"
              placeholder="Edmonton"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void searchJobs()
              }}
            />
          </div>
          <Button onClick={() => void searchJobs()} disabled={isSearching || automatedScanPaused}>
            {isSearching ? <Loader2 className="animate-spin" /> : <Search />}
            Search jobs
          </Button>
        </CardContent>
      </Card>

      <Card className="border-brand-gold/40 bg-gradient-to-br from-brand-gold/10 to-background">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-heading text-xl">
            <Link2 className="size-4" />
            Paste a job link
          </CardTitle>
          <CardDescription>
            LinkedIn, Workday, Greenhouse, or any direct posting URL. Manual links bypass automated
            filters and take priority over background scanning.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Input
            type="url"
            placeholder="https://ca.linkedin.com/jobs/view/…"
            value={jobUrl}
            onChange={(event) => setJobUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void ingestJobLink()
            }}
          />
          <Button onClick={() => void ingestJobLink()} disabled={isIngesting}>
            {isIngesting ? <Loader2 className="animate-spin" /> : <Link2 />}
            Import job
          </Button>
        </CardContent>
      </Card>

      {manualJobs.length > 0 ? (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Manually shared roles</h2>
            <p className="text-sm text-muted-foreground">
              Parsed from your links · filters bypassed · ready to tailor
            </p>
          </div>
          {visibleManualJobs.map((job) => renderJobCard(job, true))}
        </div>
      ) : null}

      <EmployerSuggestions />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">
            {automatedScanPaused ? 'Automated scan paused' : 'Job search results'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {automatedScanPaused
              ? 'Background job search is paused while you work from a shared link.'
              : searchMeta
                ? `${visibleJobs.length} open roles · ${appliedJobs.length} applied · ${JOB_SEARCH_FILTER_LABEL}${
                    roleQuery.trim() ? ` · "${roleQuery.trim()}"` : ''
                  }${
                    searchMeta.employerMatches
                      ? ` · ${searchMeta.employerMatches} from ${EDMONTON_EMPLOYER_TARGETS.length} suggested employers`
                      : ''
                  }`
                : `Scanning ${formatEmployerScanLabel()}…`}
          </p>
        </div>
        <div className="flex gap-2">
          {automatedScanPaused ? (
            <Button variant="outline" onClick={resumeAutomatedScan} disabled={isSearching}>
              Resume automated scan
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => void searchJobs()} disabled={isSearching || automatedScanPaused}>
            {isSearching ? <Loader2 className="animate-spin" /> : <Search />}
            Refresh jobs
          </Button>
        </div>
      </div>

        {!hasResume && (jobs.length > 0 || manualJobs.length > 0) ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Add your resume above to tailor applications and see match scores for each job.
        </div>
      ) : null}

      {!automatedScanPaused && !isSearching && jobs.length === 0 ? (
        <div className="rounded-lg border border-muted bg-muted/30 p-4 text-sm text-muted-foreground">
          No roles matched your search in {location.trim() || 'Edmonton'}. Try different keywords,
          paste a job link above, or refresh later.
        </div>
      ) : null}

      {!automatedScanPaused ? (
        <div id="job-results" className="space-y-4">
          {isSearching && jobs.length === 0 ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="animate-spin" />
              Loading job listings…
            </div>
          ) : null}

          {visibleJobs.map((job) => renderJobCard(job))}
        </div>
      ) : null}
    </div>
  )
}
