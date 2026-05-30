/** Shared layout tokens for the side-by-side Job Description + Resume workspace. */

/** Minimum height of the primary editing viewport in both panels. */
export const WORKSPACE_EDITOR_HEIGHT_CLASS = 'h-[min(360px,42vh)] min-h-[280px]'

/** Compact read-only preview region (resume source preview). */
export const WORKSPACE_PREVIEW_HEIGHT_CLASS = 'h-40 min-h-[10rem]'

/** Outer shell — identical border, padding, and scroll gutter on both panels. */
export const WORKSPACE_VIEWPORT_SHELL_CLASS =
  'flex flex-col overflow-hidden rounded-lg border border-border/80 bg-muted/20 shadow-inner'

/** Inner scroll region for text areas and tag lists. */
export const WORKSPACE_VIEWPORT_BODY_CLASS =
  'flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]'

/** Primary textarea — borderless inside the shell; scrolling handled by body. */
export const WORKSPACE_TEXTAREA_CLASS =
  'field-sizing-content min-h-full w-full resize-none rounded-none border-0 bg-transparent px-3 py-3 text-sm leading-relaxed shadow-none focus-visible:border-0 focus-visible:ring-0 md:text-sm'

/** Tag / chip row container inside a viewport. */
export const WORKSPACE_TAG_REGION_CLASS =
  'flex flex-wrap gap-2 border-t border-border/60 bg-background/80 px-3 py-2'

/** Character counter row under each viewport. */
export const WORKSPACE_COUNTER_CLASS = 'mt-2 text-xs text-muted-foreground'

export const WORKSPACE_COUNTER_AT_LIMIT_CLASS = 'mt-2 text-xs font-medium text-destructive'

/** Step card content area inside workspace accordions. */
export const WORKSPACE_STEP_CONTENT_CLASS = 'flex flex-col'
