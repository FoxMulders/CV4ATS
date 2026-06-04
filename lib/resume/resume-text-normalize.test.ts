import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import { describeResumePayloadStats } from '@/lib/debug/resume-payload-stats'
import { parseExperienceFromLines } from '@/lib/resume/parse-experience-blocks'
import { serializeTailoredResume } from '@/lib/resume/ats-score'
import { parseResumeTextToTailoredResume } from '@/lib/resume/text-to-structured'
import {
  isResumeBulletLine,
  splitResumeLines,
  stripResumeBulletPrefix,
  stripResumeHeadingMarkers,
} from '@/lib/resume/resume-text-normalize'

const experienceFixture = [
  'PROFESSIONAL EXPERIENCE',
  'Acme Corp',
  'Software Engineer',
  '2020 - Present',
  '• Led cross-functional release planning for enterprise clients.',
  '⁃ Built C# automation tools and SQL reporting pipelines.',
  '- Managed release cycles and AWS deployments.',
  '* Established release governance across GitHub PR tracking.',
].join('\r\n')

test('splitResumeLines handles CRLF and lone CR', () => {
  assert.deepEqual(splitResumeLines('a\r\nb\nc\rd'), ['a', 'b', 'c', 'd'])
})

test('isResumeBulletLine detects standard and unicode bullet markers', () => {
  assert.equal(isResumeBulletLine('• Led release planning.'), true)
  assert.equal(isResumeBulletLine('- Built automation tools.'), true)
  assert.equal(isResumeBulletLine('* Managed deployments.'), true)
  assert.equal(isResumeBulletLine('⁃ Coordinated stakeholder reviews.'), true)
  assert.equal(isResumeBulletLine('‣ Drove product roadmap.'), true)
  assert.equal(isResumeBulletLine('◦ Established governance.'), true)
  assert.equal(isResumeBulletLine('Acme Corp'), false)
})

test('stripResumeBulletPrefix removes marker and surrounding whitespace', () => {
  assert.equal(
    stripResumeBulletPrefix('  ⁃  Built C# automation tools.'),
    'Built C# automation tools.'
  )
})

test('parseExperienceFromLines detects blocks from CRLF resume with mixed bullets', () => {
  const lines = splitResumeLines(experienceFixture)
  const experience = parseExperienceFromLines(lines)
  assert.ok(experience.length >= 1)
  assert.ok(experience[0]!.bullets.length >= 3)
})

test('describeResumePayloadStats reports bullets for CRLF mixed-marker text', () => {
  const stats = describeResumePayloadStats(experienceFixture)
  assert.match(stats, /Parsed 1 Work Experience block/)
  assert.match(stats, /[3-4] initial bullets detected/)
})

test('parseExperienceFromLines parses markdown serialized resume after SKILLS section', () => {
  const bradFixture = readFileSync(join(process.cwd(), 'test-fixtures', 'brad-resume.txt'), 'utf8')
  const serialized = serializeTailoredResume(parseResumeTextToTailoredResume(bradFixture))
  const lines = splitResumeLines(serialized)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(stripResumeHeadingMarkers)

  const experience = parseExperienceFromLines(lines)
  assert.ok(experience.length >= 2, 'expected distinct employers from markdown output')
  assert.ok(
    experience.every((entry) => entry.bullets.length > 0),
    'expected bullets preserved for each employer'
  )

  const stats = describeResumePayloadStats(serialized)
  assert.match(stats, /Parsed 2 Work Experience block/)
})
