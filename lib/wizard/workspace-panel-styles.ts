/** Shared layout tokens for the side-by-side Job Description + Resume workspace. */

/** Minimum comfortable height for primary editing regions — no fixed max; pane scrolls. */
export const WORKSPACE_EDITOR_HEIGHT_CLASS = 'min-h-[12rem]'

/** Compact read-only preview region (resume source preview). */
export const WORKSPACE_PREVIEW_HEIGHT_CLASS = 'min-h-[10rem]'

/** Outer shell — border and padding; scrolling is handled by the workspace pane only. */
export const WORKSPACE_VIEWPORT_SHELL_CLASS =
  'rounded-lg border border-border/80 bg-muted/20 shadow-inner'

/** Inner content region — grows with content, no nested scroll. */
export const WORKSPACE_VIEWPORT_BODY_CLASS = 'min-h-[12rem]'

/** Primary textarea — borderless inside the shell; grows with field-sizing-content. */
export const WORKSPACE_TEXTAREA_CLASS =
  'field-sizing-content min-h-[12rem] w-full resize-y rounded-none border-0 bg-transparent px-3 py-3 text-sm leading-relaxed shadow-none focus-visible:border-0 focus-visible:ring-0 md:text-sm'

/** Tag / chip row container inside a viewport. */
export const WORKSPACE_TAG_REGION_CLASS =
  'flex flex-wrap gap-2 border-t border-border/60 bg-background/80 px-3 py-2'

/** Character counter row under each viewport. */
export const WORKSPACE_COUNTER_CLASS = 'mt-2 text-xs text-muted-foreground'

export const WORKSPACE_COUNTER_AT_LIMIT_CLASS = 'mt-2 text-xs font-medium text-destructive'

/** Step card content area inside workspace accordions. */
export const WORKSPACE_STEP_CONTENT_CLASS = 'flex flex-col'
