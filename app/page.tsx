'use client'

import { Shield } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { AppNav } from '@/components/nav/app-nav'

import { CoverLetterPreview } from '@/components/results/cover-letter-preview'
import { DownloadActions } from '@/components/results/download-actions'
import { KeywordReportPanel } from '@/components/results/keyword-report'
import { ResumePreview } from '@/components/results/resume-preview'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GenerateStep, LOADING_STEPS } from '@/components/wizard/generate-step'
import { JobDescriptionStep } from '@/components/wizard/job-description-step'
import { ResumeInputStep } from '@/components/wizard/resume-input-step'
import type { GenerationResult } from '@/lib/ai/schemas'

export default function HomePage() {
  const [jobDescription, setJobDescription] = useState('')
  const [resumeText, setResumeText] = useState('')
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const [result, setResult] = useState<GenerationResult | null>(null)
  const [coverLetter, setCoverLetter] = useState('')

  const canGenerate =
    jobDescription.trim().length > 0 && (resumeText.trim().length > 0 || resumeFile !== null)

  useEffect(() => {
    if (!isLoading) return

    const interval = window.setInterval(() => {
      setLoadingStep((current) => Math.min(current + 1, LOADING_STEPS.length - 1))
    }, 3500)

    return () => window.clearInterval(interval)
  }, [isLoading])

  async function handleGenerate() {
    if (!canGenerate) return

    setIsLoading(true)
    setLoadingStep(0)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('jobDescription', jobDescription.trim())

      if (resumeFile) {
        formData.append('file', resumeFile)
      } else {
        formData.append('resumeText', resumeText.trim())
      }

      const response = await fetch('/api/generate', {
        method: 'POST',
        body: formData,
      })

      const data = (await response.json()) as GenerationResult | { error?: string }

      if (!response.ok) {
        throw new Error('error' in data ? data.error : 'Generation failed')
      }

      setResult(data as GenerationResult)
      setCoverLetter((data as GenerationResult).coverLetter)
      toast.success('Your tailored resume is ready')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Generation failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">ATS Resume Builder</h1>
            <p className="text-sm text-muted-foreground">
              Tailor your resume to any job description in seconds
            </p>
          </div>
          <AppNav current="tailor" />
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
        <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
          <Shield className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>Your resume is processed in memory and never stored.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>1. Job description</CardTitle>
              <CardDescription>Paste the role you are applying for</CardDescription>
            </CardHeader>
            <CardContent>
              <JobDescriptionStep value={jobDescription} onChange={setJobDescription} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. Your resume</CardTitle>
              <CardDescription>Paste text or upload a file</CardDescription>
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
        </div>

        <Card>
          <CardHeader>
            <CardTitle>3. Generate</CardTitle>
            <CardDescription>
              Create an ATS-formatted resume, keyword report, and cover letter
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GenerateStep
              onGenerate={handleGenerate}
              isLoading={isLoading}
              loadingStep={loadingStep}
              disabled={!canGenerate}
            />
          </CardContent>
        </Card>

        {result ? (
          <Card>
            <CardHeader>
              <CardTitle>Results</CardTitle>
              <CardDescription>Review, edit, and download your tailored materials</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <DownloadActions resume={result.tailoredResume} coverLetter={coverLetter} />

              <Tabs defaultValue="resume">
                <TabsList>
                  <TabsTrigger value="resume">Resume</TabsTrigger>
                  <TabsTrigger value="keywords">Keyword report</TabsTrigger>
                  <TabsTrigger value="cover">Cover letter</TabsTrigger>
                </TabsList>

                <TabsContent value="resume" className="mt-4">
                  <ResumePreview resume={result.tailoredResume} />
                </TabsContent>

                <TabsContent value="keywords" className="mt-4">
                  <KeywordReportPanel report={result.keywordReport} />
                </TabsContent>

                <TabsContent value="cover" className="mt-4">
                  <CoverLetterPreview value={coverLetter} onChange={setCoverLetter} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        ) : null}
      </main>
    </div>
  )
}
