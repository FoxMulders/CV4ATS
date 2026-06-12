import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  applyRevisionsToStateSlice,
  mergeTailoredResumeIntoStateSlice,
  resolveWorkExperienceNodeIndex,
  resumeTextToStateSlice,
  stateSliceToTailoredResume,
  tailoredResumeToStateSlice,
} from '@/lib/resume/resume-state-slice'
import { strictStateToTailoredResume, lockResumeState } from '@/lib/resume/strict-resume-state'

const bradFixture = readFileSync(join(process.cwd(), 'test-fixtures', 'brad-resume.txt'), 'utf8')

test('applyRevisions targets workExperience node by positionId', () => {
  const slice = resumeTextToStateSlice(bradFixture)
  assert.ok(slice.workExperience.length > 0)

  const target = slice.workExperience[0]!
  const originalBullet = target.bullets[0]!
  const revised = `${originalBullet} while applying stakeholder management practices.`

  const next = applyRevisionsToStateSlice(slice, [
    {
      snippet: revised,
      positionId: target.positionId,
      bulletIndex: 0,
      originalBullet,
      modificationType: 'inline-bullet',
    },
  ])

  assert.equal(next.workExperience[0]?.bullets[0], revised)
  assert.equal(next.appliedRevisions.length, 1)
})

test('mergeTailoredResumeIntoStateSlice preserves applied revisions over AI baseline', () => {
  const slice = resumeTextToStateSlice(bradFixture)
  const target = slice.workExperience[0]!
  const originalBullet = target.bullets[0]!
  const revised = `${originalBullet} with measurable program delivery outcomes.`

  const withRevision = applyRevisionsToStateSlice(slice, [
    {
      snippet: revised,
      positionId: target.positionId,
      bulletIndex: 0,
      originalBullet,
      modificationType: 'inline-bullet',
    },
  ])

  const aiBaseline = strictStateToTailoredResume(lockResumeState(bradFixture))
  aiBaseline.experience[0]!.bullets[0] = 'AI rewrote this bullet without the user skill.'

  const merged = mergeTailoredResumeIntoStateSlice(withRevision, aiBaseline, bradFixture)

  assert.equal(merged.workExperience[0]?.bullets[0], revised)
})

test('stateSliceToTailoredResume matches export document workExperience', () => {
  const slice = resumeTextToStateSlice(bradFixture)
  const tailored = stateSliceToTailoredResume(slice)
  const fromTailored = tailoredResumeToStateSlice(tailored, bradFixture)

  assert.equal(tailored.experience.length, fromTailored.workExperience.length)
  assert.equal(
    tailored.experience[0]?.bullets[0],
    fromTailored.workExperience[0]?.bullets[0]
  )
})

test('resolveWorkExperienceNodeIndex matches company and title fallback', () => {
  const slice = resumeTextToStateSlice(bradFixture)
  const target = slice.workExperience[0]!

  const index = resolveWorkExperienceNodeIndex(slice.workExperience, {
    snippet: 'ignored',
    targetCompany: target.company,
    targetRoleTitle: target.title,
  })

  assert.equal(index, 0)
})
