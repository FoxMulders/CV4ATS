import assert from 'node:assert/strict'
import test from 'node:test'

import { buildAtsKeywordInjectionSystemPrompt } from '@/lib/ai/ats-keyword-injection-directive'
import {
  buildFoundationalPivotSnippet,
  extractFoundationalTermsFromResume,
  isProprietaryPlatformTerm,
} from '@/lib/resume/proprietary-skill-weaving'

const resumeWithCloud = `Professional Summary
Delivery leader with AWS and Azure cloud migration experience and custom automation platforms for release workflows.`

test('isProprietaryPlatformTerm detects vendor platforms like Genesys Cloud', () => {
  assert.equal(isProprietaryPlatformTerm('Genesys Cloud'), true)
  assert.equal(isProprietaryPlatformTerm('Program Management'), false)
})

test('extractFoundationalTermsFromResume finds AWS, Azure, and automation evidence', () => {
  const terms = extractFoundationalTermsFromResume(resumeWithCloud)
  assert.ok(terms.includes('AWS'))
  assert.ok(terms.includes('Azure'))
  assert.ok(terms.some((term) => /custom automation/i.test(term)))
})

test('buildFoundationalPivotSnippet avoids proprietary platform names in summary', () => {
  const snippet = buildFoundationalPivotSnippet(
    {
      snippet:
        'Delivery leader with proven Genesys Cloud experience aligned to complex technical environments.',
      originalBullet: 'Delivery leader with 20+ years bridging product vision and execution.',
      modificationType: 'summary',
    },
    resumeWithCloud
  )

  assert.doesNotMatch(snippet, /genesys/i)
  assert.match(snippet, /AWS/i)
  assert.match(snippet, /Azure/i)
})

test('buildAtsKeywordInjectionSystemPrompt uses foundational pivot directive', () => {
  const prompt = buildAtsKeywordInjectionSystemPrompt({
    missingSkill: 'Genesys Cloud',
    weavingStrategy: 'foundational-pivot',
    resumeText: resumeWithCloud,
    modificationType: 'summary',
  })

  assert.match(prompt, /Foundational pivot/i)
  assert.match(prompt, /Do NOT integrate "Genesys Cloud"/i)
  assert.match(prompt, /AWS/)
  assert.doesNotMatch(prompt, /You MUST integrate the specific term "Genesys Cloud"/)
})
