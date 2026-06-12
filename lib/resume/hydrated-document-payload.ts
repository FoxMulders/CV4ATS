import type { Contact, Education, Experience, TailoredResume } from '@/lib/ai/schemas'
import { tailoredResumeSchema } from '@/lib/ai/schemas'
import { prepareResumeForDisplay } from '@/lib/resume/prepare-resume-for-display'
import { normalizeSkillArray } from '@/lib/resume/skill-array-normalize'
import {
  stateSliceToTailoredResume,
  type ResumeStateSlice,
} from '@/lib/resume/resume-state-slice'
import { lockResumeState, type StrictResumeState } from '@/lib/resume/strict-resume-state'

export type TextBlockVariant = 'baseline' | 'modified'

export type ResumeDocumentSection =
  | 'contact'
  | 'summary'
  | 'skills'
  | 'experience'
  | 'projects'
  | 'education'
  | 'certifications'

export interface ResumeStringArrayBlock {
  id: string
  section: ResumeDocumentSection
  kind: 'string-array'
  baselineValues: string[]
  modifiedValues?: string[]
  activeVariant: TextBlockVariant
}

export interface ResumeTextBlock {
  id: string
  section: ResumeDocumentSection
  kind: 'text'
  baselineText: string
  modifiedText?: string
  activeVariant: TextBlockVariant
}

export type ResumeDocumentBlock = ResumeTextBlock | ResumeStringArrayBlock

export interface ResumeDocumentState {
  blocks: ResumeDocumentBlock[]
}

export interface HydratedDocumentInput {
  current: TailoredResume
  baseline?: TailoredResume | null
}

function arraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false
  return left.every((value, index) => value === right[index])
}

function resolveActiveString(block: ResumeTextBlock): string {
  if (block.activeVariant === 'modified' && block.modifiedText?.trim()) {
    return block.modifiedText.trim()
  }
  return block.baselineText.trim()
}

function resolveActiveStringArray(block: ResumeStringArrayBlock): string[] {
  const source =
    block.activeVariant === 'modified' && block.modifiedValues !== undefined
      ? block.modifiedValues
      : block.baselineValues

  return source.map((value) => value.trim()).filter(Boolean)
}

function buildExperienceBlocks(
  section: 'experience' | 'projects',
  baselineState: StrictResumeState,
  currentState: StrictResumeState
): ResumeTextBlock[] {
  const baselineBlocks =
    section === 'experience' ? baselineState.workExperience : baselineState.projects
  const currentBlocks =
    section === 'experience' ? currentState.workExperience : currentState.projects

  const blocks: ResumeTextBlock[] = []

  for (let index = 0; index < currentBlocks.length; index += 1) {
    const current = currentBlocks[index]!
    const baseline =
      baselineBlocks.find((entry) => entry.blockKey === current.blockKey) ??
      baselineBlocks[index]

    const bulletCount = Math.max(current.bullets.length, baseline?.bullets.length ?? 0)

    for (let bulletIndex = 0; bulletIndex < bulletCount; bulletIndex += 1) {
      const baselineText = baseline?.bullets[bulletIndex]?.trim() ?? ''
      const modifiedText = current.bullets[bulletIndex]?.trim() ?? ''
      const hasModified = modifiedText.length > 0 && modifiedText !== baselineText

      blocks.push({
        id: `${section}:${current.blockKey}:bullet:${bulletIndex}`,
        section,
        kind: 'text',
        baselineText: baselineText || modifiedText,
        modifiedText: hasModified ? modifiedText : undefined,
        activeVariant: hasModified ? 'modified' : 'baseline',
      })
    }
  }

  return blocks
}

