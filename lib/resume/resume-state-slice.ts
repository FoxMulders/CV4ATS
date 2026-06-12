import type { Contact, Education, Experience, TailoredResume } from '@/lib/ai/schemas'
import {
  auditResumePhrasingCompliance,
  type PhrasingAuditResult,
} from '@/lib/resume/exact-phrasing-auditor'
import { serializeTailoredResume } from '@/lib/resume/ats-score'
import { normalizeSkillArray } from '@/lib/resume/skill-array-normalize'
import {
  lockResumeState,
  normalizeExperienceBlockKey,
  strictStateToTailoredResume,
  type ResumeDocument,
} from '@/lib/resume/strict-resume-state'
import { parseStructuredResumeDocument } from '@/lib/resume/structured-resume-document'
import type { StructuredSkillModification } from '@/lib/resume/structured-resume-document'

/** Stable node identity for work experience blocks — blockKey + structured positionId. */
export type WorkExperienceNode = Experience & {
  blockKey: string
  positionId: string
}

export type ResumeStateSlice = {
  contactInfo: Contact
  summary: string
  skills: string[]
  workExperience: WorkExperienceNode[]
  projects: WorkExperienceNode[]
  education: Education[]
  certifications: string[]
  /** Accumulated anchored revisions — re-applied after generation so edits are not dropped. */
  appliedRevisions: ResumeRevision[]
  /** Latest Exact Phrasing Auditor result across mutable fields. */
  phrasingAudit: PhrasingAuditResult | null
}

export type ResumeRevision = StructuredSkillModification & {
  targetRoleTitle?: string
  targetCompany?: string
}

export type ResumeStateAction =
  | { type: 'RESET'; payload: ResumeStateSlice | null }
  | { type: 'SET_FROM_TAILORED'; resume: TailoredResume; sourceText?: string }
  | { type: 'SET_FROM_TEXT'; resumeText: string }
  | { type: 'APPLY_REVISIONS'; revisions: ResumeRevision[]; jobDescription?: string }
  | { type: 'MERGE_TAILORED'; resume: TailoredResume; sourceText?: string; jobDescription?: string }
  | { type: 'PATCH'; patch: Partial<Pick<ResumeStateSlice, 'summary' | 'skills' | 'contactInfo' | 'education' | 'certifications'>> }
  | { type: 'PATCH_TAILORED'; resume: TailoredResume; sourceText?: string; jobDescription?: string }
  | {
      type: 'PATCH_WORK_EXPERIENCE'
      blockKey: string
      patch: Partial<Experience>
      jobDescription?: string
    }
  | {
      type: 'PATCH_BULLET'
      blockKey: string
      bulletIndex: number
      text: string
      jobDescription?: string
    }
  | { type: 'AUDIT_PHRASING'; jobDescription: string }

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

function computePositionIdAlias(company: string, title: string, index: number): string {
  return `${slugify(company)}-${slugify(title)}-${index}`
}

function cloneSlice(state: ResumeStateSlice): ResumeStateSlice {
  return structuredClone(state)
}

export function createEmptyResumeStateSlice(): ResumeStateSlice {
  return {
    contactInfo: {
      name: '',
      email: '',
      phone: '',
      location: '',
      linkedin: '',
    },
    summary: '',
    skills: [],
    workExperience: [],
    projects: [],
    education: [],
    certifications: [],
    appliedRevisions: [],
    phrasingAudit: null,
  }
}

function buildPositionIdLookup(sourceText?: string): Map<string, string> {
  const lookup = new Map<string, string>()
  if (!sourceText?.trim()) return lookup

  const document = parseStructuredResumeDocument(sourceText)
  document.experience.forEach((position, index) => {
    const blockKey = normalizeExperienceBlockKey(position.company, position.title, index)
    lookup.set(blockKey, position.id)
    lookup.set(position.id, position.id)
    const alias = computePositionIdAlias(position.company, position.title, position.headerLineIndex)
    lookup.set(alias, position.id)
  })

  return lookup
}

