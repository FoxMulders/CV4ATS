import assert from 'node:assert/strict'
import test from 'node:test'

import {
  keywordMatchesResume,
  matchesWordBoundaryProfile,
  normalizeMatchingText,
} from '@/lib/resume/keyword-matcher'

test('normalizeMatchingText lowercases and removes punctuation', () => {
  assert.equal(normalizeMatchingText('AWS & Azure Cloud Services'), 'aws azure cloud services')
})

test('matchesWordBoundaryProfile finds tokens inside compound skill strings', () => {
  const haystack = normalizeMatchingText('AWS & Azure Cloud Services')
  assert.equal(matchesWordBoundaryProfile(haystack, 'cloud'), true)
  assert.equal(matchesWordBoundaryProfile(haystack, 'aws'), true)
  assert.equal(matchesWordBoundaryProfile(haystack, 'azure'), true)
  assert.equal(matchesWordBoundaryProfile(haystack, 'clou'), false)
})

test('keywordMatchesResume awards compound phrasing matches without strict equality', () => {
  assert.equal(keywordMatchesResume('AWS & Azure Cloud Services', 'cloud'), true)
  assert.equal(keywordMatchesResume('Program manager focused on delivery', 'argo'), false)
})
