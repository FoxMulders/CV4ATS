import { generateTailoredResumeLocally } from '../lib/ai/local-fallback'
import { inferNameFromEmail } from '../lib/resume/contact-extraction'
import { parseResumeTextToTailoredResume } from '../lib/resume/text-to-structured'

const bradLikeResume = `BRAD MULDERS
bradmulders@me.com | (780) 920-0664 | Edmonton, Canada T5Z 3X7

PROFESSIONAL SUMMARY
Technical program leader with 30 years coordinating releases at Pleasant Solutions and Alberta Motor Association.

PROFESSIONAL EXPERIENCE

Pleasant Solutions
Technical Project Manager
02/2024 - Present
• Led cross-functional release planning for enterprise clients using Agile, Jira, and Linear workflows.
• Identified deployment bottlenecks and established release governance across GitHub PR tracking.

Alberta Motor Association
Systems Developer
2013 - 2024
• Built C# automation tools and SQL reporting pipelines for membership operations.
• Managed release cycles and AWS deployments for internal tools supporting 500+ staff.

PERSONAL AI PROJECTS

Tipsy Fox Escapes
Personal AI Project
2024 - Present
• Built AI-assisted escape room booking platform with automated release workflows.

PopUpHub
Personal AI Project
2025 - Present
• Developed popup event coordination hub using modern cloud and GitHub CI/CD patterns.

EDUCATION
Bachelor of Science, University of Alberta`

const cohereJobDescription = `Technical Program Manager - North
Cohere

As a Technical Program Manager, you will own release trains, hotfix workflows, and cherry-pick workflows for our North platform.
We use Linear and GitHub for project tracking.`

console.log('--- parseResumeTextToTailoredResume ---')
console.log('inferName:', inferNameFromEmail('bradmulders@me.com'))
const parsed = parseResumeTextToTailoredResume(bradLikeResume)
console.log('parsed name:', parsed.contact.name)
console.log('parsed location:', parsed.contact.location)
console.log('parsed experience count:', parsed.experience.length)
parsed.experience.forEach((entry, index) => {
  console.log(`  [${index}] ${entry.company} | ${entry.title} | ${entry.bullets.length} bullets`)
})

console.log('\n--- generateTailoredResumeLocally ---')
const result = generateTailoredResumeLocally(cohereJobDescription, bradLikeResume)
console.log('tailored name:', result.tailoredResume.contact.name)
result.tailoredResume.experience.forEach((entry, index) => {
  console.log(
    `  [${index}] ${entry.company} | ${entry.title} | ${entry.startDate}-${entry.endDate} | ${entry.bullets.length} bullets`
  )
})
console.log('skills (first 12):', result.tailoredResume.skills.slice(0, 12).join(', '))
console.log(
  'cover opening:',
  result.coverLetter.split('\n').find((line) => /interested/i.test(line)) ?? '(none)'
)
console.log('cover pastes summary verbatim:', result.coverLetter.includes('30 years coordinating'))
