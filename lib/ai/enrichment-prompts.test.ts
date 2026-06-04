import assert from 'node:assert/strict'
import test from 'node:test'

import { buildEnrichmentUserPrompt } from '@/lib/ai/enrichment-prompts'

test('buildEnrichmentUserPrompt falls back to raw resume text when parse finds no blocks', () => {
  const raw = [
    'Jane Doe',
    'jane@example.com',
    '',
    'Led delivery programs at Acme Corp for five years.',
    '• Built internal APIs supporting 200+ users',
  ].join('\n')

  const prompt = buildEnrichmentUserPrompt({
    jobDescription: 'Project Manager role at Acme',
    sourceResumeText: raw,
  })

  assert.match(prompt, /structured parse failed/i)
  assert.match(prompt, /Acme Corp/)
  assert.doesNotMatch(prompt, /"experienceBullets": \[\]/)
})
