import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildBradMuldersCoverLetterAddendum,
  classifyBradMuldersRoleFocus,
  isBradMuldersResume,
} from '@/lib/ai/candidate-narratives/brad-mulders'
import { buildCandidateNarrativeAddendum } from '@/lib/ai/candidate-narratives'

const bradResume = `BRAD MULDERS
bradmulders@me.com | Edmonton`

test('isBradMuldersResume detects email and name', () => {
  assert.equal(isBradMuldersResume('bradmulders@me.com\nExperience'), true)
  assert.equal(isBradMuldersResume('BRAD MULDERS\nOther'), true)
  assert.equal(isBradMuldersResume('Jane Doe\njane@example.com'), false)
})

test('classifyBradMuldersRoleFocus adapts to posting type', () => {
  assert.equal(
    classifyBradMuldersRoleFocus('Technical Program Manager - North\nCohere\nLinear GitHub'),
    'delivery_leadership'
  )
  assert.equal(
    classifyBradMuldersRoleFocus('Business Analyst\nRequirements gathering'),
    'business_analysis'
  )
  assert.equal(
    classifyBradMuldersRoleFocus('Senior Software Engineer\nTypeScript React'),
    'engineering'
  )
  assert.equal(
    classifyBradMuldersRoleFocus('Project Coordinator\nmilestones tracking'),
    'coordination'
  )
})

test('buildBradMuldersCoverLetterAddendum includes role-specific tailoring', () => {
  const tpmJd = `Technical Program Manager\nAcme Corp\nOwn release trains and hotfix workflows.`
  const addendum = buildBradMuldersCoverLetterAddendum(tpmJd)
  assert.match(addendum, /Kolbe/)
  assert.match(addendum, /broken delivery roadmaps/)
  assert.match(addendum, /Sheetast, Turbo Diagrams, Paranoid Photos/)
  assert.match(addendum, /Business Analyst/)
  assert.match(addendum, /Role focus: \*\*delivery_leadership\*\*/)
  assert.match(addendum, /Technical Program Manager/)

  const engJd = `Senior Software Engineer\nBuild APIs in TypeScript`
  const engAddendum = buildBradMuldersCoverLetterAddendum(engJd)
  assert.match(engAddendum, /Role focus: \*\*engineering\*\*/)
  assert.match(engAddendum, /AMA C# automation/)
})

test('buildCandidateNarrativeAddendum returns empty for other candidates', () => {
  assert.equal(buildCandidateNarrativeAddendum('Jane Doe', 'Project Manager'), '')
  assert.ok(buildCandidateNarrativeAddendum(bradResume, 'Project Manager at Co').includes('Brad Mulders'))
})
