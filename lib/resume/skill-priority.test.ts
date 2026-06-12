import assert from 'node:assert/strict'
import test from 'node:test'

import { extrapolateTargetSkills } from '@/lib/resume/skill-extrapolation'
import {
  classifySkillPriorityTier,
  extractFoundationalSkillsFromText,
  isFoundationalSkillTerm,
  isProprietaryPlatformTerm,
  scoringWeightForSkill,
} from '@/lib/resume/skill-priority'
import { computeIntersectionMatchScore } from '@/lib/resume/intersection-ats-score'
import type { TailoredResume } from '@/lib/ai/schemas'
import { JOB_SKILL_EXTRACTION_SYSTEM_PROMPT } from '@/lib/ai/job-skill-extraction-prompts'

const sampleResume: TailoredResume = {
  contact: {
    name: 'Alex Example',
    email: 'alex@example.com',
    phone: '555-0100',
    location: 'Remote',
    linkedin: '',
  },
  summary: 'Infrastructure leader with cloud architecture and distributed systems experience.',
  skills: ['Cloud Technologies', 'Software Architecture', 'Stakeholder management'],
  experience: [
    {
      title: 'IT Director',
      company: 'Acme Corp',
      location: 'Remote',
      startDate: '2020',
      endDate: 'Present',
      bullets: [
        'Led cloud migration and software architecture modernization across enterprise platforms.',
      ],
    },
  ],
  projects: [],
  education: [],
  certifications: [],
}

test('isProprietaryPlatformTerm detects Genesys Cloud as vendor platform', () => {
  assert.equal(isProprietaryPlatformTerm('Genesys Cloud'), true)
  assert.equal(isProprietaryPlatformTerm('genesys cloud'), true)
  assert.equal(classifySkillPriorityTier('Genesys Cloud'), 'desirable')
})

test('isFoundationalSkillTerm detects transferable architecture competencies', () => {
  assert.equal(isFoundationalSkillTerm('cloud technologies'), true)
  assert.equal(isFoundationalSkillTerm('distributed systems'), true)
  assert.equal(isFoundationalSkillTerm('software architecture'), true)
  assert.equal(scoringWeightForSkill('cloud technologies', 'core'), 1.5)
})

test('extractFoundationalSkillsFromText pulls generic cloud and architecture terms', () => {
  const jd = `Lead cloud technologies initiatives across distributed systems with strong software architecture skills.
Experience with Genesys Cloud is a plus.`

  const foundational = extractFoundationalSkillsFromText(jd)
  assert.ok(foundational.includes('cloud technologies'))
  assert.ok(foundational.includes('distributed systems'))
  assert.ok(foundational.includes('software architecture'))
})

test('extrapolateTargetSkills labels Genesys Cloud as desirable and keeps foundational core terms', () => {
  const jd = `We need cloud technologies leadership, distributed systems expertise, and software architecture.
Genesys Cloud experience preferred. Agile delivery required.`

  const skills = extrapolateTargetSkills(jd)
  const genesys = skills.find((skill) => skill.term.includes('genesys'))
  const cloudTech = skills.find((skill) => skill.term === 'cloud technologies')

  assert.ok(genesys)
  assert.equal(genesys!.priorityTier, 'desirable')
  assert.ok(cloudTech)
  assert.equal(cloudTech!.priorityTier, 'core')
})

test('weighted intersection score penalizes missing Genesys less than missing core architecture skills', () => {
  const targetSkills = [
    { term: 'cloud technologies', category: 'domainTech' as const, priorityTier: 'core' as const },
    { term: 'distributed systems', category: 'domainTech' as const, priorityTier: 'core' as const },
    { term: 'software architecture', category: 'domainTech' as const, priorityTier: 'core' as const },
    { term: 'genesys cloud', category: 'tool' as const, priorityTier: 'desirable' as const },
  ]

  const withCoreOnly = computeIntersectionMatchScore({
    resume: sampleResume,
    targetSkills,
  })

  const missingGenesysOnly = computeIntersectionMatchScore({
    resume: {
      ...sampleResume,
      summary: 'Infrastructure leader without vendor contact center platforms.',
      skills: ['Stakeholder management'],
      experience: [
        {
          ...sampleResume.experience[0]!,
          bullets: ['Led stakeholder management across enterprise programs.'],
        },
      ],
    },
    targetSkills,
  })

  assert.ok(withCoreOnly.matchScore > missingGenesysOnly.matchScore)
  assert.ok(withCoreOnly.matchScore >= 80)
})

test('JOB_SKILL_EXTRACTION_SYSTEM_PROMPT separates vendor brands from core methodologies', () => {
  assert.match(JOB_SKILL_EXTRACTION_SYSTEM_PROMPT, /Genesys Cloud/)
  assert.match(JOB_SKILL_EXTRACTION_SYSTEM_PROMPT, /coreMethodologies/)
  assert.match(JOB_SKILL_EXTRACTION_SYSTEM_PROMPT, /desirablePreferred/)
  assert.match(JOB_SKILL_EXTRACTION_SYSTEM_PROMPT, /cloud technologies/i)
})
