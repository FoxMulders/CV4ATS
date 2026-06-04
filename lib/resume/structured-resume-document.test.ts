import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  buildSanitizedTailoringContext,
  parseStructuredResumeDocument,
} from '@/lib/resume/structured-resume-document'

const bradFixture = readFileSync(
  join(process.cwd(), 'test-fixtures', 'brad-resume.txt'),
  'utf8'
)

test('buildSanitizedTailoringContext falls back to raw text when regex parse finds no blocks', () => {
  const document = parseStructuredResumeDocument(bradFixture)

  assert.equal(document.experience.length, 0)

  const context = buildSanitizedTailoringContext(document)

  assert.doesNotMatch(context, /No structured experience blocks detected/)
  assert.match(context, /Pleasant Solutions/)
  assert.match(context, /Alberta Motor Association/)
})
