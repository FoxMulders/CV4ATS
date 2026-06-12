import assert from 'node:assert/strict'
import test from 'node:test'

import {
  auditExactPhrasingMatch,
  buildJobDescriptionFourGramSet,
  buildPhrasingHighlightSpans,
  tokenizeContentWords,
} from '@/lib/resume/exact-phrasing-auditor'

test('buildJobDescriptionFourGramSet omits stop words from 4-word sequences', () => {
  const jobDescription =
    'Coordinate roadmap prioritization for enterprise data platforms and analytics programs.'
  const ngrams = buildJobDescriptionFourGramSet(jobDescription)

  assert.equal(ngrams.has('for enterprise data platforms'), false)
  assert.equal(ngrams.has('roadmap prioritization enterprise data'), true)
  assert.equal(ngrams.has('prioritization enterprise data platforms'), true)
})

test('auditExactPhrasingMatch finds 4-word and longer copied phrases via hash lookup', () => {
  const jobDescription =
    'Drive stakeholder alignment across matrixed teams while delivering platform modernization outcomes.'
  const resume =
    'Previously drove stakeholder alignment across matrixed teams while delivering measurable results.'

  const audit = auditExactPhrasingMatch(resume, jobDescription)

  assert.equal(audit.hasHighSimilarity, true)
  assert.ok(audit.matches.length >= 1)
  assert.ok(
    audit.matches.some(
      (match) =>
        match.wordCount >= 4 &&
        match.phrase.toLowerCase().includes('stakeholder alignment across matrixed')
    )
  )
})

test('auditExactPhrasingMatch ignores unrelated resume prose', () => {
  const jobDescription =
    'Own roadmap prioritization for enterprise data platforms and analytics programs.'
  const resume =
    'Managed delivery for internal tooling upgrades and cross-functional release planning.'

  const audit = auditExactPhrasingMatch(resume, jobDescription)

  assert.equal(audit.hasHighSimilarity, false)
  assert.deepEqual(audit.matches, [])
})

test('buildPhrasingHighlightSpans preserves unmatched text between flagged phrases', () => {
  const text = 'Alpha beta gamma delta and epsilon zeta eta theta.'
  const spans = buildPhrasingHighlightSpans(text, [
    {
      phrase: 'beta gamma delta',
      startIndex: 6,
      endIndex: 22,
      wordCount: 3,
    },
    {
      phrase: 'eta theta',
      startIndex: 40,
      endIndex: 49,
      wordCount: 2,
    },
  ])

  assert.deepEqual(spans, [
    { text: 'Alpha ', highlighted: false },
    { text: 'beta gamma delta', highlighted: true },
    { text: ' and epsilon zeta ', highlighted: false },
    { text: 'eta theta', highlighted: true },
    { text: '.', highlighted: false },
  ])
})

test('tokenizeContentWords filters stop words before n-gram generation', () => {
  const tokens = tokenizeContentWords('Coordinate design reviews with stakeholders and deliver outcomes.')
  assert.deepEqual(
    tokens.map((token) => token.normalized),
    ['coordinate', 'design', 'reviews', 'stakeholders', 'deliver', 'outcomes']
  )
})
