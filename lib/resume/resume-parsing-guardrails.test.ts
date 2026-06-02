import assert from 'node:assert/strict'
import test from 'node:test'

import {
  isResumeStructuralHeading,
  sanitizeCandidateName,
} from '@/lib/resume/contact-identity'
import { parseWorkAndProjectsFromLines } from '@/lib/resume/parse-experience-blocks'
import { parseResumeTextToTailoredResume } from '@/lib/resume/text-to-structured'
import {
  normalizeResumeDocumentText,
  stripResumeHeadingMarkers,
} from '@/lib/resume/resume-text-normalize'

const bradFixture = `BRAD MULDERS
bradmulders@me.com | (780) 920-0664 | Edmonton, Canada

PROFESSIONAL SUMMARY
Technical program leader with 30 years coordinating releases.

PROFESSIONAL EXPERIENCE
Pleasant Solutions
Technical Project Manager
02/2024 - Present
• Led cross-functional release planning.

Alberta Motor Association
Systems Developer
2013 - 2024
• Built C# automation tools.

PERSONAL AI PROJECTS
PopUpHub
Personal AI Project
2025 - Present
• Developed popup event coordination hub.

EDUCATION
Bachelor of Science, University of Alberta`

test('stripResumeHeadingMarkers preserves section title text', () => {
  assert.equal(stripResumeHeadingMarkers('# Professional Summary'), 'Professional Summary')
  assert.equal(stripResumeHeadingMarkers('## PROFESSIONAL SUMMARY'), 'PROFESSIONAL SUMMARY')
})

test('normalizeResumeDocumentText preserves line breaks', () => {
  const normalized = normalizeResumeDocumentText('BRAD MULDERS\n\n# Professional Summary\nLeader text')
  assert.match(normalized, /\n/)
  assert.match(normalized, /Professional Summary/)
})

test('sanitizeCandidateName rejects section headings as identity', () => {
  assert.equal(sanitizeCandidateName('Professional Summary'), 'Professional Candidate')
  assert.equal(sanitizeCandidateName('PROFESSIONAL SUMMARY'), 'Professional Candidate')
  assert.equal(sanitizeCandidateName('Brad Mulders'), 'Brad Mulders')
})

test('isResumeStructuralHeading detects template labels', () => {
  assert.equal(isResumeStructuralHeading('Personal AI Project Experience'), true)
  assert.equal(isResumeStructuralHeading('Brad Mulders'), false)
})

test('parseWorkAndProjectsFromLines isolates personal projects', () => {
  const lines = bradFixture.replace(/\r\n/g, '\n').split('\n')
  const { experience, projects } = parseWorkAndProjectsFromLines(lines)
  assert.ok(experience.length >= 1)
  assert.ok(projects.length >= 1)
  assert.match(projects[0]!.company, /PopUpHub/i)
})

test('parseResumeTextToTailoredResume keeps name isolated from summary heading', () => {
  const parsed = parseResumeTextToTailoredResume(bradFixture)
  assert.equal(parsed.contact.name, 'Brad Mulders')
  assert.doesNotMatch(parsed.contact.name, /professional summary/i)
  assert.ok(parsed.experience.length >= 1)
  assert.ok(parsed.projects.length >= 1)
})
