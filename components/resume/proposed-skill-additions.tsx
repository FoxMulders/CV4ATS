'use client'

import { Lightbulb, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { TailoredResume } from '@/lib/ai/schemas'
import {
  appendSkillsToResumeText,
  extrapolateProposedSkillsFromResume,
  formatProposedSkillsField,
  parseProposedSkillsField,
} from '@/lib/resume/resume-skill-proposals'

interface ProposedSkillAdditionsProps {
  resumeText: string
  onResumeTextChange?: (value: string) => void
  tailoredResume?: TailoredResume | null
  onTailoredResumeChange?: (resume: TailoredResume) => void
}

function titleCaseSkill(term: string): string {
  return term
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function ProposedSkillAdditions({
  resumeText,
  onResumeTextChange,
  tailoredResume,
  onTailoredResumeChange,
}: ProposedSkillAdditionsProps) {
  const extrapolated = useMemo(() => {
    const proposed = extrapolateProposedSkillsFromResume(resumeText)
    if (!tailoredResume) return proposed

    const existing = new Set(tailoredResume.skills.map((skill) => skill.toLowerCase()))
    return proposed.filter((skill) => !existing.has(skill.term.toLowerCase()))
  }, [resumeText, tailoredResume])

  const [fieldValue, setFieldValue] = useState('')
  const [customSkill, setCustomSkill] = useState('')

  useEffect(() => {
    setFieldValue(formatProposedSkillsField(extrapolated.map((skill) => skill.term)))
  }, [extrapolated])

  const selectedTerms = useMemo(() => {
    return parseProposedSkillsField(fieldValue).map((term) => term.toLowerCase())
  }, [fieldValue])

  function isTermSelected(term: string): boolean {
    return selectedTerms.includes(term.toLowerCase())
  }

  function toggleTerm(term: string) {
    const current = parseProposedSkillsField(fieldValue)
    const lower = term.toLowerCase()
    const next = current.some((entry) => entry.toLowerCase() === lower)
      ? current.filter((entry) => entry.toLowerCase() !== lower)
      : [...current, term]
    setFieldValue(formatProposedSkillsField(next))
  }

  function appendCustomSkill() {
    const trimmed = customSkill.trim()
    if (!trimmed) return

    const current = parseProposedSkillsField(fieldValue)
    if (current.some((entry) => entry.toLowerCase() === trimmed.toLowerCase())) {
      setCustomSkill('')
      return
    }

    setFieldValue(formatProposedSkillsField([...current, trimmed]))
    setCustomSkill('')
  }

  function handleAddSkills() {
    const skillsToAdd = parseProposedSkillsField(fieldValue)
    if (skillsToAdd.length === 0) {
      toast.error('Select or enter at least one proposed skill.')
      return
    }

    if (tailoredResume && onTailoredResumeChange) {
      const existing = new Set(tailoredResume.skills.map((skill) => skill.toLowerCase()))
      const additions = skillsToAdd.filter((skill) => !existing.has(skill.toLowerCase()))
      if (additions.length === 0) {
        toast.message('Those skills are already on your resume.')
        return
      }

      onTailoredResumeChange({
        ...tailoredResume,
        skills: [...tailoredResume.skills, ...additions.map(titleCaseSkill)],
      })
      toast.success(`Added ${additions.length} skill${additions.length === 1 ? '' : 's'} to resume`)
      return
    }

    if (!onResumeTextChange) return

    onResumeTextChange(appendSkillsToResumeText(resumeText, skillsToAdd))
    toast.success(`Added ${skillsToAdd.length} skill${skillsToAdd.length === 1 ? '' : 's'} to resume`)
  }

  if (!resumeText.trim()) return null

  return (
    <Card className="border-sky-200/80 bg-sky-50/40">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="size-4 text-sky-700" />
          Proposed skill additions
        </CardTitle>
        <CardDescription>
          Skills inferred from your experience and summary but not yet listed explicitly. Edit the
          field below or click chips to toggle, then add them to your resume.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {extrapolated.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {extrapolated.map((skill) => {
              const selected = isTermSelected(skill.term)
              return (
                <button
                  key={skill.term}
                  type="button"
                  onClick={() => toggleTerm(skill.term)}
                  className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  <Badge
                    variant={selected ? 'default' : 'outline'}
                    className={selected ? 'bg-sky-700 hover:bg-sky-800' : 'bg-background'}
                  >
                    {skill.term}
                  </Badge>
                </button>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No additional skills detected — add your own in the field below.
          </p>
        )}

        <div className="space-y-2">
          <Label htmlFor="proposed-skill-additions">Proposed skill additions</Label>
          <Textarea
            id="proposed-skill-additions"
            value={fieldValue}
            onChange={(event) => setFieldValue(event.target.value)}
            placeholder="Agile, Jira, scope management, workflow automation"
            rows={3}
            className="font-mono text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <Input
              value={customSkill}
              onChange={(event) => setCustomSkill(event.target.value)}
              placeholder="Add one skill"
              className="max-w-xs"
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                event.preventDefault()
                appendCustomSkill()
              }}
            />
            <Button type="button" variant="outline" size="sm" onClick={appendCustomSkill}>
              Add skill
            </Button>
          </div>
        </div>

        <Button type="button" onClick={handleAddSkills}>
          <Plus />
          Add proposed skills to resume
        </Button>
      </CardContent>
    </Card>
  )
}
