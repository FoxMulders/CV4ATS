import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  resolveCanonicalSectionKey,
  splitResumeDocumentBySections,
} from '@/lib/resume/defensive-markdown-parser'
import { applyLockedContactToResume, resolveLockedContactFromSource } from '@/lib/resume/identity-lock'
import { verifyExperienceMatrixIntegrity } from '@/lib/resume/experience-matrix-guard'
import type { Experience } from '@/lib/ai/schemas'

describe('defensive markdown parser', () => {
  test('resolveCanonicalSectionKey accepts full Professional Summary label', () => {
    assert.equal(resolveCanonicalSectionKey('#### PROFESSIONAL SUMMARY'), 'summary')
    assert.equal(resolveCanonicalSectionKey('Professional Summary'), 'summary')
  })

  test('resolveCanonicalSectionKey rejects truncated stream artifacts', () => {
    assert.equal(resolveCanonicalSectionKey('fessional Summary'), null)
    assert.equal(resolveCanonicalSectionKey('FESSIONAL'), null)
    assert.equal(resolveCanonicalSectionKey('KILLS'), null)
  })

  test('splitResumeDocumentBySections preserves section bodies without substring loss', () => {
    const text = [
      '#### PROFESSIONAL SUMMARY',
      'Leader with delivery focus.',
      '#### SKILLS',
      'TypeScript • Azure',
      '#### WORK EXPERIENCE',
      '### Director — Pleasant Solutions',
      '2018 – 2023',
      '• Led platform delivery.',
    ].join('\n')

    const sections = splitResumeDocumentBySections(text)
    assert.match(sections.summary ?? '', /Leader with delivery/)
    assert.match(sections.skills ?? '', /TypeScript/)
    assert.match(sections.workExperience ?? '', /Pleasant Solutions/)
  })
})

describe('identity lock', () => {
  test('applyLockedContactToResume restores name from source when stream sends section heading', () => {
    const source = ['Brad Mulders', 'brad@example.com', '#### PROFESSIONAL SUMMARY', 'Leader text'].join(
      '\n'
    )
    const locked = resolveLockedContactFromSource(source)
    const polluted = applyLockedContactToResume(
      {
        contact: {
          name: 'Professional Summary',
          email: '',
          phone: '',
          location: '',
          linkedin: '',
        },
        summary: 'Leader text',
        skills: [],
        experience: [],
        education: [],
        certifications: [],
      },
      locked,
      source
    )

    assert.equal(polluted.contact.name, 'Brad Mulders')
  })
})

describe('experience matrix guard', () => {
  test('verifyExperienceMatrixIntegrity restores dropped employers', () => {
    const baseline: Experience[] = [
      {
        company: 'Pleasant Solutions',
        title: 'Director',
        location: '',
        startDate: '2018',
        endDate: '2023',
        bullets: ['Led delivery.'],
      },
      {
        company: 'Alberta Motor Association',
        title: 'Manager',
        location: '',
        startDate: '2014',
        endDate: '2018',
        bullets: ['Managed ops.'],
      },
    ]

    const candidate: Experience[] = [
      {
        company: 'Pleasant Solutions',
        title: 'Director',
        location: '',
        startDate: '2018',
        endDate: '2023',
        bullets: ['Led delivery with expanded scope.'],
      },
    ]

    const verified = verifyExperienceMatrixIntegrity(baseline, [], candidate, [])
    assert.equal(verified.experience.length, 2)
    assert.equal(verified.droppedEmployers.length, 0)
    assert.match(
      verified.experience.map((entry) => entry.company).join('|'),
      /Pleasant Solutions|Alberta Motor Association/
    )
  })
})
