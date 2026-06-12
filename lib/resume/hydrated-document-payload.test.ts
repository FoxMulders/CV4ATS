import assert from 'node:assert/strict'
import test from 'node:test'

import { tailoredResumeSchema, type TailoredResume } from '@/lib/ai/schemas'
import {
  buildResumeDocumentState,
  getHydratedDocumentPayload,
  getHydratedDocumentPayloadFromSlice,
} from '@/lib/resume/hydrated-document-payload'
import {
  applyRevisionsToStateSlice,
  tailoredResumeToStateSlice,
} from '@/lib/resume/resume-state-slice'

const baseResume: TailoredResume = {
  contact: {
    name: 'Alex Candidate',
    email: 'alex@example.com',
    phone: '555-0100',
    location: 'Edmonton, AB',
    linkedin: '',
  },
  summary: 'Delivery leader with enterprise program experience.',
  skills: ['Agile', 'Jira', 'Program Management'],
  experience: [
    {
      title: 'IT Manager',
      company: 'Example Corp',
      location: 'Edmonton, AB',
      startDate: '01/2018',
      endDate: 'Present',
      bullets: [
        'Led cross-functional delivery teams through SDLC modernization initiatives.',
        'Automated deployment workflows reducing release cycle time by 40%.',
      ],
    },
  ],
  projects: [],
  education: [
    {
      degree: 'Bachelor of Commerce',
      school: 'Example University',
      graduationDate: '2008',
      details: '',
    },
  ],
  certifications: [],
}

test('getHydratedDocumentPayload uses modified summary variant when active', () => {
  const current: TailoredResume = {
    ...baseResume,
    summary: 'Cloud-focused delivery leader with AWS and Azure program ownership.',
  }

  const state = buildResumeDocumentState({ current, baseline: baseResume })
  const summaryBlock = state.blocks.find((block) => block.id === 'summary')
  assert.equal(summaryBlock?.kind, 'text')
  if (summaryBlock?.kind !== 'text') return

  assert.equal(summaryBlock.activeVariant, 'modified')

  const hydrated = getHydratedDocumentPayload({ current, baseline: baseResume })
  assert.match(hydrated.summary, /Cloud-focused delivery leader/)
  assert.doesNotMatch(hydrated.summary, /enterprise program experience/)
})

test('getHydratedDocumentPayload splits compound skills without schema failure', () => {
  const current: TailoredResume = {
    ...baseResume,
    skills: [...baseResume.skills, 'AWS & Azure Cloud Platforms'],
  }

  const hydrated = getHydratedDocumentPayload({ current, baseline: baseResume })

  assert.ok(hydrated.skills.includes('AWS'))
  assert.ok(hydrated.skills.includes('Azure'))
  assert.ok(hydrated.skills.includes('Cloud Platforms'))
  assert.equal(hydrated.skills.includes('AWS & Azure Cloud Platforms'), false)

  const parsed = tailoredResumeSchema.safeParse(hydrated)
  assert.equal(parsed.success, true, parsed.success ? '' : JSON.stringify(parsed.error.issues))
})

test('getHydratedDocumentPayload prefers modified experience bullets', () => {
  const current: TailoredResume = {
    ...baseResume,
    experience: [
      {
        ...baseResume.experience[0]!,
        bullets: [
          'Led cloud migration programs across AWS and Azure with measurable release gains.',
          baseResume.experience[0]!.bullets[1]!,
        ],
      },
    ],
  }

  const hydrated = getHydratedDocumentPayload({ current, baseline: baseResume })
  assert.match(hydrated.experience[0]!.bullets[0]!, /AWS and Azure/)
  assert.match(hydrated.experience[0]!.bullets[1]!, /deployment workflows reducing release cycle time/)
})

test('getHydratedDocumentPayload preserves ampersand characters inside bullet prose', () => {
  const current: TailoredResume = {
    ...baseResume,
    experience: [
      {
        ...baseResume.experience[0]!,
        bullets: ['Partnered with R&D & Operations to stabilize release cadence.'],
      },
    ],
  }

  const hydrated = getHydratedDocumentPayload({ current, baseline: baseResume })
  assert.match(hydrated.experience[0]!.bullets[0]!, /R&D & Operations/)
})

test('getHydratedDocumentPayloadFromSlice compiles skills-section revisions atomically', () => {
  const baselineSlice = tailoredResumeToStateSlice(baseResume)
  const revisedSlice = applyRevisionsToStateSlice(baselineSlice, [
    {
      snippet: 'AWS & Azure Cloud Platforms',
      modificationType: 'skills-section',
    },
  ])

  const hydrated = getHydratedDocumentPayloadFromSlice(revisedSlice, baselineSlice)

  assert.ok(hydrated.skills.includes('AWS'))
  assert.ok(hydrated.skills.includes('Azure'))
  assert.ok(hydrated.skills.includes('Cloud Platforms'))
  assert.equal(tailoredResumeSchema.safeParse(hydrated).success, true)
})
