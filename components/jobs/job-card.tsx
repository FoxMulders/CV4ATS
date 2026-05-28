'use client'

import {
  Briefcase,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  MapPin,
  Sparkles,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { parseApiErrorResponse } from '@/lib/api/client-fetch'
import { formatScorePassLine } from '@/lib/api/generation-config'
import { consumeGenerationStream, coalesceStreamingResume, type ScorePassEvent } from '@/lib/api/progress-stream'

import { CoverLetterPreview } from '@/components/results/cover-letter-preview'
import { DownloadActions } from '@/components/results/download-actions'
import { AtsComplianceComparison } from '@/components/results/ats-compliance-comparison'
import { KeywordReportPanel } from '@/components/results/keyword-report'
import {
  SelectableMissingKeywords,
  type SkillSnippetSelection,
} from '@/components/results/editable-skill-snippet-picker'
import { EditableResumePreview } from '@/components/results/editable-resume-preview'
import { UndoRedoToolbar } from '@/components/results/undo-redo-toolbar'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { GenerationResult, TailoredResume } from '@/lib/ai/schemas'
import type { PreScanResult } from '@/lib/resume/pre-scan-preparation'
import type { JobListing } from '@/lib/jobs/types'
import { formatJobDescriptionForAi } from '@/lib/jobs/types'
import { getEmployerDisplayName } from '@/lib/jobs/edmonton-employers'
import {
  getResumeTextForSubmit,
  isResumeInputReady,
  type ResumeFileParseState,
} from '@/components/wizard/resume-input-step'
import { GenerationProgress } from '@/components/wizard/generation-progress'
import { StreamingResumePreview } from '@/components/wizard/streaming-resume-preview'
import { serializeTailoredResume } from '@/lib/resume/ats-score'
import { sanitizeKeywordList } from '@/lib/resume/keyword-sanitize'
import { useUndoableResume } from '@/hooks/use-undoable-resume'
import { formatAppliedDate, type AppliedJobRecord } from '@/lib/jobs/applied-jobs'

export interface JobTailorResult extends GenerationResult {
  jobId: string
  job: JobListing
  refinementPasses?: number
  targetScoreMet?: boolean
  preScan?: PreScanResult
  incorporatedKeywords?: string[]
  passHistory?: ScorePassEvent[]
}

interface JobCardProps {
  job: JobListing
  resumeText: string
  resumeFile: File | null
  fileParse: ResumeFileParseState
  tailorResult?: JobTailorResult
  onTailorComplete: (result: JobTailorResult) => void
  manuallyShared?: boolean
  appliedRecord?: AppliedJobRecord
  onMarkApplied?: (job: JobListing) => void
  onUnmarkApplied?: (job: JobListing) => void
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
  fileParse,
  tailorResult,
  onTailorComplete,
  manuallyShared = false,
  appliedRecord,
  onMarkApplied,
  onUnmarkApplied,
}: JobCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [isTailoring, setIsTailoring] = useState(false)
  const [tailorStep, setTailorStep] = useState(0)
  const [tailorLabel, setTailorLabel] = useState<string | null>(null)
  const [scorePassLines, setScorePassLines] = useState<string[]>([])
  const [streamingResume, setStreamingResume] = useState<TailoredResume | null>(null)
  const [coverLetter, setCoverLetter] = useState(tailorResult?.coverLetter ?? '')
  const {
    resume: editedResume,
    pushResume: pushEditedResume,
    replaceResume: replaceEditedResume,
    resetResume: resetEditedResume,
    undo: undoResumeEdit,
    redo: redoResumeEdit,
    canUndo: canUndoResumeEdit,
    canRedo: canRedoResumeEdit,
  } = useUndoableResume(tailorResult?.tailoredResume ?? null)

  useEffect(() => {
    if (tailorResult?.coverLetter) {
      setCoverLetter(tailorResult.coverLetter)
    }
  }, [tailorResult?.jobId, tailorResult?.coverLetter])

  useEffect(() => {
    if (tailorResult?.tailoredResume) {
      resetEditedResume(tailorResult.tailoredResume)
    }
  }, [tailorResult?.jobId, tailorResult?.tailoredResume, resetEditedResume])

  async function handleTailor(options: {
    selections?: SkillSnippetSelection[]
    resumeOverride?: string
  } = {}) {
    if (!options.resumeOverride && !isResumeInputReady(resumeText, resumeFile, fileParse)) {
      if (fileParse.status === 'parsing') {
        toast.error('Wait for resume extraction to finish.')
        return
      }
      if (fileParse.status === 'error') {
        toast.error(fileParse.error ?? 'Fix resume upload errors before tailoring.')
        return
      }
      toast.error('Add your resume before tailoring applications.')
      return
    }

    setIsTailoring(true)
    setTailorStep(0)
    setTailorLabel(null)
    setScorePassLines([])
    setStreamingResume(null)
    try {
      const formData = new FormData()
      formData.append('job', JSON.stringify(job))

      if (options.resumeOverride) {
        formData.append('resumeText', options.resumeOverride)
      } else {
        const resumePayload = getResumeTextForSubmit(resumeText, resumeFile, fileParse)
        if (resumePayload.resumeText) {
          formData.append('resumeText', resumePayload.resumeText)
        } else if (resumePayload.file) {
          formData.append('file', resumePayload.file)
        }
      }

      if (options.selections?.length) {
        formData.append(
          'selectedKeywords',
          JSON.stringify(options.selections.map((item) => item.keyword))
        )
        formData.append(
          'anchoredModifications',
          JSON.stringify(
            options.selections.map((item) => ({
              snippet: item.snippet,
              positionId: item.positionId,
              bulletIndex: item.bulletIndex,
              originalBullet: item.originalBullet,
              bulletLineIndex: item.bulletLineIndex,
              modificationType: item.modificationType,
            }))
          )
        )
      }

      const response = await fetch('/api/jobs/tailor', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error(await parseApiErrorResponse(response, 'Tailoring failed'))
      }

      const result = await consumeGenerationStream<JobTailorResult>(response, {
        onProgress: (step, label) => {
          setTailorStep(step)
          setTailorLabel(label)
        },
        onScorePass: (event) => {
          setScorePassLines((current) => [...current, formatScorePassLine(event)])
        },
        onPartial: (preview) => {
          const resumeSnapshot = coalesceStreamingResume(preview)
          if (resumeSnapshot) {
            setStreamingResume(resumeSnapshot)
            replaceEditedResume(resumeSnapshot)
          }
        },
      })
      setCoverLetter(result.coverLetter)
      onTailorComplete(result)
      setExpanded(true)

      if (options.selections?.length) {
        toast.success(
          `Re-tailored with ${options.selections.length} addition${options.selections.length === 1 ? '' : 's'} incorporated`
        )
      } else {
        const injected = result.incorporatedKeywords?.length ?? 0
        toast.success(
          injected > 0
            ? `Application tailored for ${job.title} — ${injected} keywords woven in`
            : `Application tailored for ${job.title}`
        )
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Tailoring failed')
    } finally {
      setIsTailoring(false)
    }
  }

  async function handleIncorporateKeywords(selections: SkillSnippetSelection[]) {
    const resumeOverride =
      editedResume != null
        ? serializeTailoredResume(editedResume)
        : tailorResult
          ? serializeTailoredResume(tailorResult.tailoredResume)
          : undefined

    if (!resumeOverride) {
      toast.error('Tailor this application before incorporating keywords.')
      return
    }

    await handleTailor({ selections, resumeOverride })
  }

  const afterScore = tailorResult?.keywordReport.matchScore
  const beforeScore = tailorResult?.baselineKeywordReport.matchScore
  const priorityEmployerName = job.targetEmployerId
    ? getEmployerDisplayName(job.targetEmployerId)
    : undefined
  const jobDescriptionForAi = formatJobDescriptionForAi(job)
  const resumeContextText =
    editedResume != null
      ? serializeTailoredResume(editedResume)
      : tailorResult
        ? serializeTailoredResume(tailorResult.tailoredResume)
        : getResumeTextForSubmit(resumeText, resumeFile, fileParse).resumeText ?? resumeText

  return (
    <Card
      className={`border-border/80 shadow-sm transition-shadow hover:shadow-md ${
        appliedRecord ? 'border-emerald-200/80 bg-emerald-50/20' : ''
      }`}
    >
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-lg">{job.title}</CardTitle>
              {manuallyShared ? <Badge variant="secondary">Manually shared</Badge> : null}
              {appliedRecord ? (
                <Badge className="bg-emerald-700 text-white hover:bg-emerald-700">
                  <CheckCircle2 className="size-3" />
                  Applied {formatAppliedDate(appliedRecord.appliedAt)}
                </Badge>
              ) : null}
              {priorityEmployerName ? (
                <Badge variant="outline" className="border-brand-gold/60 text-brand-gold">
                  {priorityEmployerName}
                </Badge>
              ) : null}
            </div>
            <CardDescription className="flex flex-wrap items-center gap-2">
              <Briefcase className="size-3.5" />
              {job.company}
              <span className="text-muted-foreground">•</span>
              <MapPin className="size-3.5" />
              {job.location}
              <span className="text-muted-foreground">•</span>
              {job.source}
            </CardDescription>
          </div>
          {afterScore !== undefined ? (
            <div className="flex flex-col items-end gap-1">
              {beforeScore !== undefined ? (
                <span className="text-xs text-muted-foreground">ATS: {beforeScore}% → {afterScore}%</span>
              ) : null}
              <Badge variant={scoreVariant(afterScore)} className="text-sm">
                After: {afterScore}%
              </Badge>
            </div>
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
          <Button
            onClick={() => handleTailor()}
            disabled={isTailoring || fileParse.status === 'parsing'}
          >
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

          {isTailoring ? (
            <div className="w-full basis-full space-y-3">
              <GenerationProgress
                loadingStep={tailorStep}
                activeLabel={tailorLabel}
                scorePassLines={scorePassLines}
                compact
              />
              {streamingResume ? <StreamingResumePreview resume={streamingResume} /> : null}
            </div>
          ) : null}

          <a
            href={job.applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: 'outline' })}
            onClick={() => onMarkApplied?.(job)}
          >
            <ExternalLink />
            Apply for this job
          </a>

          {appliedRecord ? (
            <Button type="button" variant="ghost" onClick={() => onUnmarkApplied?.(job)}>
              Undo applied
            </Button>
          ) : (
            <Button type="button" variant="secondary" onClick={() => onMarkApplied?.(job)}>
              <CheckCircle2 />
              Mark as applied
            </Button>
          )}

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
                <AtsComplianceComparison
                  before={tailorResult.baselineKeywordReport}
                  after={tailorResult.keywordReport}
                  refinementPasses={tailorResult.refinementPasses}
                  targetScoreMet={tailorResult.targetScoreMet}
                />

                <Tabs defaultValue="improvements">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <TabsList>
                      <TabsTrigger value="improvements">Improve score</TabsTrigger>
                      <TabsTrigger value="resume">Tailored resume</TabsTrigger>
                      <TabsTrigger value="cover">Cover letter</TabsTrigger>
                      <TabsTrigger value="keywords">Keyword report</TabsTrigger>
                    </TabsList>
                    <UndoRedoToolbar
                      canUndo={canUndoResumeEdit}
                      canRedo={canRedoResumeEdit}
                      onUndo={undoResumeEdit}
                      onRedo={redoResumeEdit}
                      enabled={Boolean(editedResume)}
                    />
                  </div>

                  <TabsContent value="improvements" className="mt-4 space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Missing keywords to add</CardTitle>
                        <CardDescription>
                          Weave these into your resume if they truthfully reflect your experience
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <SelectableMissingKeywords
                          keywords={sanitizeKeywordList(tailorResult.keywordReport.missingKeywords)}
                          onIncorporate={handleIncorporateKeywords}
                          isLoading={isTailoring}
                          jobDescription={jobDescriptionForAi}
                          resumeText={resumeContextText}
                        />
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
                    {editedResume ? (
                      <EditableResumePreview
                        resume={editedResume}
                        onResumeChange={pushEditedResume}
                        jobDescription={jobDescriptionForAi}
                      />
                    ) : null}
                  </TabsContent>

                  <TabsContent value="cover" className="mt-4">
                    <CoverLetterPreview
                      fieldId={`cover-letter-${job.id}`}
                      value={coverLetter}
                      onChange={setCoverLetter}
                    />
                  </TabsContent>

                  <TabsContent value="keywords" className="mt-4">
                    <KeywordReportPanel
                      report={tailorResult.keywordReport}
                      onIncorporateKeywords={handleIncorporateKeywords}
                      isRerunning={isTailoring}
                      jobDescription={jobDescriptionForAi}
                      resumeText={resumeContextText}
                    />
                  </TabsContent>
                </Tabs>

                <DownloadActions
                  resume={editedResume ?? tailorResult.tailoredResume}
                  coverLetter={coverLetter}
                />

                <a
                  href={job.applyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ size: 'lg' })}
                  onClick={() => onMarkApplied?.(job)}
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
