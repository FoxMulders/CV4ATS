import assert from 'node:assert/strict'
import test from 'node:test'

import { mapJobSkillExtractionResult } from '@/lib/ai/extract-job-skills'
import type { JobSkillExtractionResult } from '@/lib/ai/job-skill-extraction-schemas'

test('mapJobSkillExtractionResult demotes vendor product misplaced in coreMethodologies', () => {
  const result: JobSkillExtractionResult = {
    coreMethodologies: [
      {
        term: 'Genesys Cloud',
        tier: 'core',
        skillClass: 'vendorSpecific',
        functionalEquivalent: 'cloud technologies',
      },
    ],
    desirablePreferred: [],
  }

  const skills = mapJobSkillExtractionResult(result)
  const byTerm = Object.fromEntries(skills.map((skill) => [skill.term, skill.priorityTier]))

  assert.equal(byTerm['genesys cloud'], 'desirable')
  assert.equal(byTerm['cloud technologies'], 'core')
})

test('mapJobSkillExtractionResult keeps foundational skills in core tier', () => {
  const result: JobSkillExtractionResult = {
    coreMethodologies: [
      {
        term: 'distributed systems',
        tier: 'core',
        skillClass: 'foundational',
      },
    ],
    desirablePreferred: [
      {
        term: 'Genesys Cloud',
        tier: 'desirable',
        skillClass: 'vendorSpecific',
        functionalEquivalent: 'cloud technologies',
      },
    ],
  }

  const skills = mapJobSkillExtractionResult(result)
  const byTerm = Object.fromEntries(skills.map((skill) => [skill.term, skill.priorityTier]))

  assert.equal(byTerm['distributed systems'], 'core')
  assert.equal(byTerm['genesys cloud'], 'desirable')
  assert.equal(byTerm['cloud technologies'], 'core')
})
