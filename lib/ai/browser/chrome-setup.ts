/** Chrome flag URLs for on-device Gemini Nano (user must open manually — sites cannot set flags). */
export const CHROME_NANO_FLAG_URLS = {
  promptApi: 'chrome://flags/#prompt-api-for-gemini-nano',
  onDeviceModel: 'chrome://flags/#optimization-guide-on-device-model',
  components: 'chrome://components/',
} as const

export const CHROME_NANO_SETUP_STEPS = [
  {
    title: 'Open Chrome flags',
    detail: 'Paste chrome://flags into the address bar (Chrome desktop 138+).',
    href: CHROME_NANO_FLAG_URLS.promptApi,
    linkLabel: 'Open Prompt API flag',
  },
  {
    title: 'Enable Prompt API for Gemini Nano',
    detail: 'Set “Prompt API for Gemini Nano” to Enabled.',
    href: CHROME_NANO_FLAG_URLS.promptApi,
    linkLabel: 'Open flag',
  },
  {
    title: 'Enable on-device model',
    detail:
      'Set “Optimization Guide On Device Model” to Enabled or Enabled BypassPerfRequirement.',
    href: CHROME_NANO_FLAG_URLS.onDeviceModel,
    linkLabel: 'Open flag',
  },
  {
    title: 'Restart Chrome',
    detail: 'Click Relaunch at the bottom of the flags page.',
  },
  {
    title: 'Confirm model download (optional)',
    detail:
      'At chrome://components, check “Optimization Guide On Device Model” has a version. First download can take 10–30 minutes.',
    href: CHROME_NANO_FLAG_URLS.components,
    linkLabel: 'Open components',
  },
] as const

export function isChromeDesktopBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /Chrome\//.test(ua) && !/Edg\//.test(ua) && !/OPR\//.test(ua)
}