function experienceToNode(
  entry: Experience,
  index: number,
  positionIdLookup: Map<string, string>
): WorkExperienceNode {
  const blockKey = normalizeExperienceBlockKey(entry.company, entry.title, index)
  return {
    ...entry,
    blockKey,
    positionId:
      positionIdLookup.get(blockKey) ??
      positionIdLookup.get(computePositionIdAlias(entry.company, entry.title, index)) ??
      computePositionIdAlias(entry.company, entry.title, index),
  }
}

/** Build the canonical document slice from a tailored resume (and optional source text for positionId mapping). */
export function tailoredResumeToStateSlice(
  resume: TailoredResume,
  sourceText?: string
): ResumeStateSlice {
  const locked = lockResumeState(resume)
  const positionIdLookup = buildPositionIdLookup(sourceText)

  return {
    contactInfo: { ...locked.contact },
    summary: locked.summary,
    skills: [...locked.skills],
    workExperience: locked.workExperience.map((block, index) =>
      experienceToNode(
        {
          title: block.title,
          company: block.company,
          location: block.location,
          startDate: block.startDate,
          endDate: block.endDate,
          bullets: [...block.bullets],
        },
        index,
        positionIdLookup
      )
    ),
    projects: locked.projects.map((block, index) =>
      experienceToNode(
        {
          title: block.title,
          company: block.company,
          location: block.location,
          startDate: block.startDate,
          endDate: block.endDate,
          bullets: [...block.bullets],
        },
        index,
        positionIdLookup
      )
    ),
    education: [...locked.education],
    certifications: [...locked.certifications],
    appliedRevisions: [],
    phrasingAudit: null,
  }
}

export function resumeTextToStateSlice(resumeText: string): ResumeStateSlice {
  const locked = lockResumeState(resumeText)
  return tailoredResumeToStateSlice(strictStateToTailoredResume(locked), resumeText)
}

/** Deep-merge patch into slice without dropping sibling work experience nodes. */
export function deepMergeResumeStateSlice(
  base: ResumeStateSlice,
  patch: Partial<ResumeStateSlice>
): ResumeStateSlice {
  const next = cloneSlice(base)

  if (patch.contactInfo) {
    next.contactInfo = { ...next.contactInfo, ...patch.contactInfo }
  }
  if (patch.summary !== undefined) next.summary = patch.summary
  if (patch.skills) next.skills = [...patch.skills]
  if (patch.education) next.education = [...patch.education]
  if (patch.certifications) next.certifications = [...patch.certifications]
  if (patch.appliedRevisions) next.appliedRevisions = [...patch.appliedRevisions]
  if (patch.phrasingAudit !== undefined) next.phrasingAudit = patch.phrasingAudit

  if (patch.workExperience) {
    next.workExperience = mergeWorkExperienceNodes(next.workExperience, patch.workExperience)
  }
  if (patch.projects) {
    next.projects = mergeWorkExperienceNodes(next.projects, patch.projects)
  }

  return next
}

function mergeWorkExperienceNodes(
  existing: WorkExperienceNode[],
  incoming: WorkExperienceNode[]
): WorkExperienceNode[] {
  if (incoming.length === 0) return existing

  const byBlockKey = new Map(existing.map((node) => [node.blockKey, node]))
  const byPositionId = new Map(existing.map((node) => [node.positionId, node]))

  return incoming.map((node) => {
    const prior =
      byBlockKey.get(node.blockKey) ??
      (node.positionId ? byPositionId.get(node.positionId) : undefined)

    if (!prior) return { ...node, bullets: [...node.bullets] }

    return {
      ...prior,
      ...node,
      blockKey: prior.blockKey,
      positionId: prior.positionId || node.positionId,
      bullets: node.bullets.length > 0 ? [...node.bullets] : [...prior.bullets],
    }
  })
}

export function resolveWorkExperienceNodeIndex(
  workExperience: WorkExperienceNode[],
  revision: ResumeRevision
): number {
  if (revision.positionId) {
    const byId = workExperience.findIndex((node) => node.positionId === revision.positionId)
    if (byId >= 0) return byId
  }

  if (revision.targetCompany && revision.targetRoleTitle) {
    const company = revision.targetCompany.trim().toLowerCase()
    const title = revision.targetRoleTitle.trim().toLowerCase()
    const byRole = workExperience.findIndex(
      (node) =>
        node.company.trim().toLowerCase() === company &&
        node.title.trim().toLowerCase() === title
    )
    if (byRole >= 0) return byRole
  }

  if (revision.originalBullet?.trim()) {
    const target = revision.originalBullet.trim()
    const byBullet = workExperience.findIndex((node) =>
      node.bullets.some((bullet) => bullet.trim() === target)
    )
    if (byBullet >= 0) return byBullet
  }

  return -1
}

