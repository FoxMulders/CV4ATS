import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  enforceFactualSkills,
  FACTUAL_ANCHORING_DIRECTIVE,
  isComplianceFrameworkSkill,
  sourcePermitsComplianceFrameworks,
} from '@/lib/ai/factual-anchoring'
import { SYSTEM_PROMPT } from '@/lib/ai/prompts'
import { enforceContextConstrainedTailoring } from '@/lib/ai/context-constrained-tailoring'
import type { TailoredResume } from '@/lib/ai/schemas'

const bradFixture = readFileSync(
  join(process.cwd(), 'test-fixtures', 'brad-resume.txt'),
  'utf8'
)

test('FACTUAL_ANCHORING_DIRECTIVE forbids compliance skill fabrication', () => {
  assert.match(FACTUAL_ANCHORING_DIRECTIVE, /No Skill Fabrication/)
  assert.match(FACTUAL_ANCHORING_DIRECTIVE, /ISO 27001|SOC 2/)
  assert.match(FACTUAL_ANCHORING_DIRECTIVE, /Contextual Escalation Only/)
  assert.match(FACTUAL_ANCHORING_DIRECTIVE, /strict subset/)
})

test('SYSTEM_PROMPT includes factual anchoring directive', () => {
  assert.match(SYSTEM_PROMPT, /Factual Anchoring/)
})

test('sourcePermitsComplianceFrameworks requires SOC or ISO in source', () => {
  assert.equal(sourcePermitsComplianceFrameworks(bradFixture), false)
  assert.equal(sourcePermitsComplianceFrameworks('Led SOC 2 audit readiness'), true)
  assert.equal(sourcePermitsComplianceFrameworks('ISO 27001 controls mapping'), true)
})

test('isComplianceFrameworkSkill detects audit platform terms', () => {
  assert.equal(isComplianceFrameworkSkill('SOC 2'), true)
  assert.equal(isComplianceFrameworkSkill('ISO 27001'), true)
  assert.equal(isComplianceFrameworkSkill('Vanta deployment'), true)
  assert.equal(isComplianceFrameworkSkill('Agile'), false)
  assert.equal(isComplianceFrameworkSkill('Jira'), false)
})

test('enforceFactualSkills strips compliance frameworks absent from source', () => {
  const result = enforceFactualSkills(
    ['Agile', 'Jira', 'SOC 2', 'ISO 27001', 'Vanta', 'AWS'],
    bradFixture
  )

  assert.ok(result.some((skill) => /agile/i.test(skill)))
  assert.ok(result.some((skill) => /jira/i.test(skill)))
  assert.ok(result.some((skill) => /aws/i.test(skill)))
  assert.ok(!result.some((skill) => /soc|iso|vanta/i.test(skill)))
})

test('enforceFactualSkills retains compliance terms when source mentions them', () => {
  const source = `${bradFixture}\nSOC 2 audit coordination with security team`
  const result = enforceFactualSkills(['SOC 2 compliance'], source)

  assert.ok(result.some((skill) => /soc/i.test(skill)))
})

test('enforceFactualSkills allows universal JD methodology for PM titles', () => {
  const jd = 'Seeking stakeholder management and technical requirements expertise.'
  const result = enforceFactualSkills(
    ['Stakeholder Management', 'Technical Requirements', 'Vanta'],
    bradFixture,
    jd
  )

  assert.ok(result.some((skill) => /stakeholder management/i.test(skill)))
  assert.ok(result.some((skill) => /technical requirements/i.test(skill)))
  assert.ok(!result.some((skill) => /vanta/i.test(skill)))
})

test('enforceContextConstrainedTailoring strips fabricated compliance skills', () => {
  const draft: TailoredResume = {
    contact: {
      name: 'Brad Mulders',
      email: 'bradmulders@me.com',
      phone: '',
      location: '',
      linkedin: '',
    },
    summary: 'Delivery leader.',
    skills: ['Agile', 'SOC 2', 'Vanta', 'ISO 27001'],
    experience: [],
    projects: [],
    education: [],
    certifications: [],
  }

  const enforced = enforceContextConstrainedTailoring(draft, bradFixture)

  assert.ok(enforced.skills.some((skill) => /agile/i.test(skill)))
  assert.ok(!enforced.skills.some((skill) => /soc|vanta|iso/i.test(skill)))
})
