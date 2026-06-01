import type { TailoredResume } from '@/lib/ai/schemas'

function experienceLabel(entry: TailoredResume['experience'][number], index: number): string {
  return entry.company?.trim() || entry.title?.trim() || `Role ${index + 1}`
}

/** Describe the most specific user edit detected between two tailored resume snapshots. */
export function describeTailoredResumeEdit(
  previous: TailoredResume | null,
  next: TailoredResume
): string {
  if (!previous) {
    const bulletCount = next.experience.reduce(
      (sum, entry) => sum + (entry.bullets?.length ?? 0),
      0
    )
    return `LOG: User modified tailored resume (${next.experience.length} experience blocks, ${bulletCount} bullets)`
  }

  if (previous.summary !== next.summary) {
    return 'LOG: User modified professional summary'
  }

  if (JSON.stringify(previous.skills) !== JSON.stringify(next.skills)) {
    return 'LOG: User modified skills section'
  }

  if (JSON.stringify(previous.certifications) !== JSON.stringify(next.certifications)) {
    return 'LOG: User modified certifications'
  }

  if ((previous.contact?.name ?? '') !== (next.contact?.name ?? '')) {
    return 'LOG: User modified contact name'
  }

  if ((previous.contact?.email ?? '') !== (next.contact?.email ?? '')) {
    return 'LOG: User modified contact email'
  }

  if ((previous.contact?.phone ?? '') !== (next.contact?.phone ?? '')) {
    return 'LOG: User modified contact phone'
  }

  if ((previous.contact?.location ?? '') !== (next.contact?.location ?? '')) {
    return 'LOG: User modified contact location'
  }

  if (next.experience.length > previous.experience.length) {
    const added = next.experience[next.experience.length - 1]
    return `LOG: User added experience block under ${experienceLabel(added!, next.experience.length - 1)}`
  }

  if (next.experience.length < previous.experience.length) {
    return 'LOG: User removed an experience block'
  }

  for (let jobIndex = 0; jobIndex < next.experience.length; jobIndex += 1) {
    const prevJob = previous.experience[jobIndex]
    const nextJob = next.experience[jobIndex]
    if (!prevJob || !nextJob) continue

    const label = experienceLabel(nextJob, jobIndex)

    for (let bulletIndex = 0; bulletIndex < (nextJob.bullets?.length ?? 0); bulletIndex += 1) {
      const prevBullet = prevJob.bullets?.[bulletIndex]
      const nextBullet = nextJob.bullets?.[bulletIndex]
      if (prevBullet !== nextBullet) {
        return `LOG: User modified bullet ${bulletIndex + 1} under ${label}`
      }
    }

    if ((prevJob.bullets?.length ?? 0) !== (nextJob.bullets?.length ?? 0)) {
      return `LOG: User changed bullet count under ${label}`
    }

    if (prevJob.title !== nextJob.title) {
      return `LOG: User modified job title under ${label}`
    }

    if (prevJob.company !== nextJob.company) {
      return `LOG: User modified company under ${label}`
    }

    if (prevJob.location !== nextJob.location) {
      return `LOG: User modified location under ${label}`
    }

    if (prevJob.startDate !== nextJob.startDate || prevJob.endDate !== nextJob.endDate) {
      return `LOG: User modified dates under ${label}`
    }
  }

  const bulletCount = next.experience.reduce(
    (sum, entry) => sum + (entry.bullets?.length ?? 0),
    0
  )
  return `LOG: User modified tailored resume (${next.experience.length} experience blocks, ${bulletCount} bullets)`
}
