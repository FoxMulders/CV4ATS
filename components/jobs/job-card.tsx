'use client'

import {
  Briefcase,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  MapPin,
  Sparkles,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { CoverLetterPreview } from '@/components/results/cover-letter-preview'
import { DownloadActions } from '@/components/results/download-actions'
import { KeywordReportPanel } from '@/components/results/keyword-report'
import { ResumePreview } from '@/components/results/resume-preview'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { GenerationResult } from '@/lib/ai/schemas'
import type { JobListing } from '@/lib/jobs/types'

export interface JobTailorResult extends GenerationResult {
  jobId: string
  job: JobListing
}

interface JobCardProps {
  job: JobListing
  resumeText: string
  resumeFile: File | null
  tailorResult?: JobTailorResult
  onTailorComplete: (result: JobTailorResult) => void
}

function scoreVariant(score: number): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (score >= 80) return 'default'
  if (score >= 60) return 'secondary'
  if (score >= 40) return 'outline'
  return 'destructive'
}

export function JobCard({
  job,
  resumeText,
  resumeFile,
  tailorResult,
  onTailorComplete,
}: JobCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [isTailoring, setIsTailoring] = useState(false)
  const [coverLetter, setCoverLetter] = useState(tailorResult?.coverLetter ?? '')

  async function handleTailor() {
    if (!resumeText.trim() && !resumeFile) {
      toast.error('Add your resume before tailoring applications.')
      return
    }

    setIsTailoring(true)
    try {
      const formData = new FormData()
      formData.append('job', JSON.stringify(job))

      if (resumeFile) {
        formData.append('file', resumeFile)
      } else {
        formData.append('resumeText', resumeText.trim())
      }

      const response = await fetch('/api/jobs/tailor', {
        method: 'POST',
        body: formData,
      })

      const data = (await response.json()) as JobTailorResult | { error?: string }

      if (!response.ok) {
        throw new Error('error' in data ? data.error : 'Tailoring failed')
      }

      const result = data as JobTailorResult
      setCoverLetter(result.coverLetter)
      onTailorComplete(result)
      setExpanded(true)
      toast.success(`Application tailored for ${job.title}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Tailoring failed')
    } finally {
      setIsTailoring(false)
    }
  }

  const score = tailorResult?.keywordReport.matchScore

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-lg">{job.title}</CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-2">
              <Briefcase className="size-3.5" />
              {job.company}
              <span className="text-muted-foreground">•</span>
              <MapPin className="size-3.5" />
              {job.location}
            </CardDescription>
          </div>
          {score !== undefined ? (
            <Badge variant={scoreVariant(score)} className="text-sm">
              Match: {score}%
            </Badge>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          {job.salary ? (
            <p>
              <span className="font-medium">Salary:</span> {job.salary}
            </p>
          ) : null}
          {job.employmentType ? (
            <p>
              <span className="font-medium">Type:</span> {job.employmentType}
            </p>
          ) : null}
          {job.postedDate ? (
            <p>
              <span className="font-medium">Posted:</span> {job.postedDate}
            </p>
          ) : null}
          {job.closingDate ? (
            <p>
              <span className="font-medium">Closes:</span> {job.closingDate}
            </p>
          ) : null}
        </div>

        <p className="text-sm text-muted-foreground line-clamp-3">{job.description}</p>

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleTailor} disabled={isTailoring}>
            {isTailoring ? (
              <>
                <Loader2 className="animate-spin" />
                Tailoring…
              </>
            ) : (
              <>
                <Sparkles />
                Tailor application
              </>
            )}
          </Button>

          <a
            href={job.applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: 'outline' })}
          >
            <ExternalLink />
            Apply for this job
          </a>

          <Button variant="ghost" onClick={() => setExpanded((value) => !value)}>
            {expanded ? <ChevronUp /> : <ChevronDown />}
            {expanded ? 'Hide details' : 'Show details'}
          </Button>
        </div>

        {expanded ? (
          <div className="space-y-6 border-t pt-4">
            <div>
              <h4 className="mb-2 font-semibold">Full job description</h4>
              <div className="whitespace-pre-wrap rounded-lg bg-muted/50 p-4 text-sm">
                {job.description}
              </div>
            </div>

            {tailorResult ? (
              <>
                <div className="space-y-3">
                  <h4 className="font-semibold">Your match score</h4>
                  <div className="flex items-end gap-3">
                    <span className="text-3xl font-bold">
                      {tailorResult.keywordReport.matchScore}%
                    </span>
                    <Progress value={tailorResult.keywordReport.matchScore} className="flex-1" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    To increase your score, address the missing keywords and suggestions below
                    before applying.
                  </p>
                </div>

                <Tabs defaultValue="improvements">
                  <TabsList>
                    <TabsTrigger value="improvements">Improve score</TabsTrigger>
                    <TabsTrigger value="resume">Tailored resume</TabsTrigger>
                    <TabsTrigger value="cover">Cover letter</TabsTrigger>
                    <TabsTrigger value="keywords">Keyword report</TabsTrigger>
                  </TabsList>

                  <TabsContent value="improvements" className="mt-4 space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Missing keywords to add</CardTitle>
                        <CardDescription>
                          Weave these into your resume if they truthfully reflect your experience
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {tailorResult.keywordReport.missingKeywords.length ? (
                          <div className="flex flex-wrap gap-2">
                            {tailorResult.keywordReport.missingKeywords.map((keyword) => (
                              <Badge key={keyword} variant="outline">
                                {keyword}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            No major keyword gaps identified.
                          </p>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Actions to increase your score</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="list-disc space-y-2 pl-5 text-sm">
                          {tailorResult.keywordReport.suggestions.map((suggestion) => (
                            <li key={suggestion}>{suggestion}</li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="resume" className="mt-4">
                    <ResumePreview resume={tailorResult.tailoredResume} />
                  </TabsContent>

                  <TabsContent value="cover" className="mt-4">
                    <CoverLetterPreview value={coverLetter} onChange={setCoverLetter} />
                  </TabsContent>

                  <TabsContent value="keywords" className="mt-4">
                    <KeywordReportPanel report={tailorResult.keywordReport} />
                  </TabsContent>
                </Tabs>

                <DownloadActions
                  resume={tailorResult.tailoredResume}
                  coverLetter={coverLetter}
                />

                <a
                  href={job.applyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ size: 'lg' })}
                >
                  <ExternalLink />
                  Submit application for {job.title}
                </a>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Click &quot;Tailor application&quot; to generate a job-specific resume, cover
                letter, and match score.
              </p>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
