import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  parseResumeDeterministic,
  parseResumeTextToTailoredResume,
} from '@/lib/resume/deterministic-resume-parser'
import { deflateNestedWorkExperience, explodeFlattenedExperienceEntries, parseWorkAndProjectsFromLines, splitNestedEmployersInSingleEntry } from '@/lib/resume/parse-experience-blocks'
import { parseRoleBoundaryLine } from '@/lib/resume/role-boundary-parser'
import type { Experience } from '@/lib/ai/schemas'

const bradFixture = readFileSync(
  join(process.cwd(), 'test-fixtures', 'brad-resume.txt'),
  'utf8'
)

const multiEmployerFixture = `BRAD MULDERS
bradmulders@me.com

PROFESSIONAL SUMMARY
Program leader across enterprise and consulting engagements.

PROFESSIONAL EXPERIENCE
Microserve Business Systems
Senior Consultant
2010 - 2013
• Delivered ERP integrations for municipal clients.

Alberta Motor Association
Systems Developer
2013 - 2024
• Built C# automation tools.

PERSONAL AI PROJECTS
PopUpHub
Personal AI Project
2025 - Present
• Event coordination hub.

EDUCATION
Bachelor of Science, University of Alberta, 2005`

const nestedInBulletsFixture = `PROFESSIONAL SUMMARY
Leader with multi-employer history.

PROFESSIONAL EXPERIENCE
Pleasant Solutions
Technical Project Manager
02/2024 - Present
• Led release planning.
Alberta Motor Association
Systems Developer
2013 - 2024
• Built C# automation tools.

EDUCATION
Bachelor of Science, University of Alberta`

test('parseResumeDeterministic keeps each employer as a separate work_experience entry', () => {
  const parsed = parseResumeDeterministic(bradFixture)

  const companies = parsed.work_experience.map((entry) => entry.company)
  assert.ok(companies.some((name) => /Pleasant Solutions/i.test(name)))
  assert.ok(companies.some((name) => /Alberta Motor Association/i.test(name)))
  assert.equal(parsed.work_experience.length, 2)
})

test('parseResumeDeterministic never merges Microserve and AMA into one role', () => {
  const parsed = parseResumeDeterministic(multiEmployerFixture)

  assert.equal(parsed.work_experience.length, 2)
  assert.match(parsed.work_experience[0]!.company, /Microserve/i)
  assert.match(parsed.work_experience[1]!.company, /Alberta Motor Association/i)
  assert.doesNotMatch(parsed.work_experience[0]!.bullets.join(' '), /Alberta Motor Association/i)
})

test('parseResumeDeterministic isolates personal projects from work experience', () => {
  const parsed = parseResumeDeterministic(bradFixture)

  assert.ok(parsed.projects.length >= 2)
  assert.ok(parsed.projects.some((project) => /PopUpHub/i.test(project.title)))
  assert.ok(parsed.projects.some((project) => /Tipsy Fox/i.test(project.title)))
  assert.ok(
    parsed.work_experience.every(
      (entry) => !/PopUpHub|Tipsy Fox/i.test(entry.company) && !/PopUpHub|Tipsy Fox/i.test(entry.job_title)
    )
  )
})

test('parseResumeDeterministic retains education section', () => {
  const parsed = parseResumeDeterministic(bradFixture)

  assert.ok(parsed.education.length >= 1)
  assert.match(parsed.education[0]!.degree, /Bachelor of Science/i)
  assert.match(parsed.education[0]!.institution, /University of Alberta/i)
})

test('parseResumeDeterministic returns expected schema fields', () => {
  const parsed = parseResumeDeterministic(bradFixture)

  assert.ok(parsed.professional_summary.length > 0)
  assert.ok(Array.isArray(parsed.skills))
  assert.ok(Array.isArray(parsed.work_experience))
  assert.ok(Array.isArray(parsed.projects))
  assert.ok(Array.isArray(parsed.education))
  for (const entry of parsed.work_experience) {
    assert.ok(entry.job_title)
    assert.ok(entry.company)
    assert.ok(entry.bullets.length > 0)
  }
})

test('splitNestedEmployersInSingleEntry splits nested company blocks inside bullets', () => {
  const merged: Experience = {
    title: 'Technical Project Manager',
    company: 'Pleasant Solutions',
    location: '',
    startDate: '02/2024',
    endDate: 'Present',
    bullets: [
      'Led release planning.',
      'Alberta Motor Association',
      'Systems Developer',
      '2013 - 2024',
      'Built C# automation tools.',
    ],
  }

  const split = splitNestedEmployersInSingleEntry(merged)
  assert.equal(split.length, 2)
  assert.match(split[1]!.company, /Alberta Motor Association/i)
  assert.match(split[1]!.bullets.join(' '), /C# automation/i)
})

test('deflateNestedWorkExperience applies nested split across experience array', () => {
  const merged: Experience = {
    title: 'Technical Project Manager',
    company: 'Pleasant Solutions',
    location: '',
    startDate: '02/2024',
    endDate: 'Present',
    bullets: [
      'Led release planning.',
      'Alberta Motor Association',
      'Systems Developer',
      '2013 - 2024',
      'Built C# automation tools.',
    ],
  }

  const { experience } = deflateNestedWorkExperience({ experience: [merged], projects: [] })
  assert.equal(experience.length, 2)
})

test('parseResumeDeterministic recovers nested timelines from flattened bullets', () => {
  const parsed = parseResumeDeterministic(nestedInBulletsFixture)
  assert.equal(parsed.work_experience.length, 2)
  assert.match(parsed.work_experience[1]!.company, /Alberta Motor Association/i)
})

test('parseResumeTextToTailoredResume delegates to deterministic engine', () => {
  const tailored = parseResumeTextToTailoredResume(bradFixture)
  assert.equal(tailored.contact.name, 'Brad Mulders')
  assert.equal(tailored.experience.length, 2)
  assert.ok(tailored.projects.length >= 2)
  assert.ok(tailored.education.length >= 1)
})

const markdownFlattenedFixture = `PROFESSIONAL SUMMARY
Program leader.

WORK EXPERIENCE
Consultant — Independent
• ### Technical Project Manager — Pleasant Solutions
• 02/2024 - Present
• Led release planning for enterprise clients.
• ### Systems Developer — Alberta Motor Association
• 2013 - 2024
• Built C# automation tools.

EDUCATION
Bachelor of Science, University of Alberta`

test('explodeFlattenedExperienceEntries splits markdown role headers hijacked as bullets', () => {
  const { experience } = parseWorkAndProjectsFromLines(
    markdownFlattenedFixture.replace(/\r\n/g, '\n').split('\n')
  )
  const exploded = explodeFlattenedExperienceEntries(experience)
  assert.equal(exploded.length, 2)
  assert.match(exploded[0]!.company, /Pleasant Solutions/i)
  assert.match(exploded[1]!.company, /Alberta Motor Association/i)
  assert.doesNotMatch(exploded[0]!.bullets.join(' '), /Alberta Motor Association/i)
  assert.ok(
    exploded.every(
      (entry) => !/Consultant — Independent/i.test(`${entry.title} — ${entry.company}`)
    )
  )
})

test('parseRoleBoundaryLine detects title company location pipe format', () => {
  const parsed = parseRoleBoundaryLine('IT Manager — Alberta Motor Association | Edmonton, AB')
  assert.ok(parsed)
  assert.match(parsed!.company, /Alberta Motor Association/i)
  assert.equal(parsed!.location, 'Edmonton, AB')
})
