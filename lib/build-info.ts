import packageJson from '@/package.json'
import { getGeminiApiKey } from '@/lib/ai/gemini'

/** Semver with a three-digit patch segment (e.g. 0.1.0 → 0.1.000). */
export function formatAppVersion(raw: string): string {
  const [major = '0', minor = '0', patch = '0'] = raw.split('.')
  const patchSegment = patch.replace(/\D.*$/, '')
  return `${major}.${minor}.${patchSegment.padStart(3, '0')}`
}

/** Short git SHA from Vercel/CI, or a local fallback. */
export function resolveBuildId(): string {
  const sha =
    process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
    process.env.GIT_COMMIT?.trim() ||
    process.env.COMMIT_SHA?.trim()

  if (sha) {
    return sha.slice(0, 7)
  }

  return process.env.NODE_ENV === 'production' ? 'unknown' : 'local'
}

export function getVersionPayload() {
  return {
    version: formatAppVersion(packageJson.version),
    build: resolveBuildId(),
    geminiConfigured: Boolean(getGeminiApiKey()),
  }
}
