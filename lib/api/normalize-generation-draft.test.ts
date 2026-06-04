import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { AiGenerationResult } from '@/lib/ai/schemas'
import { applyGenerationHygiene } from '@/lib/ai/generation-hygiene'
import { normalizeAiGenerationOutput } from '@/lib/ai/normalize-output'
import { normalizeGenerationDraftForApi } from '@/lib/api/normalize-generation-draft'
import { aiGenerationResultSchema } from '@/lib/ai/schemas'

const bradFixture = readFileSync(
  join(process.cwd(), 'test-fixtures', 'brad-resume.txt'),
  'utf8'
)

const flattenedDraft: AiGenerationResult = {
  keywordReport: {
    matchScore: 70,
    matchedKeywords: [],
    missingKeywords: [],
    suggestions: [],
  },
  tailoredResume: {
    contact: {
      name: 'Professional Summary',
      email: 'bradmulders@me.com',
      phone: '',
      location: '',
      linkedin: '',
    },
    summary: 'Program leader with delivery focus.',
    skills: ['Agile', 'Jira'],
    experience: [
      {
        title: 'Consultant',
        company: 'Independent',
        location: '',
        startDate: '2010',
        endDate: 'Present',
        bullets: [
          '### Technical Project Manager — Pleasant Solutions',
          '02/2024 - Present',
          'Led release planning for enterprise clients.',
          '### Systems Developer — Alberta Motor Association',
          '2013 - 2024',
          'Built C# automation tools.',
        ],
      },
    ],
    projects: [],
    education: [],
    certifications: [],
  },
  coverLetter: 'Dear Hiring Manager, I am interested in this role.',
}

test('normalizeGenerationDraftForApi splits flattened consultant shell into distinct employers', () => {
  const normalized = normalizeGenerationDraftForApi(flattenedDraft, bradFixture)

  assert.equal(normalized.tailoredResume.experience.length, 2)
  assert.match(normalized.tailoredResume.experience[0]!.company, /Pleasant Solutions/i)
  assert.match(normalized.tailoredResume.experience[1]!.company, /Alberta Motor Association/i)
  assert.ok(
    normalized.tailoredResume.experience.every(
      (entry) => !/^(independent|consultant)$/i.test(entry.company.trim())
    )
  )
})

test('normalizeGenerationDraftForApi restores Brad Mulders when stream sends section heading as name', () => {
  const normalized = normalizeGenerationDraftForApi(flattenedDraft, bradFixture)

  assert.equal(normalized.tailoredResume.contact.name, 'Brad Mulders')
  assert.doesNotMatch(normalized.tailoredResume.contact.name, /professional summary/i)
})

test('normalizeAiGenerationOutput enforces experience boundaries before schema parse', () => {
  const normalized = normalizeAiGenerationOutput(flattenedDraft, bradFixture) as AiGenerationResult
  const parsed = aiGenerationResultSchema.parse(normalized)

  assert.equal(parsed.tailoredResume.experience.length, 2)
  assert.equal(parsed.tailoredResume.contact.name, 'Brad Mulders')
})

test('applyGenerationHygiene keeps independent employer objects after optimization', () => {
  const normalized = normalizeGenerationDraftForApi(flattenedDraft, bradFixture)
  const hygiened = applyGenerationHygiene(normalized, bradFixture)

  assert.equal(hygiened.tailoredResume.experience.length, 2)
  assert.match(hygiened.tailoredResume.experience[0]!.company, /Pleasant Solutions/i)
  assert.match(hygiened.tailoredResume.experience[1]!.company, /Alberta Motor Association/i)
  assert.ok(hygiened.tailoredResume.experience.every((entry) => entry.bullets.length > 0))
})