/** Apply anchored revisions to the workExperience array by node ID. */
export function applyRevisionsToStateSlice(
  state: ResumeStateSlice,
  revisions: ResumeRevision[]
): ResumeStateSlice {
  if (revisions.length === 0) return state

  let next = cloneSlice(state)
  const accumulated = [...next.appliedRevisions]

  for (const revision of revisions) {
    const snippet = revision.snippet.trim()
    if (!snippet) continue

    if (revision.modificationType === 'summary') {
      next.summary = snippet
      accumulated.push(revision)
      continue
    }

    if (revision.modificationType === 'skills-section') {
      const additions = normalizeSkillArray([snippet])
      next.skills = normalizeSkillArray([...next.skills, ...additions])
      accumulated.push(revision)
      continue
    }

    const nodeIndex = resolveWorkExperienceNodeIndex(next.workExperience, revision)
    if (nodeIndex < 0) continue

    const nodes = [...next.workExperience]
    const node = {
      ...nodes[nodeIndex]!,
      bullets: [...nodes[nodeIndex]!.bullets],
    }

    if (revision.bulletIndex !== undefined && revision.bulletIndex >= 0) {
      if (revision.bulletIndex < node.bullets.length) {
        node.bullets[revision.bulletIndex] = snippet
      } else {
        node.bullets.push(snippet)
      }
    } else if (revision.originalBullet?.trim()) {
      const bulletIndex = node.bullets.findIndex(
        (bullet) => bullet.trim() === revision.originalBullet!.trim()
      )
      if (bulletIndex >= 0) {
        node.bullets[bulletIndex] = snippet
      } else {
        node.bullets.push(snippet)
      }
    } else {
      node.bullets.push(snippet)
    }

    nodes[nodeIndex] = node
    next = { ...next, workExperience: nodes }
    accumulated.push(revision)
  }

  next.appliedRevisions = dedupeRevisions(accumulated)
  return next
}

function dedupeRevisions(revisions: ResumeRevision[]): ResumeRevision[] {
  const seen = new Set<string>()
  const result: ResumeRevision[] = []

  for (const revision of revisions) {
    const key = [
      revision.positionId ?? '',
      revision.bulletIndex ?? '',
      revision.originalBullet ?? '',
      revision.modificationType ?? '',
      revision.snippet.trim(),
    ].join('|')
    if (seen.has(key)) continue
    seen.add(key)
    result.push(revision)
  }

  return result
}

/** Re-apply accumulated revisions onto a freshly generated resume so user edits survive AI output. */
export function mergeTailoredResumeIntoStateSlice(
  state: ResumeStateSlice,
  generated: TailoredResume,
  sourceText?: string
): ResumeStateSlice {
  const generatedSlice = tailoredResumeToStateSlice(generated, sourceText)
  const merged = deepMergeResumeStateSlice(generatedSlice, {
    appliedRevisions: state.appliedRevisions,
  })

  if (state.appliedRevisions.length === 0) return merged

  return applyRevisionsToStateSlice(
    { ...merged, appliedRevisions: state.appliedRevisions },
    state.appliedRevisions
  )
}

export function auditStateSlicePhrasing(
  state: ResumeStateSlice,
  jobDescription: string
): PhrasingAuditResult {
  const sections = [
    { label: 'summary', text: state.summary },
    { label: 'skills', text: state.skills.join(', ') },
    ...state.workExperience.flatMap((node, index) =>
      node.bullets.map((bullet, bulletIndex) => ({
        label: `workExperience[${node.blockKey}].bullets[${bulletIndex}]`,
        text: bullet,
      }))
    ),
  ]

  const audit = auditResumePhrasingCompliance(sections, jobDescription)
  return {
    matches: audit.matches,
    hasHighSimilarity: audit.hasHighSimilarity,
    longestMatch: audit.longestMatch,
  }
}

