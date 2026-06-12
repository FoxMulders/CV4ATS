import assert from 'node:assert/strict'
import test from 'node:test'

import type { TailoredResume } from '@/lib/ai/schemas'
import { countModifiedResumeBullets } from '@/lib/resume/count-modified-bullets'

function sampleResume(bullets: string[]): TailoredResume {
  return {
    contact: { name: 'Jane Doe', email: '', phone: '', location: '', linkedin: '' },
    summary: 'Program leader with delivery experience.',
    skills: ['Agile', 'Stakeholder management'],
    experience: [
      {
        title: 'Program Manager',
        company: 'Acme Corp',
        location: 'Edmonton, AB',
        startDate: '2020',
        endDate: 'Present',
        bullets,
      },
    ],
    education: [],
    certifications: [],
    projects: [],
  }
}

test('countModifiedResumeBullets returns 0 when bullets are unchanged', () => {
  const resume = sampleResume(['Led cross-functional delivery for a $2M initiative.'])
  assert.equal(countModifiedResumeBullets(resume, resume), 0)
})

test('countModifiedResumeBullets counts rewritten bullets in matching blocks', () => {
  const original = sampleResume([
    'Managed stakeholder updates for quarterly releases.',
    'Coordinated vendor onboarding across three teams.',
  ])
  const tailored = sampleResume([
    'Led stakeholder communications for quarterly releases, improving alignment by 20%.',
    'Coordinated vendor onboarding across three teams.',
  ])

  assert.equal(countModifiedResumeBullets(original, tailored), 1)
})

test('countModifiedResumeBullets ignores whitespace-only differences', () => {
  const original = sampleResume(['Delivered measurable outcomes in this role.'])
  const tailored = sampleResume(['  Delivered measurable outcomes in this role.  '])

  assert.equal(countModifiedResumeBullets(original, tailored), 0)
})
