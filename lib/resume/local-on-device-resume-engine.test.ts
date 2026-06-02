import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import type { TailoredResume } from '@/lib/ai/schemas'
import {
  LOCAL_RESUME_SECTION,
  serializeTailoredResumeMarkdown,
  splitMarkdownResumeSections,
} from '@/lib/resume/local-on-device-resume-engine'
import { isPersonalProjectEntry } from '@/lib/resume/personal-project-detection'
import { parseScoringSections } from '@/lib/resume/weighted-ats-scoring'

const sampleResume: TailoredResume = {
  contact: {
    name: 'Brad Example',
    email: 'brad@example.com',
    phone: '555-0100',
    location: 'Edmonton, AB',
    linkedin: '',
  },
  summary: 'Senior IT leader with delivery and architecture experience.',
  skills: ['TypeScript', 'Next.js', 'Azure'],
  experience: [
    {
      company: 'Pleasant Solutions',
      title: 'Director of IT',
      startDate: '2018',
      endDate: '2023',
      location: 'Edmonton, AB',
      bullets: ['Led enterprise platform delivery across multiple teams.'],
    },
    {
      company: 'Alberta Motor Association',
      title: 'IT Manager',
      startDate: '2014',
      endDate: '2018',
      location: 'Edmonton, AB',
      bullets: ['Managed infrastructure and service desk operations.'],
    },
    {
      company: 'Microserve',
      title: 'Systems Administrator',
      startDate: '2010',
      endDate: '2014',
      location: 'Edmonton, AB',
      bullets: ['Supported Windows server and network environments.'],
    },
  ],
  projects: [
    {
      company: 'cv2ats.ca',
      title: 'Personal AI Project',
      startDate: '2024',
      endDate: 'Present',
      location: '',
      bullets: ['Built on-device resume parsing and ATS optimization pipeline.'],
    },
    {
      company: 'popuphub.ca',
      title: 'Personal AI Project',
      startDate: '2023',
      endDate: 'Present',
      location: '',
      bullets: ['Event discovery platform with Next.js and geospatial search.'],
    },
  ],
  education: [{ degree: 'Bachelor of Science', school: 'Example University', graduationDate: '2009', details: '' }],
  certifications: [],
}

describe('local on-device resume engine', () => {
  test('serializeTailoredResumeMarkdown uses #### section headers', () => {
    const markdown = serializeTailoredResumeMarkdown(sampleResume)
    assert.match(markdown, /^#### PROFESSIONAL SUMMARY$/m)
    assert.match(markdown, /^#### SKILLS$/m)
    assert.match(markdown, /^#### WORK EXPERIENCE$/m)
    assert.match(markdown, /^#### PERSONAL AI PROJECT EXPERIENCE$/m)
    assert.match(markdown, /^#### EDUCATION$/m)
    assert.match(markdown, /Pleasant Solutions/)
    assert.match(markdown, /Alberta Motor Association/)
    assert.match(markdown, /Microserve/)
    assert.doesNotMatch(markdown, /Independent Consultant/i)
  })

  test('splitMarkdownResumeSections maps section bodies for UI regex', () => {
    const markdown = serializeTailoredResumeMarkdown(sampleResume)
    const sections = splitMarkdownResumeSections(markdown)
    assert.match(sections.summary ?? '', /Senior IT leader/)
    assert.match(sections.skills ?? '', /TypeScript/)
    assert.match(sections.workExperience ?? '', /Pleasant Solutions/)
    assert.match(sections.workExperience ?? '', /Microserve/)
    assert.match(sections.personalProjects ?? '', /cv2ats\.ca/)
    assert.match(sections.personalProjects ?? '', /popuphub\.ca/)
    assert.match(sections.education ?? '', /Example University/)
  })

  test('parseScoringSections reads #### markdown headers', () => {
    const markdown = serializeTailoredResumeMarkdown(sampleResume)
    const scoring = parseScoringSections(markdown)
    assert.match(scoring.summary, /Senior IT leader/)
    assert.match(scoring.experience, /Pleasant Solutions/)
  })

  test('personal project detection includes all whitelisted products', () => {
    for (const company of ['cv2ats.ca', 'popuphub.ca', 'whobringswhat.ca', 'Tipsy Fox Escapes']) {
      assert.equal(
        isPersonalProjectEntry({ company, title: 'Founder / Developer' }),
        true,
        `expected personal project for ${company}`
      )
    }
  })

  test('LOCAL_RESUME_SECTION.personalProjects uses EXPERIENCE suffix', () => {
    assert.equal(LOCAL_RESUME_SECTION.personalProjects, 'PERSONAL AI PROJECT EXPERIENCE')
  })
})
