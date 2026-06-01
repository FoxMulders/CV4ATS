import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { generateTailoredResumeLocally } from '../lib/ai/local-fallback'
import { aiGenerationResultSchema } from '../lib/ai/schemas'
import { normalizeGenerationDraftForApi } from '../lib/api/normalize-generation-draft'

const fixturePath = join(process.cwd(), 'test-fixtures', 'brad-resume.txt')
const resume = readFileSync(fixturePath, 'utf8')
const jobDescription = `Technical Program Manager - North at Cohere
As a Technical Program Manager, you will lead release trains, hotfix workflows, and cherry-pick workflows for our North platform.`

const draft = generateTailoredResumeLocally(jobDescription, resume)
const normalized = normalizeGenerationDraftForApi(draft, resume)

console.log('--- draft shape ---')
console.log('experience blocks:', draft.tailoredResume.experience.length)
console.log('skills:', draft.tailoredResume.skills.length)
console.log('cover letter length:', draft.coverLetter.length)

console.log('\n--- normalizeGenerationDraftForApi ---')
console.log('experience blocks:', normalized.tailoredResume.experience.length)
console.log('skills:', normalized.tailoredResume.skills.length)

console.log('\n--- aiGenerationResultSchema.parse ---')
try {
  const validated = aiGenerationResultSchema.parse(normalized)
  console.log('PASS — schema validation succeeded')
  console.log('validated experience blocks:', validated.tailoredResume.experience.length)
  console.log('validated name:', validated.tailoredResume.contact.name)
} catch (error) {
  console.error('FAIL — schema validation error')
  console.error(error)
  process.exitCode = 1
}
