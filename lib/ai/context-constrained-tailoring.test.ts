import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { TailoredResume } from '@/lib/ai/schemas'
import { applyGenerationHygiene } from '@/lib/ai/generation-hygiene'
import { enforceContextConstrainedTailoring } from '@/lib/ai/context-constrained-tailoring'
import { CONTEXT_CONSTRAINED_TAILORING_DIRECTIVE } from '@/lib/ai/context-constrained-tailoring'
import { SYSTEM_PROMPT } from '@/lib/ai/prompts'

const bradFixture = readFileSync(
  join(process.cwd(), 'test-fixtures', 'brad-resume.txt'),
  'utf8'
)

function hallucinatedDraft(): TailoredResume {
  return {
    contact: {
      name: 'Candidate Name',
      email: 'bradmulders@me.com',
      phone: '',
      location: '',
      linkedin: '',
    },
    summary: 'About the job: steward of enterprise platforms across their lifecycle.',
    skills: ['Agile'],
    experience: [
      {
        title: 'Independent Consultant',
        company: 'Independent',
        location: '',
        startDate: '2010',
        endDate: 'Present',
        bullets: ['Led enterprise delivery programs with measurable impact.'],
      },
    ],
    projects: [],
    education: [
      {
        degree: 'Bachelor of Science',
        school: 'Athabasca University',
        graduationDate: '2000',
        details: '',
      },
    ],
    certifications: ['PMP Coursework'],
  }
}

test('SYSTEM_PROMPT includes context-constrained tailoring directive', () => {
  assert.match(SYSTEM_PROMPT, /Context-Constrained Resume Tailoring Engine/)
  assert.match(CONTEXT_CONSTRAINED_TAILORING_DIRECTIVE, /IDENTITY IMMUTABILITY/)
  assert.match(CONTEXT_CONSTRAINED_TAILORING_DIRECTIVE, /NO GHOST ROLES/)
})

test('enforceContextConstrainedTailoring restores identity and timeline', () => {
  const enforced = enforceContextConstrainedTailoring(hallucinatedDraft(), bradFixture)

  assert.equal(enforced.contact.name, 'Brad Mulders')
  assert.equal(enforced.experience.length, 2)
  assert.ok(enforced.experience.some((entry) => /Pleasant Solutions/i.test(entry.company)))
  assert.ok(enforced.experience.some((entry) => /Alberta Motor Association/i.test(entry.company)))
  assert.ok(
    enforced.experience.every((entry) => !/^(independent|consultant)$/i.test(entry.company.trim()))
  )
})

test('enforceContextConstrainedTailoring rejects fabricated education institutions', () => {
  const enforced = enforceContextConstrainedTailoring(hallucinatedDraft(), bradFixture)

  assert.ok(enforced.education.length >= 1)
  assert.ok(
    enforced.education.every(
      (entry) =>
        !/athabasca/i.test(entry.school) &&
        !/athabasca/i.test(entry.degree)
    )
  )
  assert.match(
    enforced.education.map((entry) => `${entry.degree} ${entry.school}`).join(' '),
    /University of Alberta|Bachelor of Science/i
  )
})

test('applyGenerationHygiene runs context-constrained enforcement', () => {
  const result = applyGenerationHygiene(
    {
      keywordReport: {
        matchScore: 70,
        matchedKeywords: [],
        missingKeywords: [],
        suggestions: [],
      },
      tailoredResume: hallucinatedDraft(),
      coverLetter: 'Complete cover letter paragraph with proof points.',
    },
    bradFixture
  )

  assert.equal(result.tailoredResume.contact.name, 'Brad Mulders')
  assert.equal(result.tailoredResume.experience.length, 2)
})
