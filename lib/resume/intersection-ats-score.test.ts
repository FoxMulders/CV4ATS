import assert from 'node:assert/strict'
import test from 'node:test'

import type { TailoredResume } from '@/lib/ai/schemas'
import {
  applySkillModificationsToTailoredResume,
  selectionsToAnchoredModifications,
} from '@/lib/resume/apply-skill-modifications'
import {
  buildSkillIntersectionMatrix,
  buildTailoredResumeCorpus,
  buildTailoredResumeScoringFingerprint,
  computeIntersectionMatchScore,
  extractTailoredResumeScoringContent,
} from '@/lib/resume/intersection-ats-score'

const sampleResume: TailoredResume = {
  contact: {
    name: 'Alex Example',
    email: 'alex@example.com',
    phone: '555-0100',
    location: 'Remote',
    linkedin: '',
  },
  summary: 'Program manager focused on delivery governance.',
  skills: ['Stakeholder management', 'Reporting'],
  experience: [
    {
      title: 'Program Manager',
      company: 'Acme Corp',
      location: 'Remote',
      startDate: '2020',
      endDate: 'Present',
      bullets: ['Led cross-functional release planning for enterprise clients.'],
    },
  ],
  projects: [],
  education: [],
  certifications: [],
}

test('buildTailoredResumeCorpus combines summary, skills, and experience bullets', () => {
  const corpus = buildTailoredResumeCorpus(sampleResume)
  assert.match(corpus.combined, /Program manager/)
  assert.match(corpus.combined, /Stakeholder management/)
  assert.match(corpus.combined, /release planning/)
})

test('buildTailoredResumeScoringFingerprint tracks summary, skills, and bullets only', () => {
  const baselineFingerprint = buildTailoredResumeScoringFingerprint(sampleResume)
  const metadataOnlyChange = buildTailoredResumeScoringFingerprint({
    ...sampleResume,
    contact: { ...sampleResume.contact, name: 'Different Name' },
    experience: [
      {
        ...sampleResume.experience[0]!,
        title: 'Director',
        company: 'Other Co',
      },
    ],
  })

  assert.equal(baselineFingerprint, metadataOnlyChange)
  assert.notEqual(
    baselineFingerprint,
    buildTailoredResumeScoringFingerprint({
      ...sampleResume,
      summary: 'Updated summary focused on delivery governance.',
    })
  )
  assert.deepEqual(extractTailoredResumeScoringContent(sampleResume).skills, [
    'Stakeholder management',
    'Reporting',
  ])
})

test('computeIntersectionMatchScore uses matched target skills over total target skills', () => {
  const report = computeIntersectionMatchScore({
    resume: sampleResume,
    targetSkills: ['agile', 'jira', 'stakeholder management'],
  })

  assert.equal(report.matchScore, 33)
  assert.deepEqual(report.matchedKeywords, ['stakeholder management'])
  assert.deepEqual(report.missingKeywords, ['agile', 'jira'])
})

test('computeIntersectionMatchScore matches target skills inside compound skill phrasing', () => {
  const resume: TailoredResume = {
    ...sampleResume,
    skills: ['AWS & Azure Cloud Services', 'Reporting'],
  }

  const report = computeIntersectionMatchScore({
    resume,
    targetSkills: ['cloud', 'aws', 'azure', 'agile'],
  })

  assert.equal(report.matchScore, 75)
  assert.deepEqual(report.matchedKeywords, ['aws', 'azure', 'cloud'])
  assert.deepEqual(report.missingKeywords, ['agile'])
})

test('buildSkillIntersectionMatrix reflects added skills after structured resume edits', () => {
  const updated = applySkillModificationsToTailoredResume(
    sampleResume,
    selectionsToAnchoredModifications([
      {
        keyword: 'Jira',
        snippet: 'Jira',
        modificationType: 'skills-section',
      },
      {
        keyword: 'Agile',
        snippet:
          'Led cross-functional release planning for enterprise clients using Agile delivery practices.',
        originalBullet: 'Led cross-functional release planning for enterprise clients.',
        modificationType: 'inline-bullet',
        bulletIndex: 0,
      },
    ]),
    { keywordsBySnippet: { Jira: 'Jira' } }
  )

  const matrix = buildSkillIntersectionMatrix(updated, ['agile', 'jira', 'stakeholder management'])

  assert.equal(matrix.matchScore, 100)
  assert.equal(matrix.matchedCount, 3)
})
