/** DOM ids for workspace focus transitions after job-description paste. */
export const RESUME_STEP_ANCHOR_ID = 'resume-input-step'
export const RESUME_PASTE_TAB_ID = 'resume-paste-tab'
export const RESUME_TEXT_INPUT_ID = 'resume-text-input'
export const GENERATE_STEP_ANCHOR_ID = 'generate-step'
export const GENERATE_ACTION_ID = 'generate-analysis-button'

export const WORKSPACE_FOCUS_PULSE_CLASS = 'workspace-focus-pulse'

const FOCUS_DELAY_MS = 120
const PULSE_DURATION_MS = 2600

export type WorkspaceFocusTarget = 'resume' | 'generate'

function pulseElement(element: HTMLElement | null | undefined) {
  if (!element) return

  element.classList.remove(WORKSPACE_FOCUS_PULSE_CLASS)
  // Force reflow so repeated pastes retrigger the animation.
  void element.offsetWidth
  element.classList.add(WORKSPACE_FOCUS_PULSE_CLASS)

  window.setTimeout(() => {
    element.classList.remove(WORKSPACE_FOCUS_PULSE_CLASS)
  }, PULSE_DURATION_MS)
}

function activateResumePasteTab() {
  const pasteTab = document.getElementById(RESUME_PASTE_TAB_ID)
  if (!pasteTab || pasteTab.hasAttribute('data-active')) return
  pasteTab.click()
}

function focusFocusable(element: HTMLElement | null | undefined) {
  if (!element) return

  if (element instanceof HTMLTextAreaElement || element instanceof HTMLButtonElement) {
    element.focus({ preventScroll: true })
    return
  }

  if (typeof element.focus === 'function') {
    element.focus({ preventScroll: true })
  }
}

/** Scroll, pulse, and focus the resume paste editor when resume input is still empty. */
export function guideFocusToResumeInput() {
  activateResumePasteTab()

  window.setTimeout(() => {
    const step = document.getElementById(RESUME_STEP_ANCHOR_ID)
    const editor = document.querySelector<HTMLElement>('[aria-label="Resume text editor"]')
    const textarea = document.getElementById(RESUME_TEXT_INPUT_ID)

    step?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    pulseElement(step)
    pulseElement(editor)
    focusFocusable(textarea)
  }, FOCUS_DELAY_MS)
}

/** Scroll, pulse, and focus the generate action when resume input is already populated. */
export function guideFocusToGenerateAction() {
  window.setTimeout(() => {
    const step = document.getElementById(GENERATE_STEP_ANCHOR_ID)
    const button = document.getElementById(GENERATE_ACTION_ID)

    step?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    pulseElement(step)
    pulseElement(button)
    focusFocusable(button)
  }, FOCUS_DELAY_MS)
}

export function guideWorkspaceFocusAfterJobPaste(resumePopulated: boolean) {
  if (resumePopulated) {
    guideFocusToGenerateAction()
    return 'generate' as const
  }

  guideFocusToResumeInput()
  return 'resume' as const
}
