/** After a large paste, reset textarea view so users see the start of the content. */
export function handlePasteScrollToTop(event: React.ClipboardEvent<HTMLTextAreaElement>) {
  const textarea = event.currentTarget
  window.setTimeout(() => {
    textarea.scrollTop = 0
    textarea.setSelectionRange(0, 0)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, 0)
}

/** After a large paste, jump to the end of the content and the generate section. */
export function handlePasteScrollToBottom(
  event: React.ClipboardEvent<HTMLTextAreaElement>,
  scrollTargetId?: string
) {
  const textarea = event.currentTarget
  window.setTimeout(() => {
    textarea.scrollTop = textarea.scrollHeight
    const end = textarea.value.length
    textarea.setSelectionRange(end, end)

    const target = scrollTargetId ? document.getElementById(scrollTargetId) : null
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })
    }
  }, 0)
}
