'use client'

import { Upload } from 'lucide-react'
import { useRef, useState } from 'react'

import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { MAX_RESUME_TEXT_LENGTH } from '@/lib/ai/schemas'
import { isSupportedResumeFile } from '@/lib/resume/parse-file'
import { cn } from '@/lib/utils'

interface ResumeInputStepProps {
  resumeText: string
  onResumeTextChange: (value: string) => void
  resumeFile: File | null
  onResumeFileChange: (file: File | null) => void
}

export function ResumeInputStep({
  resumeText,
  onResumeTextChange,
  resumeFile,
  onResumeFileChange,
}: ResumeInputStepProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)

  function handleFile(file: File | null) {
    setFileError(null)
    if (!file) {
      onResumeFileChange(null)
      return
    }

    if (!isSupportedResumeFile(file.name)) {
      setFileError('Unsupported file type. Upload a PDF, DOCX, or TXT file.')
      return
    }

    onResumeFileChange(file)
    onResumeTextChange('')
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragOver(false)
    handleFile(event.dataTransfer.files[0] ?? null)
  }

  return (
    <div className="space-y-2">
      <Label>Your resume</Label>
      <Tabs defaultValue="paste">
        <TabsList>
          <TabsTrigger value="paste">Paste</TabsTrigger>
          <TabsTrigger value="upload">Upload</TabsTrigger>
        </TabsList>

        <TabsContent value="paste" className="space-y-2">
          <Textarea
            placeholder="Paste your resume text here..."
            value={resumeText}
            onChange={(event) => {
              onResumeTextChange(event.target.value)
              if (event.target.value.trim()) {
                onResumeFileChange(null)
              }
            }}
            rows={14}
            className="min-h-[220px] resize-y font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            {resumeText.length.toLocaleString()} / {MAX_RESUME_TEXT_LENGTH.toLocaleString()}{' '}
            characters
          </p>
        </TabsContent>

        <TabsContent value="upload" className="space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            className="sr-only"
            onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
          />
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
              'flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 transition-colors',
              dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
            )}
          >
            <Upload className="size-8 text-muted-foreground" />
            <div className="text-center">
              <p className="font-medium">Drop your resume here or click to browse</p>
              <p className="text-sm text-muted-foreground">PDF, DOCX, or TXT up to 5 MB</p>
            </div>
          </div>
          {resumeFile ? (
            <p className="text-sm text-muted-foreground">Selected: {resumeFile.name}</p>
          ) : null}
          {fileError ? <p className="text-sm text-destructive">{fileError}</p> : null}
        </TabsContent>
      </Tabs>
    </div>
  )
}
