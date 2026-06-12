/** Shared fluid layout tokens — keep max-widths and spacing in one place. */

/** Primary marketing / content shell — stretches to ~80rem on ultrawide. */
export const PAGE_CONTAINER_CLASS =
  'mx-auto w-full max-w-7xl px-[var(--space-page-x)]'

/** Wider shell for data-dense pages (jobs grid, workspace header band). */
export const PAGE_CONTAINER_WIDE_CLASS =
  'mx-auto w-full max-w-screen-2xl px-[var(--space-page-x)]'

/** Edge-to-edge workspace shell — fluid gutters only, no max-width cap. */
export const PAGE_CONTAINER_FLUID_CLASS =
  'mx-auto w-full max-w-none px-[var(--space-page-x)]'

/** Vertical rhythm for stacked page sections. */
export const PAGE_SECTION_STACK_CLASS = 'flex flex-col gap-[var(--space-section)]'

/** Main content band below hero/header. */
export const PAGE_MAIN_CLASS =
  'mx-auto w-full max-w-7xl flex-1 px-[var(--space-page-x)] py-[var(--space-page-y)]'

/** Premium surface — cards, panels, accordions. */
export const SURFACE_CARD_CLASS =
  'rounded-[var(--radius-surface)] border border-border/80 bg-card shadow-[var(--shadow-ambient)]'

/** Elevated interactive surface (modals, floating bars). */
export const SURFACE_ELEVATED_CLASS =
  'rounded-[var(--radius-surface)] border border-border/80 bg-card shadow-[var(--shadow-elevated)]'

/** Horizontal scroll wrapper for tables, code, wide previews on small screens. */
export const OVERFLOW_X_SAFE_CLASS =
  'max-w-full overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]'
