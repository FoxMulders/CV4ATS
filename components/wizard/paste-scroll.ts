import {
  guideWorkspaceFocusAfterJobPaste,
  guideWorkspaceFocusAfterResumePaste,
  pulseElement,
} from '@/lib/wizard/workspace-focus-guide'

/** After a large paste, reset textarea view so users see the start of the content. */
export function handlePasteScrollToTop(event: React.ClipboardEvent<HTMLTextAreaElement>) {
  const textarea = event.currentTarget
  window.setTimeout(() => {
    textarea.scrollTop = 0
    textarea.setSelectionRange(0, 0)
  }, 0)
}

/** After job-description paste completes, route focus to the next workspace step. */
export function handleJobDescriptionPaste(
  event: React.ClipboardEvent<HTMLTextAreaElement>,
  options: {
    resumePopulated: boolean
    onFocusTarget?: (target: 'resume' | 'generate') => void
  }
) {
  handlePasteScrollToTop(event)

  const pastedText = event.clipboardData.getData('text')
  if (!pastedText.trim()) return

  window.setTimeout(() => {
    const target = guideWorkspaceFocusAfterJobPaste(options.resumePopulated)
    options.onFocusTarget?.(target)
  }, 0)
}

/** After resume paste completes, route focus to job description, generate, or a custom anchor. */
export function handleResumePaste(
  event: React.ClipboardEvent<HTMLTextAreaElement>,
  options: {
    jobPopulated: boolean
    scrollTargetId?: string
    onFocusTarget?: (target: 'job' | 'generate') => void
  }
) {
  handlePasteScrollToTop(event)

  const pastedText = event.clipboardData.getData('text')
  if (!pastedText.trim()) return

  window.setTimeout(() => {
    if (options.jobPopulated) {
      const target = guideWorkspaceFocusAfterResumePaste(true)
      options.onFocusTarget?.(target)
      return
    }

    if (options.scrollTargetId) {
      const anchor = document.getElementById(options.scrollTargetId)
      anchor?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      pulseElement(anchor)
      return
    }

    const target = guideWorkspaceFocusAfterResumePaste(false)
    options.onFocusTarget?.(target)
  }, 0)
}
