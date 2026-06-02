import assert from 'node:assert/strict'
import test from 'node:test'

import { buildAutoCorrectionSummary } from '@/lib/ai/editor-agent'
import {
  auditPanelDraftIssues,
  repairPersonalVenturesInWorkExperience,
} from '@/lib/ai/panel-draft-audit'
import type { AiGenerationResult } from '@/lib/ai/schemas'

const sourceResume = `BRAD MULDERS
PROFESSIONAL EXPERIENCE
Pleasant Solutions
Technical Project Manager
02/2024 - Present
• Led release planning.

Alberta Motor Association
Systems Developer
2013 - 2024
• Built C# automation tools supporting 500+ staff.

PERSONAL AI PROJECTS
cv2ats.ca
Personal venture
02/2024 - Present
• Built ATS resume tooling.`

function flawedDraft(): AiGenerationResult {
  return {
    keywordReport: {
      matchScore: 60,
      matchedKeywords: [],
      missingKeywords: [],
      suggestions: [],
    },
    coverLetter:
      'My career focus has been on delivery leadership. I am ready to align with your team. I am writing to express my interest.',
    tailoredResume: {
      contact: {
        name: 'Brad Mulders',
        email: 'brad@example.com',
        phone: '',
        location: '',
        linkedin: '',
      },
      summary: 'Leader with a proven track record in Agile delivery.',
      skills: ['Agile'],
      experience: [
        {
          title: 'Technical Project Manager',
          company: 'Pleasant Solutions',
          location: '',
          startDate: '02/2024',
          endDate: 'Present',
          bullets: ['Steered releases, improving efficiency by 15%.'],
        },
        {
          title: 'Founder',
          company: 'cv2ats.ca',
          location: '',
          startDate: '02/2024',
          endDate: 'Present',
          bullets: ['Built ATS tooling for job seekers.'],
        },
      ],
      projects: [],
      education: [],
      certifications: [],
    },
  }
}

test('auditPanelDraftIssues detects clichés, fake metrics, and personal venture in work experience', () => {
  const issues = auditPanelDraftIssues(flawedDraft(), sourceResume, 'Software Development Manager at Petal')

  assert.ok(issues.some((issue) => issue.code === 'banned-cliche'))
  assert.ok(issues.some((issue) => issue.code === 'ungrounded-metric'))
  assert.ok(issues.some((issue) => issue.code === 'personal-venture-in-work'))
  assert.ok(issues.some((issue) => issue.code === 'timeline-overlap'))
})

test('repairPersonalVenturesInWorkExperience moves cv2ats to projects with concurrent dating', () => {
  const repaired = repairPersonalVenturesInWorkExperience(flawedDraft().tailoredResume)

  assert.equal(repaired.experience.length, 1)
  assert.ok(repaired.projects.length >= 1)
  assert.ok(repaired.projects.some((entry) => /cv2ats/i.test(entry.company)))
  assert.ok(
    repaired.projects.some((entry) => /Concurrent \/ Project-based/i.test(entry.endDate))
  )
})

test('buildAutoCorrectionSummary reads like proof-of-work not a scoreboard insult', () => {
  const summary = buildAutoCorrectionSummary({
    initialScore: 62,
    finalScore: 95,
    correctedIssues: [
      'Banned corporate cliché in cover letter: "proven track record"',
      'Personal venture listed under corporate work experience: cv2ats.ca',
      'Non-verifiable metric in Pleasant Solutions bullet',
    ],
    revisionRounds: 1,
  })

  assert.match(summary, /scanned your initial draft/i)
  assert.match(summary, /automatically corrected/i)
  assert.match(summary, /95%/)
  assert.match(summary, /62%/)
})
