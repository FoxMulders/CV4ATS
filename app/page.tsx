'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

import { PremiumUnlockBanner } from '@/components/billing/premium-unlock-banner'
import { SquareCheckoutModal } from '@/components/billing/square-checkout-modal'
import { PageHero } from '@/components/layout/page-hero'
import { SiteFooter } from '@/components/layout/site-footer'
import { SiteHeader } from '@/components/layout/site-header'
import { StepCard } from '@/components/layout/step-card'
import { TrustBanner } from '@/components/layout/trust-banner'
import { CompetitiveAdvantagesSection } from '@/components/marketing/competitive-advantages-section'
import { TargetSkillsPanel } from '@/components/resume/target-skills-panel'
import { AtsComplianceComparison } from '@/components/results/ats-compliance-comparison'
import { CoverLetterPreview } from '@/components/results/cover-letter-preview'
import {
  DownloadActions,
} from '@/components/results/download-actions'
import { KeywordReportPanel } from '@/components/results/keyword-report'
import type { SkillSnippetSelection } from '@/components/results/editable-skill-snippet-picker'
import { EditableResumePreview } from '@/components/results/editable-resume-preview'
import { ResumeDiffView } from '@/components/results/resume-diff-view'
import { UndoRedoToolbar } from '@/components/results/undo-redo-toolbar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GenerateStep } from '@/components/wizard/generate-step'
import { StreamingResumePreview } from '@/components/wizard/streaming-resume-preview'
import { JobDescriptionStep } from '@/components/wizard/job-description-step'
import {
  ResumeInputStep,
  getResumeTextForSubmit,
  isResumeInputReady,
  type ResumeFileParseState,
} from '@/components/wizard/resume-input-step'
import { formatScorePassLine } from '@/lib/api/generation-config'
import { useJobPass } from '@/hooks/use-job-pass'
import { useSavedResume } from '@/hooks/use-saved-resume'
import { useUndoableResume } from '@/hooks/use-undoable-resume'
import { coalesceStreamingResume, consumeGenerationStream } from '@/lib/api/progress-stream'
import { parseApiErrorResponse } from '@/lib/api/client-fetch'
import type { GenerationResult, TailoredResume } from '@/lib/ai/schemas'
import type { PreScanResult } from '@/lib/resume/pre-scan-preparation'
import { serializeTailoredResume } from '@/lib/resume/ats-score'

type GenerationResultWithMeta = GenerationResult & {
  refinementPasses?: number
  targetScoreMet?: boolean
  preScan?: PreScanResult
  incorporatedKeywords?: string[]
}

type GenerateOptions = {
  selectedKeywords?: string[]
  customSnippets?: string[]
  resumeOverride?: string
}

