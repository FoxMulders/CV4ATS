'use client'

import { Sparkles } from 'lucide-react'

import { EditableFieldShell } from '@/components/form/editable-field-shell'
import { EditableTagList } from '@/components/form/editable-tag-list'
import { EditedFieldBadge } from '@/components/form/edited-field-badge'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  EditableSkillSnippetPicker,
  type SkillSnippetSelection,
} from '@/components/results/editable-skill-snippet-picker'
import type { PreScanResult } from '@/lib/resume/pre-scan-preparation'
import type { TargetSkill } from '@/lib/resume/skill-extrapolation'
import { isFieldEdited } from '@/lib/form/field-diff'

const CATEGORY_LABELS = {
  methodology: 'Methodology',
  competency: 'Competency',
  domainTech: 'Domain',
  tool: 'Tool',
} as const

interface TargetSkillsPanelProps {
  preScan: PreScanResult | null
  baselinePreScan?: PreScanResult | null
  onPreScanChange?: (preScan: PreScanResult) => void
  isLoading?: boolean
  onInsertSelections?: (selections: SkillSnippetSelection[]) => void
  jobDescription?: string
  resumeText?: string
}

function SkillBadge({
  skill,
  edited = false,
}: {
  skill: TargetSkill
  edited?: boolean
}) {
  return (
    <Badge variant="secondary" className="gap-1">
      <span className="text-[10px] uppercase tracking-wide opacity-70">
        {CATEGORY_LABELS[skill.category]}
      </span>
      {skill.term}
      {edited ? <EditedFieldBadge className="ml-1" /> : null}
    </Badge>
  )
}

export function TargetSkillsPanel({
  preScan,
  baselinePreScan,
  onPreScanChange,
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

  const baseline = baselinePreScan ?? preScan
  const editable = Boolean(onPreScanChange)
  const targetSkillTerms = preScan.targetSkills.map((skill) => skill.term)
  const baselineTargetSkillTerms = baseline.targetSkills.map((skill) => skill.term)

  const snippetItems = preScan.suggestedAdditions.map((addition) => ({
    keyword: addition.skill,
    snippet: addition.snippet,
    category: CATEGORY_LABELS[addition.category],
    placement: addition.placement,
    placementLabel: addition.placementLabel,
    placementBreadcrumb: addition.placementBreadcrumb,
    originalBullet: addition.originalBullet,
    bulletLineIndex: addition.bulletLineIndex,
    positionId: addition.positionId,
    bulletIndex: addition.bulletIndex,
    siblingBullets: addition.siblingBullets,
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
          Extracted from the job description before ATS scanning. Edit parsed skills and metrics in
          place — modified fields show an Edited badge.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {preScan.targetSkills.length ? (
          editable ? (
            <EditableTagList
              label={`Target skills (${preScan.targetSkills.length})`}
              values={targetSkillTerms}
              baselineValues={baselineTargetSkillTerms}
              onChange={(terms) =>
                onPreScanChange?.({
                  ...preScan,
                  targetSkills: terms.map((term, index) => ({
                    term,
                    category: preScan.targetSkills[index]?.category ?? 'domainTech',
                  })),
                })
              }
              placeholder="Add target skill…"
            />
          ) : (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Target skills ({preScan.targetSkills.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {preScan.targetSkills.map((skill, index) => (
                  <SkillBadge
                    key={`${skill.term}-${index}`}
                    skill={skill}
                    edited={isFieldEdited(skill.term, baseline.targetSkills[index]?.term)}
                  />
                ))}
              </div>
            </div>
          )
        ) : null}

        {preScan.autoInjectedSkills.length ? (
          editable ? (
            <EditableTagList
              label={`Auto-injected before scoring${preScan.modifiedBulletCount ? ` · ${preScan.modifiedBulletCount} bullet${preScan.modifiedBulletCount === 1 ? '' : 's'} updated` : ''}`}
              values={preScan.autoInjectedSkills}
              baselineValues={baseline.autoInjectedSkills}
              onChange={(autoInjectedSkills) =>
                onPreScanChange?.({ ...preScan, autoInjectedSkills })
              }
              placeholder="Add auto-injected skill…"
              variant="default"
            />
          ) : (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Auto-injected before scoring
                {preScan.modifiedBulletCount
                  ? ` · ${preScan.modifiedBulletCount} bullet${preScan.modifiedBulletCount === 1 ? '' : 's'} updated`
                  : ''}
              </p>
              <div className="flex flex-wrap gap-2">
                {preScan.autoInjectedSkills.map((skill, index) => (
                  <Badge
                    key={skill}
                    variant="default"
                    className={
                      isFieldEdited(skill, baseline.autoInjectedSkills[index])
                        ? 'ring-1 ring-amber-400/70'
                        : undefined
                    }
                  >
                    {skill}
                    {isFieldEdited(skill, baseline.autoInjectedSkills[index]) ? (
                      <EditedFieldBadge className="ml-1" />
                    ) : null}
                  </Badge>
                ))}
              </div>
            </div>
          )
        ) : null}

        {editable ? (
          <EditableFieldShell
            label="Modified bullet count"
            edited={isFieldEdited(preScan.modifiedBulletCount, baseline.modifiedBulletCount)}
          >
            <Input
              type="number"
              min={0}
              value={preScan.modifiedBulletCount}
              onChange={(event) =>
                onPreScanChange?.({
                  ...preScan,
                  modifiedBulletCount: Math.max(0, Number(event.target.value) || 0),
                })
              }
            />
          </EditableFieldShell>
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
