'use client'

import { Lightbulb, Plus, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
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
  formatSkillsLikeExisting,
  parseListedSkillTerms,
  parseProposedSkillsField,
} from '@/lib/resume/resume-skill-proposals'
import {
  WORKSPACE_TAG_REGION_CLASS,
} from '@/lib/wizard/workspace-panel-styles'
import { cn } from '@/lib/utils'

interface ProposedSkillAdditionsProps {
  resumeText: string
  onResumeTextChange?: (value: string) => void
  tailoredResume?: TailoredResume | null
  onTailoredResumeChange?: (resume: TailoredResume) => void
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
  const userTouchedRef = useRef(false)
  const seededTermsKeyRef = useRef('')

  const extrapolatedTermsKey = useMemo(
    () =>
      extrapolated
        .map((skill) => skill.term.toLowerCase())
        .sort()
        .join('|'),
    [extrapolated]
  )

  useEffect(() => {
    if (extrapolated.length === 0) {
      seededTermsKeyRef.current = ''
      userTouchedRef.current = false
      setFieldValue('')
      return
    }

    if (extrapolatedTermsKey === seededTermsKeyRef.current) return

    const previousKey = seededTermsKeyRef.current
    seededTermsKeyRef.current = extrapolatedTermsKey

    if (!previousKey) {
      setFieldValue(formatProposedSkillsField(extrapolated.map((skill) => skill.term)))
      return
    }

    const previousTerms = new Set(previousKey.split('|').filter(Boolean))
    const nextTerms = extrapolatedTermsKey.split('|').filter(Boolean)
    const overlap =
      nextTerms.length === 0
        ? 0
        : nextTerms.filter((term) => previousTerms.has(term)).length / nextTerms.length

    if (overlap < 0.5) {
      userTouchedRef.current = false
      setFieldValue(formatProposedSkillsField(extrapolated.map((skill) => skill.term)))
      return
    }

    if (!userTouchedRef.current) {
      setFieldValue(formatProposedSkillsField(extrapolated.map((skill) => skill.term)))
    }
  }, [extrapolated, extrapolatedTermsKey])

  const selectedTerms = useMemo(() => {
    return parseProposedSkillsField(fieldValue).map((term) => term.toLowerCase())
  }, [fieldValue])

  function isTermSelected(term: string): boolean {
    return selectedTerms.includes(term.toLowerCase())
  }

  function updateFieldValue(value: string) {
    userTouchedRef.current = true
    setFieldValue(value)
  }

  function toggleTerm(term: string) {
    const current = parseProposedSkillsField(fieldValue)
    const lower = term.toLowerCase()
    const next = current.some((entry) => entry.toLowerCase() === lower)
      ? current.filter((entry) => entry.toLowerCase() !== lower)
      : [...current, term]
    updateFieldValue(formatProposedSkillsField(next))
  }

  function removeTerm(term: string) {
    const current = parseProposedSkillsField(fieldValue)
    const lower = term.toLowerCase()
    if (!current.some((entry) => entry.toLowerCase() === lower)) return
    updateFieldValue(
      formatProposedSkillsField(current.filter((entry) => entry.toLowerCase() !== lower))
    )
  }

  function appendCustomSkill() {
    const trimmed = customSkill.trim()
    if (!trimmed) return

    const current = parseProposedSkillsField(fieldValue)
    if (current.some((entry) => entry.toLowerCase() === trimmed.toLowerCase())) {
      setCustomSkill('')
      return
    }

    updateFieldValue(formatProposedSkillsField([...current, trimmed]))
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
        skills: [
          ...tailoredResume.skills,
          ...formatSkillsLikeExisting(additions, tailoredResume.skills),
        ],
      })
      toast.success(`Added ${additions.length} skill${additions.length === 1 ? '' : 's'} to resume`)
      return
    }

    if (!onResumeTextChange) return

    onResumeTextChange(
      appendSkillsToResumeText(resumeText, skillsToAdd, parseListedSkillTerms(resumeText))
    )
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
          Skills inferred from your experience and summary but not yet listed explicitly. Click
          highlighted chips or use the × to remove them from the list before adding to your resume.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {extrapolated.length > 0 ? (
          <div className={cn(WORKSPACE_TAG_REGION_CLASS, 'rounded-lg border border-border/80')}>
            {extrapolated.map((skill) => {
              const selected = isTermSelected(skill.term)
              return (
                <div
                  key={skill.term}
                  className={
                    selected
                      ? 'inline-flex items-center overflow-hidden rounded-full focus-within:ring-2 focus-within:ring-sky-500'
                      : 'rounded-full focus-within:ring-2 focus-within:ring-sky-500'
                  }
                >
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleTerm(skill.term)}
                    className="rounded-full focus-visible:outline-none"
                  >
                    <Badge
                      variant={selected ? 'default' : 'outline'}
                      className={
                        selected
                          ? 'rounded-r-none bg-sky-700 hover:bg-sky-800'
                          : 'bg-background'
                      }
                    >
                      {skill.term}
                    </Badge>
                  </button>
                  {selected ? (
                    <button
                      type="button"
                      aria-label={`Remove ${skill.term}`}
                      onClick={() => removeTerm(skill.term)}
                      className="inline-flex h-full items-center rounded-r-full bg-sky-700 px-1.5 text-sky-50 hover:bg-sky-900"
                    >
                      <X className="size-3" />
                    </button>
                  ) : null}
                </div>
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
            onChange={(event) => updateFieldValue(event.target.value)}
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