function buildEducationBlocks(baseline: Education[], current: Education[]): ResumeTextBlock[] {
  const blocks: ResumeTextBlock[] = []
  const count = Math.max(baseline.length, current.length)

  for (let index = 0; index < count; index += 1) {
    const baselineEntry = baseline[index]
    const currentEntry = current[index]
    if (!currentEntry && !baselineEntry) continue

    const fields: Array<{ key: 'degree' | 'school' | 'graduationDate' | 'details'; id: string }> = [
      { key: 'degree', id: 'degree' },
      { key: 'school', id: 'school' },
      { key: 'graduationDate', id: 'graduationDate' },
      { key: 'details', id: 'details' },
    ]

    for (const field of fields) {
      const baselineText = baselineEntry?.[field.key]?.trim() ?? ''
      const modifiedText = currentEntry?.[field.key]?.trim() ?? ''
      const hasModified = modifiedText.length > 0 && modifiedText !== baselineText

      blocks.push({
        id: `education:${index}:${field.id}`,
        section: 'education',
        kind: 'text',
        baselineText: baselineText || modifiedText,
        modifiedText: hasModified ? modifiedText : undefined,
        activeVariant: hasModified ? 'modified' : 'baseline',
      })
    }
  }

  return blocks
}

/** Build a section-scoped document state from baseline and current tailored resumes. */
export function buildResumeDocumentState(input: HydratedDocumentInput): ResumeDocumentState {
  const baselineState = lockResumeState(input.baseline ?? input.current)
  const currentState = lockResumeState(input.current)

  const blocks: ResumeDocumentBlock[] = []

  const summaryBaseline = baselineState.summary.trim()
  const summaryModified = currentState.summary.trim()
  const summaryChanged = summaryModified.length > 0 && summaryModified !== summaryBaseline

  blocks.push({
    id: 'summary',
    section: 'summary',
    kind: 'text',
    baselineText: summaryBaseline || summaryModified,
    modifiedText: summaryChanged ? summaryModified : undefined,
    activeVariant: summaryChanged ? 'modified' : 'baseline',
  })

  const skillsBaseline = baselineState.skills
  const skillsModified = currentState.skills
  const skillsChanged = !arraysEqual(skillsBaseline, skillsModified)

  blocks.push({
    id: 'skills',
    section: 'skills',
    kind: 'string-array',
    baselineValues: skillsBaseline,
    modifiedValues: skillsChanged ? skillsModified : undefined,
    activeVariant: skillsChanged ? 'modified' : 'baseline',
  })

  blocks.push(...buildExperienceBlocks('experience', baselineState, currentState))
  blocks.push(...buildExperienceBlocks('projects', baselineState, currentState))
  blocks.push(...buildEducationBlocks(baselineState.education, currentState.education))

  const certBaseline = baselineState.certifications
  const certModified = currentState.certifications
  const certChanged = !arraysEqual(certBaseline, certModified)

  blocks.push({
    id: 'certifications',
    section: 'certifications',
    kind: 'string-array',
    baselineValues: certBaseline,
    modifiedValues: certChanged ? certModified : undefined,
    activeVariant: certChanged ? 'modified' : 'baseline',
  })

  return { blocks }
}

function compileExperienceFromBlocks(
  section: 'experience' | 'projects',
  state: StrictResumeState,
  blocks: ResumeDocumentBlock[]
): Experience[] {
  const sourceBlocks = section === 'experience' ? state.workExperience : state.projects

  return sourceBlocks.map((block) => {
    const prefix = `${section}:${block.blockKey}:bullet:`
    const bulletBlocks = blocks.filter(
      (entry): entry is ResumeTextBlock =>
        entry.kind === 'text' && entry.section === section && entry.id.startsWith(prefix)
    )

    const bullets =
      bulletBlocks.length > 0
        ? bulletBlocks
            .sort((left, right) => {
              const leftIndex = Number(left.id.slice(prefix.length))
              const rightIndex = Number(right.id.slice(prefix.length))
              return leftIndex - rightIndex
            })
            .map(resolveActiveString)
            .filter(Boolean)
        : block.bullets.filter(Boolean)

    return {
      title: block.title,
      company: block.company,
      location: block.location,
      startDate: block.startDate || 'Recent',
      endDate: block.endDate || 'Present',
      bullets: bullets.length > 0 ? bullets : ['Delivered measurable outcomes in this role.'],
    }
  })
}

