import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeSkillArray } from '@/lib/resume/skill-array-normalize'

test('normalizeSkillArray splits ampersand compounds into atomic skills', () => {
  assert.deepEqual(normalizeSkillArray(['AWS & Azure Cloud Platforms']), [
    'AWS',
    'Azure',
    'Cloud Platforms',
  ])
})

test('normalizeSkillArray splits comma and "and" delimiters', () => {
  assert.deepEqual(normalizeSkillArray(['Agile, Scrum and Kanban']), [
    'Agile',
    'Scrum',
    'Kanban',
  ])
})

test('normalizeSkillArray preserves certified multi-word phrases', () => {
  assert.deepEqual(normalizeSkillArray(['Google Cloud Platform']), ['Google Cloud Platform'])
  assert.deepEqual(normalizeSkillArray(['custom automation platforms']), [
    'custom automation platforms',
  ])
})

test('normalizeSkillArray strips redundant filler suffixes from tool names', () => {
  assert.deepEqual(normalizeSkillArray(['Jira Platforms', 'AWS Platforms']), ['Jira', 'AWS'])
})

test('normalizeSkillArray deduplicates case-insensitively', () => {
  assert.deepEqual(normalizeSkillArray(['aws', 'AWS', 'Agile & agile']), ['aws', 'Agile'])
})

test('normalizeSkillArray leaves already-atomic arrays unchanged', () => {
  const input = ['Program Management', 'Jira', 'DevOps']
  assert.deepEqual(normalizeSkillArray(input), input)
})
