/** Collapse redundant skills like "Scope" when "Scope management" is present. */
export function dedupeSkills(skills: string[]): string[] {
  const normalized = skills.map((skill) => skill.trim()).filter(Boolean)
  const result: string[] = []

  for (const skill of normalized) {
    const key = skill.toLowerCase()
    const dominated = result.some((existing) => {
      const existingKey = existing.toLowerCase()
      if (existingKey === key) return true
      if (existingKey.includes(key) && existingKey.length > key.length + 2) return true
      if (key.includes(existingKey) && key.length > existingKey.length + 2) return false
      return false
    })
    if (dominated) continue
    const subsetIndex = result.findIndex((existing) => {
      const existingKey = existing.toLowerCase()
      return key.includes(existingKey) && key.length > existingKey.length + 2
    })
    if (subsetIndex >= 0) {
      result[subsetIndex] = skill
      continue
    }
    if (!result.some((existing) => existing.toLowerCase() === key)) {
      result.push(skill)
    }
  }

  return result
}
