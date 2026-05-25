'use client'

import { Loader2, Plus, RotateCw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { buildSnippetsForKeywords } from '@/lib/resume/skill-snippets'
import { cn } from '@/lib/utils'

export interface SkillSnippetSelection {
  keyword: string
  snippet: string
}

export interface EditableSkillSnippetItem {
  keyword: string
  snippet: string
  category?: string
  placement?: string
}

interface EditableSkillSnippetPickerProps {
  items: EditableSkillSnippetItem[]
  onIncorporate?: (selections: SkillSnippetSelection[]) => void | Promise<void>
  onInsert?: (selections: SkillSnippetSelection[]) => void
  isLoading?: boolean
  description?: string
  actionLabel?: string
  insertLabel?: string
}

export function EditableSkillSnippetPicker({
  items,
  onIncorporate,
  onInsert,
  isLoading = false,
  description = 'Click a skill to preview the full sentence it will add. Edit the wording, then incorporate or insert.',
  actionLabel = 'Incorporate selected & re-tailor',
  insertLabel = 'Insert selected into resume',
}: EditableSkillSnippetPickerProps) {
  const itemMap = useMemo(
    () => new Map(items.map((item) => [item.keyword, item])),
    [items]
  )

  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([])
  const [editedSnippets, setEditedSnippets] = useState<Record<string, string>>({})

  useEffect(() => {
    const validKeywords = new Set(items.map((item) => item.keyword))
    setSelectedKeywords((current) => current.filter((keyword) => validKeywords.has(keyword)))
    setEditedSnippets((current) =>
      Object.fromEntries(Object.entries(current).filter(([keyword]) => validKeywords.has(keyword)))
    )
  }, [items])

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
            return (
              <div key={keyword} className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Label htmlFor={`snippet-${keyword}`} className="font-medium">
                    {keyword}
                  </Label>
                  {item?.category ? (
                    <Badge variant="secondary" className="text-[10px] uppercase">
                      {item.category}
                    </Badge>
                  ) : null}
                  {item?.placement ? (
                    <span className="text-xs text-muted-foreground">→ {item.placement}</span>
                  ) : null}
                </div>
                <Textarea
                  id={`snippet-${keyword}`}
                  value={snippet}
                  onChange={(event) => updateSnippet(keyword, event.target.value)}
                  rows={3}
                  disabled={isLoading}
                  className="text-sm"
                />
              </div>
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

interface SelectableMissingKeywordsProps {
  keywords: string[]
  onIncorporate: (selections: SkillSnippetSelection[]) => void | Promise<void>
  isLoading?: boolean
  description?: string
}

/** Missing keyword picker with full-sentence preview and edit support. */
export function SelectableMissingKeywords({
  keywords,
  onIncorporate,
  isLoading = false,
  description,
}: SelectableMissingKeywordsProps) {
  const items = useMemo(
    () =>
      buildSnippetsForKeywords(keywords).map((addition) => ({
        keyword: addition.skill,
        snippet: addition.snippet,
        category: addition.category,
        placement: addition.placement,
      })),
    [keywords]
  )

  return (
    <EditableSkillSnippetPicker
      items={items}
      onIncorporate={onIncorporate}
      isLoading={isLoading}
      description={description}
    />
  )
}
