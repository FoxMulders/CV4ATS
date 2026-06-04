import assert from 'node:assert/strict'
import test from 'node:test'

import type { Experience, TailoredResume } from '@/lib/ai/schemas'
import {
  applyGenerationCompleteResume,
  extractWorkExperienceFromPayload,
  guardTailoredResumeExperience,
  hasSanityCheckedWorkExperience,
  shouldRejectWorkExperienceOverwrite,
} from '@/lib/resume/experience-preservation'

const existingExperience: Experience[] = [
  {
    title: 'Program Manager',
    company: 'Pleasant Solutions',
    location: 'Edmonton',
    startDate: '2018',
    endDate: '2022',
    bullets: ['Led cross-functional delivery.'],
  },
  {
    title: 'Technical Lead',
    company: 'Alberta Motor Association',
    location: 'Edmonton',
    startDate: '2014',
    endDate: '2018',
    bullets: ['Shipped member-facing tools.'],
  },
]

function makeResume(experience: Experience[], summary = 'Tailored summary.'): TailoredResume {
  return {
    contact: {
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '',
      location: 'Edmonton',
      linkedin: '',
    },
    summary,
    skills: ['Agile', 'Delivery'],
    experience,
    education: [],
    certifications: [],
    projects: [],
  }
}

test('hasSanityCheckedWorkExperience rejects empty arrays', () => {
  assert.equal(hasSanityCheckedWorkExperience([]), false)
  assert.equal(hasSanityCheckedWorkExperience(undefined), false)
})

test('extractWorkExperienceFromPayload reads workExperience and experience aliases', () => {
  assert.equal(
    extractWorkExperienceFromPayload({ workExperience: existingExperience })?.length,
    2
  )
  assert.equal(
    extractWorkExperienceFromPayload({ tailoredResume: { experience: existingExperience } })
      ?.length,
    2
  )
})

test('guardTailoredResumeExperience preserves existing timeline when AI returns empty experience', () => {
  const existing = makeResume(existingExperience)
  const incoming = makeResume([])

  const guarded = guardTailoredResumeExperience(incoming, existing, { warn: false })

  assert.equal(guarded.experience.length, 2)
  assert.equal(guarded.experience[0]?.company, 'Pleasant Solutions')
  assert.equal(guarded.summary, incoming.summary)
})

test('shouldRejectWorkExperienceOverwrite detects corrupt AI payloads', () => {
  const incoming = { workExperience: [] as Experience[] }

  assert.equal(shouldRejectWorkExperienceOverwrite(incoming, existingExperience), true)
  assert.equal(
    shouldRejectWorkExperienceOverwrite({ workExperience: existingExperience }, existingExperience),
    false
  )
})

test('applyGenerationCompleteResume is the stream-completion guard entry point', () => {
  const existing = makeResume(existingExperience)
  const incoming = makeResume([])

  const result = applyGenerationCompleteResume(incoming, existing, { warn: false })

  assert.equal(result.experience.length, 2)
})
