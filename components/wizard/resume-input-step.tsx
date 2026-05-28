'use client'

import { Loader2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { AddExperiencePanel } from '@/components/resume/add-experience-panel'
import { ProposedSkillAdditions } from '@/components/resume/proposed-skill-additions'
import { ResumeSourcePreview } from '@/components/resume/resume-source-preview'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { parseApiErrorResponse } from '@/lib/api/client-fetch'
import { MAX_RESUME_TEXT_LENGTH } from '@/lib/ai/schemas'
import type { Experience } from '@/lib/ai/schemas'
import { prependExperienceToResumeText } from '@/lib/resume/experience-utils'
import { getExtension, validateResumeFileBytes } from '@/lib/resume/file-signature'
import {
  RESUME_PASTE_TAB_ID,
  RESUME_TEXT_INPUT_ID,
} from '@/lib/wizard/workspace-focus-guide'
import { WorkspaceEditorViewport } from '@/components/wizard/workspace-editor-viewport'
import { handlePasteScrollToBottom } from '@/components/wizard/paste-scroll'
import {
  WORKSPACE_COUNTER_AT_LIMIT_CLASS,
  WORKSPACE_COUNTER_CLASS,
  WORKSPACE_STEP_CONTENT_CLASS,
  WORKSPACE_TEXTAREA_CLASS,
} from '@/lib/wizard/workspace-panel-styles'
import { cn } from '@/lib/utils'

export type ResumeFileParseStatus = 'idle' | 'parsing' | 'ready' | 'error'

export interface ResumeFileParseState {
  status: ResumeFileParseStatus
  parsedText: string
  error: string | null
}

interface ResumeInputStepProps {
  resumeText: string
  onResumeTextChange: (value: string) => void
  resumeFile: File | null
  onResumeFileChange: (file: File | null) => void
  onFileParseChange?: (state: ResumeFileParseState) => void
  pasteScrollTargetId?: string
}

export function ResumeInputStep({
  resumeText,
  onResumeTextChange,
  resumeFile,
  onResumeFileChange,
  onFileParseChange,
  pasteScrollTargetId = 'generate-step',
}: ResumeInputStepProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [uploadedPreviewText, setUploadedPreviewText] = useState('')

  useEffect(() => {
    if (!resumeFile) {
      setUploadedPreviewText('')
      onFileParseChange?.({ status: 'idle', parsedText: '', error: null })
      return
    }

    let cancelled = false

    async function parseUploadedFile() {
      setIsParsing(true)
      setFileError(null)
      onFileParseChange?.({ status: 'parsing', parsedText: '', error: null })

      try {
        const formData = new FormData()
        formData.append('file', resumeFile!)

        const response = await fetch('/api/parse-resume', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          throw new Error(await parseApiErrorResponse(response, 'Failed to parse resume file'))
        }

        const data = (await response.json()) as { text?: string }

        if (!cancelled) {
          const text = data.text ?? ''
          setUploadedPreviewText(text)
          onFileParseChange?.({ status: 'ready', parsedText: text, error: null })
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Failed to parse resume file'
          setFileError(message)
          setUploadedPreviewText('')
          onFileParseChange?.({ status: 'error', parsedText: '', error: message })
          toast.error(message)
        }
      } finally {
        if (!cancelled) {
          setIsParsing(false)
        }
      }
    }

    void parseUploadedFile()

    return () => {
      cancelled = true
    }
  }, [resumeFile, onFileParseChange])

  async function handleFile(file: File | null) {
    setFileError(null)
    if (!file) {
      onResumeFileChange(null)
      setUploadedPreviewText('')
      onFileParseChange?.({ status: 'idle', parsedText: '', error: null })
      return
    }

    if (!getExtension(file.name)) {
      const message = 'Unsupported file type. Upload a PDF, DOCX, or TXT file.'
      setFileError(message)
      onFileParseChange?.({ status: 'error', parsedText: '', error: message })
      return
    }

    try {
      const header = await file.slice(0, 8192).arrayBuffer()
      validateResumeFileBytes(new Uint8Array(header), file.name)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'File content does not match its extension.'
      setFileError(message)
      onFileParseChange?.({ status: 'error', parsedText: '', error: message })
      toast.error(message)
      return
    }

    onResumeFileChange(file)
    onResumeTextChange('')
  }

  async function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragOver(false)
    await handleFile(event.dataTransfer.files[0] ?? null)
  }

  const previewText = resumeFile ? uploadedPreviewText : resumeText.trim()
  const previewSource = resumeFile ? `From file: ${resumeFile.name}` : undefined

  function handleAddExperience(experience: Experience) {
    const baseText = resumeText.trim() || uploadedPreviewText.trim()
    const combined = prependExperienceToResumeText(baseText, experience)

    if (combined.length > MAX_RESUME_TEXT_LENGTH) {
      toast.error(
        `Adding this role would exceed the ${MAX_RESUME_TEXT_LENGTH.toLocaleString()} character limit.`
      )
      return
    }

    onResumeFileChange(null)
    onResumeTextChange(combined)
  }

  return (
    <div className={cn('space-y-2', WORKSPACE_STEP_CONTENT_CLASS)}>
      <Label>Your resume</Label>
      <Tabs defaultValue="paste" className="flex min-h-0 flex-1 flex-col">
        <TabsList>
          <TabsTrigger id={RESUME_PASTE_TAB_ID} value="paste">
            Paste
          </TabsTrigger>
          <TabsTrigger value="upload">Upload</TabsTrigger>
        </TabsList>

        <TabsContent value="paste" className="mt-3 flex min-h-0 flex-1 flex-col space-y-2">
          <WorkspaceEditorViewport
            aria-label="Resume text editor"
            className="min-h-0 flex-1"
          >
            <Textarea
              id={RESUME_TEXT_INPUT_ID}
              placeholder="Paste your resume text here..."
              value={resumeText}
              onChange={(event) => {
                onResumeTextChange(
                  event.target.value.slice(0, MAX_RESUME_TEXT_LENGTH)
                )
                if (event.target.value.trim()) {
                  onResumeFileChange(null)
                }
              }}
              onPaste={(event) => handlePasteScrollToBottom(event, pasteScrollTargetId)}
              className={cn(WORKSPACE_TEXTAREA_CLASS, 'font-mono')}
            />
          </WorkspaceEditorViewport>
          <p
            className={
              resumeText.length >= MAX_RESUME_TEXT_LENGTH
                ? WORKSPACE_COUNTER_AT_LIMIT_CLASS
                : WORKSPACE_COUNTER_CLASS
            }
          >
            {resumeText.length.toLocaleString()} / {MAX_RESUME_TEXT_LENGTH.toLocaleString()}{' '}
            characters
            {resumeText.length >= MAX_RESUME_TEXT_LENGTH ? ' · Character limit reached' : ''}
          </p>
        </TabsContent>

        <TabsContent value="upload" className="mt-3 flex min-h-0 flex-1 flex-col space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            className="sr-only"
            onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
          />
          <WorkspaceEditorViewport
            aria-label="Resume file upload"
            className="min-h-0 flex-1"
          >
            <div
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  inputRef.current?.click()
                }
              }}
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={cn(
                'flex h-full min-h-full cursor-pointer flex-col items-center justify-center gap-3 p-6 transition-colors',
                dragOver ? 'bg-primary/5' : 'hover:bg-muted/40'
              )}
            >
              <Upload className="size-8 text-muted-foreground" />
              <div className="text-center">
                <p className="font-medium">Drop your resume here or click to browse</p>
                <p className="text-sm text-muted-foreground">PDF, DOCX, or TXT up to 5 MB</p>
              </div>
            </div>
          </WorkspaceEditorViewport>
          {resumeFile ? (
            <p className={WORKSPACE_COUNTER_CLASS}>Selected: {resumeFile.name}</p>
          ) : null}
          {isParsing ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Extracting resume text…
            </div>
          ) : null}
          {fileError ? <p className="text-sm text-destructive">{fileError}</p> : null}
        </TabsContent>
      </Tabs>

      {previewText ? (
        <>
          <ProposedSkillAdditions
            resumeText={previewText}
            onResumeTextChange={(value) => {
              onResumeFileChange(null)
              onResumeTextChange(value)
            }}
          />
          <ResumeSourcePreview text={previewText} sourceLabel={previewSource} />
        </>
      ) : null}

      <AddExperiencePanel variant="inline" onAdd={handleAddExperience} />
    </div>
  )
}

export function isResumeInputReady(
  resumeText: string,
  resumeFile: File | null,
  fileParse: ResumeFileParseState
): boolean {
  if (resumeText.trim().length > 0) return true
  if (!resumeFile) return false
  return fileParse.status === 'ready' && fileParse.parsedText.trim().length > 0
}

export function getResumeTextForSubmit(
  resumeText: string,
  resumeFile: File | null,
  fileParse: ResumeFileParseState
): { resumeText?: string; file?: File } {
  if (resumeText.trim().length > 0) {
    return { resumeText: resumeText.trim() }
  }

  if (resumeFile && fileParse.status === 'ready' && fileParse.parsedText.trim()) {
    return { resumeText: fileParse.parsedText.trim() }
  }

  if (resumeFile) {
    return { file: resumeFile }
  }

  return {}
}
