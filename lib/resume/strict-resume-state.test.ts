import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { buildUserPrompt } from '@/lib/ai/prompts'
import {
  buildLockedTimelinePromptBlock,
  lockResumeState,
  serializeLockedTimelineForPrompt,
} from '@/lib/resume/strict-resume-state'

const bradFixture = readFileSync(
  join(process.cwd(), 'test-fixtures', 'brad-resume.txt'),
  'utf8'
)

test('lockResumeState splits work experience and personal projects', () => {
  const state = lockResumeState(bradFixture)

  assert.equal(state.workExperience.length, 2)
  assert.ok(state.workExperience.some((block) => /Pleasant Solutions/i.test(block.company)))
  assert.ok(state.workExperience.some((block) => /Alberta Motor Association/i.test(block.company)))
  assert.ok(state.projects.length >= 2)
  assert.ok(state.education.length >= 1)
})

test('serializeLockedTimelineForPrompt includes isolated employer blocks', () => {
  const state = lockResumeState(bradFixture)
  const serialized = serializeLockedTimelineForPrompt(state)
  const parsed = JSON.parse(serialized) as {
    workExperience: Array<{ company: string }>
    projects: Array<{ productOrVenture: string }>
  }

  assert.equal(parsed.workExperience.length, 2)
  assert.ok(parsed.projects.length >= 2)
  assert.ok(parsed.workExperience.every((entry) => entry.company.trim()))
})

test('buildLockedTimelinePromptBlock forbids merging employers', () => {
  const block = buildLockedTimelinePromptBlock(bradFixture)

  assert.match(block, /LOCKED EXPERIENCE TIMELINE/i)
  assert.match(block, /Emit exactly 2 experience\[\] object\(s\)/)
  assert.match(block, /Do NOT merge, drop, reorder/i)
  assert.match(block, /Pleasant Solutions/)
  assert.match(block, /Alberta Motor Association/)
})

test('buildLockedTimelinePromptBlock falls back to raw text when structured parse finds no blocks', () => {
  const raw = [
    'Jane Doe',
    'jane@example.com',
    '',
    'Led delivery programs at Acme Corp for five years.',
    '• Built internal APIs supporting 200+ users',
    '• Coordinated cross-functional release planning',
  ].join('\n')

  const block = buildLockedTimelinePromptBlock(raw)

  assert.match(block, /structured pre-parse failed/i)
  assert.match(block, /RAW EXPERIENCE TEXT/i)
  assert.match(block, /Acme Corp/)
  assert.match(block, /Do NOT invent employers/i)
  assert.doesNotMatch(block, /Emit exactly 0 experience/)
})

test('buildUserPrompt includes locked timeline scaffold before source resume', () => {
  const prompt = buildUserPrompt('Project Manager role', bradFixture)

  const lockedIndex = prompt.indexOf('LOCKED EXPERIENCE TIMELINE')
  const sourceIndex = prompt.indexOf('SOURCE RESUME (ground truth')

  assert.ok(lockedIndex >= 0)
  assert.ok(sourceIndex > lockedIndex)
  assert.match(prompt, /Brad Mulders/)
  assert.match(prompt, /PopUpHub/)
})