export default function HomePage() {
  const [jobDescription, setJobDescription] = useState('')
  const [resumeText, setResumeText] = useState('')
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const [loadingLabel, setLoadingLabel] = useState<string | null>(null)
  const [scorePassLines, setScorePassLines] = useState<string[]>([])
  const [streamingResume, setStreamingResume] = useState<TailoredResume | null>(null)
  const [streamingCoverLetter, setStreamingCoverLetter] = useState('')
  const [result, setResult] = useState<GenerationResultWithMeta | null>(null)
  const {
    resume: editedResume,
    pushResume: pushEditedResume,
    resetResume: resetEditedResume,
    undo: undoResumeEdit,
    redo: redoResumeEdit,
    canUndo: canUndoResumeEdit,
    canRedo: canRedoResumeEdit,
  } = useUndoableResume(null)
  const [coverLetter, setCoverLetter] = useState('')
  const [fileParse, setFileParse] = useState<ResumeFileParseState>({
    status: 'idle',
    parsedText: '',
    error: null,
  })
  const [preScanPreview, setPreScanPreview] = useState<PreScanResult | null>(null)
  const [preScanLoading, setPreScanLoading] = useState(false)
  const [originalResumeText, setOriginalResumeText] = useState<string | null>(null)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const {
    accessToken,
    isUnlocked,
    unlock,
    checkoutEnabled,
    jobDescriptionHash,
    passExpiryLabel,
  } = useJobPass(jobDescription)

  useSavedResume(resumeText, setResumeText, fileParse)

  const handleFileParseChange = useCallback((state: ResumeFileParseState) => {
    setFileParse(state)
  }, [])

  const activeResumeText =
    resumeText.trim() ||
    (fileParse.status === 'ready' ? fileParse.parsedText.trim() : '')

  useEffect(() => {
    const jobText = jobDescription.trim()
    if (!jobText || !activeResumeText) {
      setPreScanPreview(null)
      return
    }

    const timer = window.setTimeout(async () => {
      setPreScanLoading(true)
      try {
        const response = await fetch('/api/pre-scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobDescription: jobText,
            resumeText: activeResumeText,
            autoInject: false,
          }),
        })

        if (!response.ok) return
        const data = (await response.json()) as PreScanResult
        setPreScanPreview(data)
      } catch {
        setPreScanPreview(null)
      } finally {
        setPreScanLoading(false)
      }
    }, 600)

    return () => window.clearTimeout(timer)
  }, [jobDescription, activeResumeText])

  function handleInsertSkillSelections(selections: SkillSnippetSelection[]) {
    setResumeFile(null)
    setResumeText((current) => {
      const base = current.trim() || activeResumeText
      return selections
        .map((item) => item.snippet.trim())
        .filter(Boolean)
        .reduce((text, snippet) => `${text.trim()}\n\n${snippet}`, base)
    })
    toast.success(
      `Inserted ${selections.length} sentence${selections.length === 1 ? '' : 's'} into resume`
    )
  }

  const canGenerate =
    jobDescription.trim().length > 0 &&
    isResumeInputReady(resumeText, resumeFile, fileParse) &&
    fileParse.status !== 'parsing'

  async function handleGenerate(options: GenerateOptions = {}) {
    if (!canGenerate && !options.resumeOverride) return

    setIsLoading(true)
    setLoadingStep(0)
    setLoadingLabel(null)
    setScorePassLines([])
    setStreamingResume(null)
    setStreamingCoverLetter('')

    const capturedResumeText =
      options.resumeOverride ??
      getResumeTextForSubmit(resumeText, resumeFile, fileParse).resumeText ??
      activeResumeText
    if (capturedResumeText.trim()) {
      setOriginalResumeText(capturedResumeText.trim())
    }

    if (!options.selectedKeywords?.length && !options.customSnippets?.length) {
      setResult(null)
      resetEditedResume(null)
    }

    try {
      const formData = new FormData()
      formData.append('jobDescription', jobDescription.trim())

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

      if (options.selectedKeywords?.length) {
        formData.append('selectedKeywords', JSON.stringify(options.selectedKeywords))
      }
      if (options.customSnippets?.length) {
        formData.append('customSnippets', JSON.stringify(options.customSnippets))
      }

      const response = await fetch('/api/generate', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error(await parseApiErrorResponse(response, 'Generation failed'))
      }

      const data = await consumeGenerationStream<GenerationResultWithMeta>(response, {
        onProgress: (step, label) => {
          setLoadingStep(step)
          setLoadingLabel(label)
        },
        onScorePass: (event) => {
          setScorePassLines((current) => [...current, formatScorePassLine(event)])
        },
        onPartial: (preview) => {
          const resumeSnapshot = coalesceStreamingResume(preview)
          if (resumeSnapshot) {
            setStreamingResume(resumeSnapshot)
          }
          if (preview.coverLetter?.trim()) {
            setStreamingCoverLetter(preview.coverLetter)
          }
        },
      })

      setResult(data)
      resetEditedResume(data.tailoredResume)
      setCoverLetter(data.coverLetter)

      if (options.customSnippets?.length || options.selectedKeywords?.length) {
        const count = options.customSnippets?.length ?? options.selectedKeywords?.length ?? 0
        toast.success(
          `Re-tailored with ${count} addition${count === 1 ? '' : 's'} incorporated`
        )
      } else {
        const injected = data.incorporatedKeywords?.length ?? 0
        toast.success(
          injected > 0
            ? `Your tailored resume is ready — ${injected} keyword${injected === 1 ? '' : 's'} woven in automatically`
            : 'Your tailored resume is ready'
        )
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Generation failed')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleIncorporateKeywords(selections: SkillSnippetSelection[]) {
    const resumeOverride =
      editedResume != null ? serializeTailoredResume(editedResume) : activeResumeText || undefined

    if (!resumeOverride) {
      toast.error('Add a resume before re-tailoring.')
      return
    }

    await handleGenerate({
      selectedKeywords: selections.map((item) => item.keyword),
      customSnippets: selections.map((item) => item.snippet),
      resumeOverride,
    })
  }

  async function handleCheckoutSuccess(result: {
    accessToken: string
    jobDescriptionHash: string
    expiresAt: number
    unlockedAt: number
  }) {
    unlock(result)
    toast.success('24-Hour Job Pass active — unlimited edits and downloads for this role.')
  }

  const premiumLocked = Boolean(result && checkoutEnabled && !isUnlocked)

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <SiteHeader current="tailor" />

      <PageHero
        eyebrow="Professional resume services"
        title="Tailor your resume to beat the ATS"
        description="Paste a job description and your resume. Receive a keyword-optimized resume, cover letter, and before/after ATS compliance score — the same deliverables a professional resume service provides."
      />

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-4 py-10 sm:px-6">
        <CompetitiveAdvantagesSection />

        <TrustBanner message="Your resume is saved only in this browser for convenience. It is sent to AI providers during generation and is not stored on our servers." />

        <div id="tailor-workspace" className="grid scroll-mt-24 gap-6 lg:grid-cols-2">
          <StepCard
            step={1}
            title="Job description"
            description="Paste the role you are applying for"
          >
            <JobDescriptionStep value={jobDescription} onChange={setJobDescription} />
          </StepCard>

          <StepCard
            step={2}
            title="Your resume"
            description="Paste text or upload a PDF, DOCX, or TXT file"
          >
            <ResumeInputStep
              resumeText={resumeText}
              onResumeTextChange={setResumeText}
              resumeFile={resumeFile}
              onResumeFileChange={setResumeFile}
              onFileParseChange={handleFileParseChange}
            />
          </StepCard>
        </div>

        <StepCard
          step={3}
          id="generate-step"
          title="Generate tailored materials"
          description="Create an ATS-formatted resume, keyword report, and cover letter"
        >
          {(preScanPreview || preScanLoading) && canGenerate ? (
            <div className="mb-4">
              <TargetSkillsPanel
                preScan={preScanPreview}
                isLoading={preScanLoading}
                onInsertSelections={handleInsertSkillSelections}
                jobDescription={jobDescription}
                resumeText={activeResumeText}
              />
            </div>
          ) : null}
            <GenerateStep
              onGenerate={() => handleGenerate()}
              isLoading={isLoading}
              loadingStep={loadingStep}
              loadingLabel={loadingLabel}
              scorePassLines={scorePassLines}
              streamingResume={streamingResume}
              streamingCoverLetter={streamingCoverLetter}
              disabled={!canGenerate}
            />
        </StepCard>

        {result ? (
          <Card className="border-brand-gold/30 shadow-md">
            <CardHeader>
              <CardTitle className="font-heading text-2xl">Your tailored application</CardTitle>
              <CardDescription>
                Review, edit, and download your professional resume package
                {isUnlocked && passExpiryLabel ? (
                  <span className="mt-1 block text-xs text-brand-gold">
                    24-Hour Job Pass active for this role until {passExpiryLabel}
                  </span>
                ) : null}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {premiumLocked ? (
                <PremiumUnlockBanner onUnlockRequest={() => setCheckoutOpen(true)} />
              ) : null}

              {result.preScan ? (
                <TargetSkillsPanel
                  preScan={result.preScan}
                  jobDescription={jobDescription}
                  resumeText={
                    originalResumeText ??
                    (editedResume ? serializeTailoredResume(editedResume) : activeResumeText)
                  }
                />
              ) : null}

              <AtsComplianceComparison
                before={result.baselineKeywordReport}
                after={result.keywordReport}
                refinementPasses={result.refinementPasses}
                targetScoreMet={result.targetScoreMet}
              />

              <DownloadActions
                resume={editedResume ?? result.tailoredResume}
                coverLetter={coverLetter}
                premiumAccessToken={accessToken}
                jobDescriptionHash={jobDescriptionHash}
                isPremiumUnlocked={isUnlocked}
                passExpiryLabel={passExpiryLabel}
                onCheckoutRequest={() => setCheckoutOpen(true)}
              />

              <Tabs defaultValue="changes">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <TabsList>
                    <TabsTrigger value="resume">Resume</TabsTrigger>
                    <TabsTrigger value="changes">Changes</TabsTrigger>
                    <TabsTrigger value="keywords">Keyword report</TabsTrigger>
                    <TabsTrigger value="cover">Cover letter</TabsTrigger>
                  </TabsList>
                  <UndoRedoToolbar
                    canUndo={canUndoResumeEdit}
                    canRedo={canRedoResumeEdit}
                    onUndo={undoResumeEdit}
                    onRedo={redoResumeEdit}
                    enabled={Boolean(editedResume)}
                  />
                </div>

                <TabsContent value="resume" className="mt-4">
                  {editedResume ? (
                    <EditableResumePreview
                      resume={editedResume}
                      onResumeChange={pushEditedResume}
                      originalText={originalResumeText}
                      jobDescription={jobDescription}
                    />
                  ) : null}
                </TabsContent>

                <TabsContent value="changes" className="mt-4">
                  {originalResumeText && editedResume ? (
                    <ResumeDiffView
                      originalText={originalResumeText}
                      resume={editedResume}
                      onResumeChange={pushEditedResume}
                      jobDescription={jobDescription}
                    />
                  ) : null}
                </TabsContent>

                <TabsContent value="keywords" className="mt-4">
                  <KeywordReportPanel
                    report={result.keywordReport}
                    onIncorporateKeywords={handleIncorporateKeywords}
                    isRerunning={isLoading}
                    jobDescription={jobDescription}
                    resumeText={
                      editedResume
                        ? serializeTailoredResume(editedResume)
                        : originalResumeText ?? activeResumeText
                    }
                  />
                </TabsContent>

                <TabsContent value="cover" className="mt-4">
                  <CoverLetterPreview
                    fieldId="home-cover-letter"
                    value={coverLetter}
                    onChange={setCoverLetter}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        ) : null}
      </main>

      <SquareCheckoutModal
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        jobDescription={jobDescription}
        onSuccess={handleCheckoutSuccess}
      />

      <SiteFooter />
    </div>
  )
}
