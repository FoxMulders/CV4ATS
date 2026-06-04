'use client'

import { Loader2, Plus, RotateCw, ShieldCheck, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { requestTailorSnippet } from '@/lib/api/tailor-snippet-client'
import { auditExactPhrasingMatch } from '@/lib/resume/exact-phrasing-auditor'
import { buildSnippetsForKeywords } from '@/lib/resume/skill-snippets'
import { cn } from '@/lib/utils'

import {
  PhrasingSimilarityBadge,
  PhrasingSimilarityPreview,
  usePhrasingSimilarityAudit,
} from '@/components/results/phrasing-similarity-preview'
import { VerifySkillModal } from '@/components/skills/verify-skill-modal'

import type { AnchoredSkillSelection } from '@/lib/resume/apply-skill-modifications'
import { applyAnchoredSkillModifications, selectionsToAnchoredModifications } from '@/lib/resume/apply-skill-modifications'

export type SkillSnippetSelection = AnchoredSkillSelection

export interface EditableSkillSnippetItem {
  keyword: string
  snippet: string
  category?: string
  placement?: string
  placementLabel?: string
  placementBreadcrumb?: string
  originalBullet?: string
  bulletLineIndex?: number
  positionId?: string
  bulletIndex?: number
  modificationType?: 'inline-bullet' | 'skills-section' | 'summary'
  targetRoleTitle?: string
  targetCompany?: string
  domainLabel?: string
  siblingBullets?: string[]
  purgeReason?: string
}

interface EditableSkillSnippetPickerProps {
  items: EditableSkillSnippetItem[]
  onIncorporate?: (selections: SkillSnippetSelection[]) => void | Promise<void>
  onInsert?: (selections: SkillSnippetSelection[]) => void
  isLoading?: boolean
  description?: string
  actionLabel?: string
  insertLabel?: string
  jobDescription?: string
  resumeText?: string
}

export function EditableSkillSnippetPicker({
  items,
  onIncorporate,
  onInsert,
  isLoading = false,
  description = 'Click a skill to preview where it will be woven into your existing resume. Edit the revised line, then incorporate or insert.',
  actionLabel = 'Incorporate selected & re-tailor',
  insertLabel = 'Insert selected into resume',
  jobDescription = '',
  resumeText = '',
}: EditableSkillSnippetPickerProps) {
  const itemMap = useMemo(
    () => new Map(items.map((item) => [item.keyword, item])),
    [items]
  )

  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([])
  const [editedSnippets, setEditedSnippets] = useState<Record<string, string>>({})
  const [tailoringKeyword, setTailoringKeyword] = useState<string | null>(null)
  const [variationCounts, setVariationCounts] = useState<Record<string, number>>({})
  const [snippetHistory, setSnippetHistory] = useState<Record<string, string[]>>({})

  const canTailorWithAi = Boolean(jobDescription.trim() && resumeText.trim())

  const itemsKey = useMemo(() => items.map((item) => item.keyword).join('|'), [items])
  const [syncedItemsKey, setSyncedItemsKey] = useState(itemsKey)
  if (itemsKey !== syncedItemsKey) {
    setSyncedItemsKey(itemsKey)
    const validKeywords = new Set(items.map((item) => item.keyword))
    setSelectedKeywords((current) => current.filter((keyword) => validKeywords.has(keyword)))
    setEditedSnippets((current) =>
      Object.fromEntries(Object.entries(current).filter(([keyword]) => validKeywords.has(keyword)))
    )
    setVariationCounts((current) =>
      Object.fromEntries(Object.entries(current).filter(([keyword]) => validKeywords.has(keyword)))
    )
    setSnippetHistory((current) =>
      Object.fromEntries(Object.entries(current).filter(([keyword]) => validKeywords.has(keyword)))
    )
  }

  function removeKeyword(keyword: string) {
    setSelectedKeywords((current) => current.filter((entry) => entry !== keyword))
    setEditedSnippets((current) => {
      const next = { ...current }
      delete next[keyword]
      return next
    })
    setVariationCounts((current) => {
      const next = { ...current }
      delete next[keyword]
      return next
    })
    setSnippetHistory((current) => {
      const next = { ...current }
      delete next[keyword]
      return next
    })
  }

  function toggleKeyword(keyword: string) {
    setSelectedKeywords((current) => {
      if (current.includes(keyword)) {
        return current.filter((entry) => entry !== keyword)
      }

      const item = itemMap.get(keyword)
      if (item && editedSnippets[keyword] === undefined) {
        setEditedSnippets((snippets) => ({ ...snippets, [keyword]: item.snippet }))
      }

      return [...current, keyword]
    })
  }

  function updateSnippet(keyword: string, snippet: string) {
    setEditedSnippets((current) => ({ ...current, [keyword]: snippet }))
  }

  function getSelections(): SkillSnippetSelection[] {
    return selectedKeywords.map((keyword) => {
      const item = itemMap.get(keyword)
      return {
        keyword,
        snippet: editedSnippets[keyword] ?? item?.snippet ?? keyword,
        originalBullet: item?.originalBullet,
        bulletLineIndex: item?.bulletLineIndex,
        modificationType: item?.modificationType,
        placementLabel: item?.placementLabel,
        placementBreadcrumb: item?.placementBreadcrumb,
        targetRoleTitle: item?.targetRoleTitle,
        targetCompany: item?.targetCompany,
        domainLabel: item?.domainLabel,
        positionId: item?.positionId,
        bulletIndex: item?.bulletIndex,
      }
    })
  }

  async function handleIncorporate() {
    if (selectedKeywords.length === 0) return
    await onIncorporate?.(getSelections())
    setSelectedKeywords([])
    setEditedSnippets({})
  }

  function handleInsert() {
    if (selectedKeywords.length === 0) return
    onInsert?.(getSelections())
    setSelectedKeywords([])
    setEditedSnippets({})
  }

  async function handleTailorSnippet(keyword: string) {
    if (!canTailorWithAi) {
      toast.error('Add a job description and resume before tailoring with AI.')
      return
    }

    const item = itemMap.get(keyword)
    const currentSnippet = editedSnippets[keyword] ?? item?.snippet ?? ''
    if (!currentSnippet.trim()) {
      toast.error('Add snippet text before tailoring with AI.')
      return
    }

    const otherSnippets = items
      .filter((entry) => entry.keyword !== keyword)
      .map((entry) => editedSnippets[entry.keyword] ?? entry.snippet)
      .filter(Boolean)

    const variationIndex = (variationCounts[keyword] ?? 0) + 1
    const previousVariations = [
      ...(snippetHistory[keyword] ?? []),
      currentSnippet.trim(),
    ].filter((entry, index, list) => list.indexOf(entry) === index)

    setTailoringKeyword(keyword)
    try {
      const similarityAudit = auditExactPhrasingMatch(currentSnippet.trim(), jobDescription.trim())
      const snippet = await requestTailorSnippet({
        jobDescription: jobDescription.trim(),
        resumeText: resumeText.trim(),
        keyword,
        currentSnippet: currentSnippet.trim(),
        otherSnippets,
        variationIndex,
        previousVariations,
        rephraseJobDescriptionMatch: similarityAudit.hasHighSimilarity,
        matchedJobDescriptionPhrases: similarityAudit.matches.map((match) => match.phrase),
        originalBullet: item?.originalBullet,
        targetRoleTitle: item?.targetRoleTitle,
        targetCompany: item?.targetCompany,
        placementLabel: item?.placementLabel,
        domainLabel: item?.domainLabel,
        modificationType: item?.modificationType,
        siblingBullets: item?.siblingBullets,
      })
      updateSnippet(keyword, snippet)
      setVariationCounts((current) => ({ ...current, [keyword]: variationIndex }))
      setSnippetHistory((current) => ({
        ...current,
        [keyword]: [...(current[keyword] ?? []), currentSnippet.trim(), snippet].slice(-8),
      }))
      toast.success(`Tailored wording for "${keyword}"`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to tailor snippet with AI.')
    } finally {
      setTailoringKeyword(null)
    }
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No major gaps identified.</p>
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{description}</p>

      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const isSelected = selectedKeywords.includes(item.keyword)
          return (
            <button
              key={item.keyword}
              type="button"
              disabled={isLoading}
              onClick={() => toggleKeyword(item.keyword)}
              className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              aria-pressed={isSelected}
            >
              <Badge
                variant={isSelected ? 'default' : 'outline'}
                className={cn(
                  'cursor-pointer transition-colors',
                  isSelected && 'ring-1 ring-brand-gold/50'
                )}
              >
                {item.keyword}
              </Badge>
            </button>
          )
        })}
      </div>

      {selectedKeywords.length > 0 ? (
        <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Preview & edit ({selectedKeywords.length})
          </p>
          {selectedKeywords.map((keyword) => {
            const item = itemMap.get(keyword)
            const snippet = editedSnippets[keyword] ?? item?.snippet ?? ''
            const isTailoring = tailoringKeyword === keyword
            return (
              <SnippetEditorCard
                key={keyword}
                keyword={keyword}
                snippet={snippet}
                item={item}
                jobDescription={jobDescription}
                isLoading={isLoading}
                isTailoring={isTailoring}
                canTailorWithAi={canTailorWithAi}
                onSnippetChange={(value) => updateSnippet(keyword, value)}
                onTailor={() => void handleTailorSnippet(keyword)}
                onRemove={() => removeKeyword(keyword)}
                purgeReason={item?.purgeReason}
              />
            )
          })}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {onIncorporate ? (
          <Button
            type="button"
            size="sm"
            disabled={selectedKeywords.length === 0 || isLoading}
            onClick={handleIncorporate}
          >
            {isLoading ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <RotateCw className="mr-2 size-4" />
            )}
            {actionLabel}
            {selectedKeywords.length > 0 ? ` (${selectedKeywords.length})` : ''}
          </Button>
        ) : null}
        {onInsert ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={selectedKeywords.length === 0 || isLoading}
            onClick={handleInsert}
          >
            <Plus className="mr-2 size-4" />
            {insertLabel}
            {selectedKeywords.length > 0 ? ` (${selectedKeywords.length})` : ''}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

interface SnippetEditorCardProps {
  keyword: string
  snippet: string
  item?: EditableSkillSnippetItem
  jobDescription: string
  isLoading: boolean
  isTailoring: boolean
  canTailorWithAi: boolean
  onSnippetChange: (value: string) => void
  onTailor: () => void
  onRemove: () => void
  purgeReason?: string
}

function SnippetEditorCard({
  keyword,
  snippet,
  item,
  jobDescription,
  isLoading,
  isTailoring,
  canTailorWithAi,
  onSnippetChange,
  onTailor,
  onRemove,
  purgeReason,
}: SnippetEditorCardProps) {
  const [verifyOpen, setVerifyOpen] = useState(false)
  const similarityAudit = usePhrasingSimilarityAudit(snippet, jobDescription)
  const placementLabel =
    item?.placementLabel ??
    (item?.targetRoleTitle && item?.targetCompany
      ? `Suggested adjustment for ${item.targetRoleTitle} at ${item.targetCompany}`
      : undefined)
  const placementBreadcrumb =
    item?.placementBreadcrumb ??
    (item?.targetCompany ? `→ experience [${item.targetCompany}]` : item?.placement ? `→ ${item.placement}` : undefined)
  const showInlineComparison =
    Boolean(item?.originalBullet?.trim()) && item?.modificationType === 'inline-bullet'
  const originalBullet = item?.originalBullet?.trim() ?? ''
  const canVerifyExperience = Boolean(originalBullet)

  return (
    <>
      <VerifySkillModal
        open={verifyOpen}
        onOpenChange={setVerifyOpen}
        skillName={keyword}
        originalBullet={originalBullet}
        onVerified={(result) => {
          if (result.status === 'Pass' && result.revisedBullet?.trim()) {
            onSnippetChange(result.revisedBullet.trim())
            toast.success('Experience verified — revised bullet applied.')
          }
        }}
      />
      <div className="space-y-3 rounded-lg border border-amber-200/70 bg-amber-50/20 p-3">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <Label htmlFor={`snippet-${keyword}`} className="font-medium">
            {keyword}
          </Label>
          {placementLabel ? (
            <p className="text-sm font-medium text-amber-950">{placementLabel}</p>
          ) : null}
          {placementBreadcrumb ? (
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
              {placementBreadcrumb}
            </p>
          ) : null}
          {item?.domainLabel ? (
            <p className="text-xs text-muted-foreground">Domain: {item.domainLabel}</p>
          ) : null}
        </div>
        {item?.category ? (
          <Badge variant="secondary" className="text-[10px] uppercase">
            {item.category}
          </Badge>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs"
          disabled={isLoading || isTailoring || !canTailorWithAi || !snippet.trim()}
          onClick={onTailor}
        >
          {isTailoring ? (
            <>
              <Loader2 className="size-3 animate-spin" />
              Tailoring…
            </>
          ) : (
            <>✨ Tailor with AI</>
          )}
        </Button>
        {canVerifyExperience ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            disabled={isLoading || isTailoring}
            onClick={() => setVerifyOpen(true)}
          >
            <ShieldCheck className="size-3" />
            Verify experience
          </Button>
        ) : null}
        {similarityAudit.hasHighSimilarity ? <PhrasingSimilarityBadge /> : null}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="ml-auto h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
          disabled={isLoading || isTailoring}
          onClick={onRemove}
        >
          <X className="size-3" />
          Remove
        </Button>
      </div>

      {purgeReason ? (
        <p className="text-xs text-amber-800">Purged: {purgeReason}</p>
      ) : null}

      {showInlineComparison ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-sm leading-relaxed text-muted-foreground">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em]">
              Original bullet
            </span>
            {item?.originalBullet}
          </div>
          <div className="rounded-md border border-amber-200/80 bg-background px-3 py-2">
            <Label htmlFor={`snippet-${keyword}`} className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-amber-900">
              Revised bullet
            </Label>
            <Textarea
              id={`snippet-${keyword}`}
              value={snippet}
              onChange={(event) => onSnippetChange(event.target.value)}
              rows={4}
              disabled={isLoading || isTailoring}
              className="min-h-[96px] border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
            />
          </div>
        </div>
      ) : (
        <Textarea
          id={`snippet-${keyword}`}
          value={snippet}
          onChange={(event) => onSnippetChange(event.target.value)}
          rows={3}
          disabled={isLoading || isTailoring}
          className="text-sm"
        />
      )}

      {jobDescription.trim() ? (
        <PhrasingSimilarityPreview
          text={snippet}
          jobDescription={jobDescription}
          showBadge={false}
        />
      ) : null}
      </div>
    </>
  )
}

interface SelectableMissingKeywordsProps {
  keywords: string[]
  onIncorporate: (selections: SkillSnippetSelection[]) => void | Promise<void>
  isLoading?: boolean
  description?: string
  jobDescription?: string
  resumeText?: string
}

/** Missing keyword picker with full-sentence preview and edit support. */
export function SelectableMissingKeywords({
  keywords,
  onIncorporate,
  isLoading = false,
  description,
  jobDescription,
  resumeText,
}: SelectableMissingKeywordsProps) {
  const items = useMemo(
    () =>
      buildSnippetsForKeywords(keywords, {
        resumeText,
        jobDescription,
      }).map((addition) => ({
        keyword: addition.skill,
        snippet: addition.snippet,
        category: addition.category,
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
      })),
    [keywords, resumeText, jobDescription]
  )

  return (
    <EditableSkillSnippetPicker
      items={items}
      onIncorporate={onIncorporate}
      isLoading={isLoading}
      description={description}
      jobDescription={jobDescription}
      resumeText={resumeText}
    />
  )
}

interface SelectablePurgedKeywordsProps {
  items: Array<{
    skill: string
    snippet: string
    category: string
    placementLabel: string
    purgeReason: string
    originalBullet?: string
    bulletLineIndex?: number
    modificationType?: 'inline-bullet' | 'skills-section' | 'summary'
    targetRoleTitle?: string
    targetCompany?: string
    domainLabel?: string
  }>
  onIncorporate: (selections: SkillSnippetSelection[]) => void | Promise<void>
  isLoading?: boolean
  jobDescription?: string
  resumeText?: string
}

/** Purged keyword picker with placement preview, edit support, and re-tailor action. */
export function SelectablePurgedKeywords({
  items,
  onIncorporate,
  isLoading = false,
  jobDescription,
  resumeText,
}: SelectablePurgedKeywordsProps) {
  const pickerItems = useMemo(
    () =>
      items.map((item) => ({
        keyword: item.skill,
        snippet: item.snippet,
        category: item.category,
        placement: item.placementLabel,
        placementLabel: item.placementLabel,
        originalBullet: item.originalBullet,
        bulletLineIndex: item.bulletLineIndex,
        modificationType: item.modificationType,
        targetRoleTitle: item.targetRoleTitle,
        targetCompany: item.targetCompany,
        domainLabel: item.domainLabel,
        purgeReason: item.purgeReason,
      })),
    [items]
  )

  return (
    <EditableSkillSnippetPicker
      items={pickerItems}
      onIncorporate={onIncorporate}
      isLoading={isLoading}
      description="Terms the auditor removed — select any you can truthfully claim. Each card shows the targeted role and the existing bullet being revised before re-tailoring."
      actionLabel="Restore selected & re-tailor"
      jobDescription={jobDescription}
      resumeText={resumeText}
    />
  )
}
