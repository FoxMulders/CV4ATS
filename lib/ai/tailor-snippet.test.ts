import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ATS_KEYWORD_INJECTION_DIRECTIVE,
  buildAtsKeywordInjectionSystemPrompt,
  enforceTailorSnippetOutput,
  extractInjectedKeywordsFromText,
  parseTailorSnippetModelOutput,
  tailorSnippetOutputFromPlainText,
} from '@/lib/ai/ats-keyword-injection-directive'
import { stripTailoringResponse } from '@/lib/ai/tailor-snippet'
import {
  buildActiveSectionTailoringContext,
  parseStructuredResumeDocument,
} from '@/lib/resume/structured-resume-document'
import { resumeSemanticallyMatchesSkill } from '@/lib/resume/semantic-keyword-match'

const sampleResume = `Brad Mulders
bradmulders@me.com | Edmonton, AB

Professional Summary
Delivery leader with 20+ years bridging product vision and execution across enterprise IT programs.

Skills
Agile | Kanban | Jira | Program Management

Work Experience
IT Manager — Alberta Motor Association | Edmonton, AB
01/2018 – Present
• Led cross-functional delivery teams through SDLC modernization initiatives.
• Automated deployment workflows reducing release cycle time by 40%.

Senior Consultant — Pleasant Solutions | Edmonton, AB
01/2010 – 12/2017
• Managed client product roadmaps and backlog prioritization across Agile sprints.
`

test('ATS_KEYWORD_INJECTION_DIRECTIVE requires JSON output with injectedKeywords', () => {
  assert.match(ATS_KEYWORD_INJECTION_DIRECTIVE, /modifiedText/)
  assert.match(ATS_KEYWORD_INJECTION_DIRECTIVE, /injectedKeywords/)
  assert.match(ATS_KEYWORD_INJECTION_DIRECTIVE, /Anti-plagiarism|ANTI_COPY|4\+ consecutive words/i)
  assert.match(ATS_KEYWORD_INJECTION_DIRECTIVE, /action verb phrase/)
})

test('buildAtsKeywordInjectionSystemPrompt includes missing skill and cloud equivalents', () => {
  const prompt = buildAtsKeywordInjectionSystemPrompt({
    missingSkill: 'cloud',
  })

  assert.match(prompt, /cloud/)
  assert.match(prompt, /AWS/)
  assert.match(prompt, /Azure/)
})

test('buildAtsKeywordInjectionSystemPrompt adds location rule for summary edits', () => {
  const prompt = buildAtsKeywordInjectionSystemPrompt({
    missingSkill: 'Program Management',
    modificationType: 'summary',
    candidateLocation: 'Edmonton, AB',
  })

  assert.match(prompt, /Edmonton, AB/)
  assert.match(prompt, /professional summary/i)
})

test('parseTailorSnippetModelOutput parses JSON with injected keywords', () => {
  const raw = `{"modifiedText":"Led cloud migration reducing release cycle time by 40%.","injectedKeywords":["cloud"]}`
  const parsed = parseTailorSnippetModelOutput(raw)

  assert.ok(parsed)
  assert.match(parsed!.modifiedText, /cloud migration/)
  assert.deepEqual(parsed!.injectedKeywords, ['cloud'])
})

test('extractInjectedKeywordsFromText finds indexable cloud tokens', () => {
  const line = 'Architected AWS-based deployment pipelines reducing release cycle time by 40%.'
  const keywords = extractInjectedKeywordsFromText(line, 'cloud')

  assert.ok(keywords.some((token) => /aws/i.test(token)))
  assert.ok(resumeSemanticallyMatchesSkill(line, 'cloud') || keywords.length > 0)
})

test('enforceTailorSnippetOutput verifies injectedKeywords appear in modifiedText', () => {
  const enforced = enforceTailorSnippetOutput(
    {
      modifiedText: 'Led cloud modernization reducing release cycle time by 40%.',
      injectedKeywords: ['cloud', 'missing-token'],
    },
    'cloud'
  )

  assert.deepEqual(enforced.injectedKeywords, ['cloud'])
})

test('tailorSnippetOutputFromPlainText extracts keywords from plain LLM fallback', () => {
  const output = tailorSnippetOutputFromPlainText(
    'Delivered cloud-based infrastructure automation reducing manual effort by 35%.',
    'cloud'
  )

  assert.ok(output.injectedKeywords.length > 0)
  assert.ok(resumeSemanticallyMatchesSkill(output.modifiedText, 'cloud'))
})

test('buildActiveSectionTailoringContext sends only the matched experience role', () => {
  const document = parseStructuredResumeDocument(sampleResume)
  const { sectionContext } = buildActiveSectionTailoringContext(document, {
    modificationType: 'inline-bullet',
    targetCompany: 'Alberta Motor Association',
    targetRoleTitle: 'IT Manager',
  })

  assert.match(sectionContext, /Alberta Motor Association/)
  assert.match(sectionContext, /SDLC modernization/)
  assert.doesNotMatch(sectionContext, /Pleasant Solutions/)
})

test('stripTailoringResponse removes conversational wrappers', () => {
  assert.equal(
    stripTailoringResponse('Sure, here is your rewritten bullet: Led cross-functional teams.'),
    'Led cross-functional teams.'
  )
  assert.equal(
    stripTailoringResponse("Here's the revised line:\n• Automated deployment workflows."),
    'Automated deployment workflows.'
  )
})