function withPhrasingAudit(
  state: ResumeStateSlice,
  jobDescription?: string
): ResumeStateSlice {
  if (!jobDescription?.trim()) return state
  return {
    ...state,
    phrasingAudit: auditStateSlicePhrasing(state, jobDescription),
  }
}

export function resumeStateSliceReducer(
  state: ResumeStateSlice,
  action: ResumeStateAction
): ResumeStateSlice {
  switch (action.type) {
    case 'RESET':
      return action.payload ? cloneSlice(action.payload) : createEmptyResumeStateSlice()

    case 'SET_FROM_TAILORED':
      return tailoredResumeToStateSlice(action.resume, action.sourceText)

    case 'SET_FROM_TEXT':
      return resumeTextToStateSlice(action.resumeText)

    case 'APPLY_REVISIONS': {
      const next = applyRevisionsToStateSlice(state, action.revisions)
      return withPhrasingAudit(next, action.jobDescription)
    }

    case 'MERGE_TAILORED': {
      const next = mergeTailoredResumeIntoStateSlice(state, action.resume, action.sourceText)
      return withPhrasingAudit(next, action.jobDescription ?? undefined)
    }

    case 'PATCH':
      return deepMergeResumeStateSlice(state, action.patch)

    case 'PATCH_TAILORED': {
      const next = tailoredResumeToStateSlice(action.resume, action.sourceText)
      return withPhrasingAudit(
        { ...next, appliedRevisions: state.appliedRevisions },
        action.jobDescription
      )
    }

    case 'PATCH_WORK_EXPERIENCE': {
      const workExperience = state.workExperience.map((node) =>
        node.blockKey === action.blockKey ? { ...node, ...action.patch, blockKey: node.blockKey, positionId: node.positionId } : node
      )
      const next = { ...state, workExperience }
      return withPhrasingAudit(next, action.jobDescription)
    }

    case 'PATCH_BULLET': {
      const workExperience = state.workExperience.map((node) => {
        if (node.blockKey !== action.blockKey) return node
        const bullets = [...node.bullets]
        if (action.bulletIndex >= 0 && action.bulletIndex < bullets.length) {
          bullets[action.bulletIndex] = action.text
        }
        return { ...node, bullets }
      })
      const next = { ...state, workExperience }
      return withPhrasingAudit(next, action.jobDescription)
    }

    case 'AUDIT_PHRASING':
      return withPhrasingAudit(state, action.jobDescription)

    default:
      return state
  }
}

export function stateSliceToTailoredResume(state: ResumeStateSlice): TailoredResume {
  return {
    contact: { ...state.contactInfo },
    summary: state.summary,
    skills: [...state.skills],
    experience: state.workExperience.map(({ blockKey: _blockKey, positionId: _positionId, ...entry }) => ({
      ...entry,
      bullets: [...entry.bullets],
    })),
    projects: state.projects.map(({ blockKey: _blockKey, positionId: _positionId, ...entry }) => ({
      ...entry,
      bullets: [...entry.bullets],
    })),
    education: [...state.education],
    certifications: [...state.certifications],
  }
}

/** Canonical payload for PDF/DOCX export — mirrors the live state slice exactly. */
export function buildDocumentExportPayload(state: ResumeStateSlice): ResumeDocument {
  const tailored = stateSliceToTailoredResume(state)
  return {
    contactInfo: tailored.contact,
    summary: tailored.summary,
    skills: tailored.skills,
    workExperience: tailored.experience,
    education: tailored.education,
    projects: tailored.projects ?? [],
    certifications: tailored.certifications ?? [],
  }
}

export function stateSliceToResumeText(state: ResumeStateSlice): string {
  return serializeTailoredResume(stateSliceToTailoredResume(state))
}

export function revisionsToAnchoredModifications(
  revisions: ResumeRevision[]
): StructuredSkillModification[] {
  return revisions.map((revision) => ({
    snippet: revision.snippet,
    positionId: revision.positionId,
    bulletIndex: revision.bulletIndex,
    originalBullet: revision.originalBullet,
    bulletLineIndex: revision.bulletLineIndex,
    modificationType: revision.modificationType,
  }))
}
