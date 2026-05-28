'use client'

import { Sparkles } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  EditableSkillSnippetPicker,
  type SkillSnippetSelection,
} from '@/components/results/editable-skill-snippet-picker'
import type { PreScanResult } from '@/lib/resume/pre-scan-preparation'
import type { TargetSkill } from '@/lib/resume/skill-extrapolation'

const CATEGORY_LABELS = {
  methodology: 'Methodology',
  competency: 'Competency',
  domainTech: 'Domain',
  tool: 'Tool',
} as const

interface TargetSkillsPanelProps {
  preScan: PreScanResult | null
  isLoading?: boolean
  onInsertSelections?: (selections: SkillSnippetSelection[]) => void
  jobDescription?: string
  resumeText?: string
}

function SkillBadge({ skill }: { skill: TargetSkill }) {
  return (
    <Badge variant="secondary" className="gap-1">
      <span className="text-[10px] uppercase tracking-wide opacity-70">
        {CATEGORY_LABELS[skill.category]}
      </span>
      {skill.term}
    </Badge>
  )
}

export function TargetSkillsPanel({
  preScan,
  isLoading,
  onInsertSelections,
  jobDescription,
  resumeText,
}: TargetSkillsPanelProps) {
  if (isLoading) {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4" />
            Analyzing target skills…
          </CardTitle>
        </CardHeader>
      </Card>
    )
  }

  if (!preScan) return null

  const snippetItems = preScan.suggestedAdditions.map((addition) => ({
    keyword: addition.skill,
    snippet: addition.snippet,
    category: CATEGORY_LABELS[addition.category],
    placement: addition.placement,
    placementLabel: addition.placementLabel,
    originalBullet: addition.originalBullet,
    bulletLineIndex: addition.bulletLineIndex,
    modificationType: addition.modificationType,
    targetRoleTitle: addition.targetRoleTitle,
    targetCompany: addition.targetCompany,
    domainLabel: addition.domainLabel,
  }))

  return (
    <Card className="border-brand-gold/30 bg-brand-gold/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4" />
          High-value industry skills & methodologies
        </CardTitle>
        <CardDescription>
          Extracted from the job description before ATS scanning. Click missing skills to preview the
          exact role and bullet being revised before inserting or re-tailoring.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {preScan.targetSkills.length ? (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Target skills ({preScan.targetSkills.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {preScan.targetSkills.map((skill) => (
                <SkillBadge key={skill.term} skill={skill} />
              ))}
            </div>
          </div>
        ) : null}

        {preScan.autoInjectedSkills.length ? (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Auto-injected before scoring
              {preScan.modifiedBulletCount
                ? ` · ${preScan.modifiedBulletCount} bullet${preScan.modifiedBulletCount === 1 ? '' : 's'} updated`
                : ''}
            </p>
            <div className="flex flex-wrap gap-2">
              {preScan.autoInjectedSkills.map((skill) => (
                <Badge key={skill} variant="default">
                  {skill}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}

        {snippetItems.length ? (
          <EditableSkillSnippetPicker
            items={snippetItems}
            onInsert={onInsertSelections}
            isLoading={isLoading}
            description="Click a missing skill to see where it will be woven into your existing resume. Edit the revised line, then insert into your resume."
            insertLabel="Apply selected revisions to resume"
            jobDescription={jobDescription}
            resumeText={resumeText}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Your resume already reflects the key skills detected in this job description.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
