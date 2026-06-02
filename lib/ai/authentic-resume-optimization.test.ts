import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  AUTHENTIC_RESUME_OPTIMIZATION_DIRECTIVE,
} from '@/lib/ai/authentic-resume-optimization-directive'
import {
  bulletContainsUngroundedMetric,
  enforceAuthenticResumeOptimization,
  stripBannedAuthenticPhrases,
  stripFabricatedMetricClauses,
} from '@/lib/ai/authentic-resume-optimization'
import { SYSTEM_PROMPT } from '@/lib/ai/prompts'
import { isPersonalProjectEntry } from '@/lib/resume/personal-project-detection'
import type { TailoredResume } from '@/lib/ai/schemas'

const bradFixture = readFileSync(
  join(process.cwd(), 'test-fixtures', 'brad-resume.txt'),
  'utf8'
)

test('SYSTEM_PROMPT includes authentic resume optimization directive', () => {
  assert.match(SYSTEM_PROMPT, /Authentic Resume Optimization Engine/)
  assert.match(AUTHENTIC_RESUME_OPTIMIZATION_DIRECTIVE, /NO FABRICATED METRICS/)
  assert.match(AUTHENTIC_RESUME_OPTIMIZATION_DIRECTIVE, /cv2ats\.ca/)
})

test('bulletContainsUngroundedMetric detects invented percentages', () => {
  assert.equal(
    bulletContainsUngroundedMetric(
      'Steered release planning, improving delivery efficiency by 15%.',
      bradFixture
    ),
    true
  )
  assert.equal(
    bulletContainsUngroundedMetric(
      'Managed release cycles and AWS deployments for internal tools supporting 500+ staff.',
      bradFixture
    ),
    false
  )
})

test('stripBannedAuthenticPhrases removes AI corporate fluff', () => {
  const cleaned = stripBannedAuthenticPhrases(
    'Leader with a proven track record who spearheaded synergy across teams dynamically.'
  )
  assert.doesNotMatch(cleaned, /proven track record|spearheaded|synergy|dynamically/i)
})

test('stripFabricatedMetricClauses removes invented efficiency claims', () => {
  const cleaned = stripFabricatedMetricClauses(
    'Steered release planning, improving delivery efficiency by 15%.'
  )
  assert.doesNotMatch(cleaned, /15%/)
  assert.match(cleaned, /Steered release planning/i)
})

test('enforceAuthenticResumeOptimization reverts bullets with invented metrics', () => {
  const draft: TailoredResume = {
    contact: {
      name: 'Brad Mulders',
      email: 'bradmulders@me.com',
      phone: '',
      location: '',
      linkedin: '',
    },
    summary: 'Technical leader with a proven track record.',
    skills: ['Agile'],
    experience: [
      {
        title: 'Technical Project Manager',
        company: 'Pleasant Solutions',
        location: '',
        startDate: '02/2024',
        endDate: 'Present',
        bullets: [
          'Steered end-to-end release planning, improving delivery efficiency by 15%.',
        ],
      },
      {
        title: 'Systems Developer',
        company: 'Alberta Motor Association',
        location: '',
        startDate: '2013',
        endDate: '2024',
        bullets: [
          'Managed release cycles and AWS deployments for internal tools supporting 500+ staff.',
        ],
      },
    ],
    projects: [],
    education: [],
    certifications: [],
  }

  const enforced = enforceAuthenticResumeOptimization(draft, bradFixture)

  assert.doesNotMatch(enforced.summary, /proven track record/i)
  assert.doesNotMatch(enforced.experience[0]!.bullets[0]!, /15%/)
  assert.doesNotMatch(enforced.experience[0]!.bullets[0]!, /improving delivery efficiency/i)
  assert.match(enforced.experience[1]!.bullets[0]!, /500\+ staff/)
})

test('isPersonalProjectEntry recognizes cv2ats personal venture context', () => {
  assert.equal(
    isPersonalProjectEntry({
      title: 'Personal venture',
      company: 'cv2ats.ca',
    }),
    true
  )
})