function compileEducationFromBlocks(
  baseline: Education[],
  current: Education[],
  blocks: ResumeDocumentBlock[]
): Education[] {
  const count = Math.max(baseline.length, current.length)
  const education: Education[] = []

  for (let index = 0; index < count; index += 1) {
    const baselineEntry = baseline[index]
    const currentEntry = current[index]
    if (!baselineEntry && !currentEntry) continue

    const readField = (field: 'degree' | 'school' | 'graduationDate' | 'details'): string => {
      const block = blocks.find(
        (entry): entry is ResumeTextBlock =>
          entry.kind === 'text' &&
          entry.section === 'education' &&
          entry.id === `education:${index}:${field}`
      )
      if (block) return resolveActiveString(block)
      return currentEntry?.[field]?.trim() ?? baselineEntry?.[field]?.trim() ?? ''
    }

    education.push({
      degree: readField('degree') || 'Degree',
      school: readField('school') || 'Institution',
      graduationDate: readField('graduationDate'),
      details: readField('details'),
    })
  }

  return education
}

function resolveContact(current: Contact, baseline: Contact): Contact {
  return {
    name: current.name?.trim() || baseline.name,
    email: current.email?.trim() || baseline.email,
    phone: current.phone?.trim() || baseline.phone,
    location: current.location?.trim() || baseline.location,
    linkedin: current.linkedin?.trim() || baseline.linkedin,
  }
}

/**
 * Compile active text blocks into a schema-safe TailoredResume for preview/export.
 * When a block has an active modified variant, that text wins over baseline.
 */
export function getHydratedDocumentPayload(input: HydratedDocumentInput): TailoredResume {
  const documentState = buildResumeDocumentState(input)
  const baselineState = lockResumeState(input.baseline ?? input.current)
  const currentState = lockResumeState(input.current)
  const { blocks } = documentState

  const summaryBlock = blocks.find(
    (block): block is ResumeTextBlock => block.id === 'summary' && block.kind === 'text'
  )
  const skillsBlock = blocks.find(
    (block): block is ResumeStringArrayBlock => block.id === 'skills' && block.kind === 'string-array'
  )
  const certificationsBlock = blocks.find(
    (block): block is ResumeStringArrayBlock =>
      block.id === 'certifications' && block.kind === 'string-array'
  )

  const rawSkills = skillsBlock ? resolveActiveStringArray(skillsBlock) : currentState.skills
  const normalizedSkills = normalizeSkillArray(rawSkills)

  const payload: TailoredResume = {
    contact: resolveContact(currentState.contact, baselineState.contact),
    summary: summaryBlock ? resolveActiveString(summaryBlock) : currentState.summary,
    skills: normalizedSkills.length > 0 ? normalizedSkills : ['Professional Skills'],
    experience: compileExperienceFromBlocks('experience', currentState, blocks),
    projects: compileExperienceFromBlocks('projects', currentState, blocks),
    education: compileEducationFromBlocks(
      baselineState.education,
      currentState.education,
      blocks
    ),
    certifications: certificationsBlock
      ? resolveActiveStringArray(certificationsBlock)
      : currentState.certifications,
  }

  const hydrated = prepareResumeForDisplay(payload)
  const parsed = tailoredResumeSchema.safeParse(hydrated)

  if (!parsed.success) {
    throw new Error(
      `Hydrated resume failed schema validation: ${parsed.error.issues.map((issue) => issue.message).join('; ')}`
    )
  }

  return parsed.data
}

/** Compile a live resume builder slice — applies active revisions and skill normalization. */
export function getHydratedDocumentPayloadFromSlice(
  slice: ResumeStateSlice,
  baseline?: ResumeStateSlice | TailoredResume | null
): TailoredResume {
  const current = stateSliceToTailoredResume(slice)
  const baselineResume =
    baseline && 'workExperience' in baseline
      ? stateSliceToTailoredResume(baseline)
      : baseline ?? null

  return getHydratedDocumentPayload({ current, baseline: baselineResume })
}
