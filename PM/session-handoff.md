# Session handoff — ATS Resume Builder

## Baseline
- Branch: `main` (synced with `origin/main`)
- Last pushed commit: `db4a959` — Harden resume parsing with defensive section regex and identity lock.
- Local WIP: uncommitted changes under `lib/resume/` and `lib/api/` (role boundary parser refactor)

## Goal
Extract shared role-boundary parsing into `role-boundary-parser.ts`, wire it through experience parsing/normalization, and get all deterministic parser tests + `smoke:parse-brad` green again.

## Files in scope
- `lib/resume/role-boundary-parser.ts` (new — title/company/date line detection)
- `lib/resume/parse-experience-blocks.ts` (uses role boundary parser; ghost employer handling)
- `lib/resume/deterministic-resume-parser.test.ts` (new/updated tests for markdown role headers + projects)
- `lib/api/normalize-generation-draft.ts` (experience normalization path)
- `lib/resume/experience-matrix-guard.ts` (matrix guard alignment)
- `lib/ai/resume-block-schema-directive.ts` (schema directive tweak)

## Do not touch
- `components/**` (UI) unless explicitly asked
- `app/api/**` routes unless parsing/normalization bug requires it
- Billing, export, hiring-panel, browser-AI layers — out of scope for this slice

## Blockers
- `npm run smoke:parse-brad` crashes: `ReferenceError: isRealExperienceBullet is not defined` in `lib/api/normalize-generation-draft.ts:26` (missing import after refactor)
- `npx tsx --test lib/resume/deterministic-resume-parser.test.ts` — **3 failing / 8 passing**:
  1. `parseResumeDeterministic isolates personal projects from work experience` — `parsed.projects.length >= 2` is false (PopUpHub / Tipsy Fox not isolated)
  2. `parseResumeTextToTailoredResume delegates to deterministic engine` — same projects isolation failure
  3. `explodeFlattenedExperienceEntries splits markdown role headers hijacked as bullets` — first entry company is `'Present'` instead of Pleasant Solutions (markdown `### Title — Company` bullets not exploding correctly)

## Decisions
- Role demarcation lives in `lib/resume/role-boundary-parser.ts` (`ROLE_BOUNDARY_LINE_PATTERN`, `parseRoleBoundaryLine`, `isGhostConsolidatedEmployer`)
- Deterministic parser is source of truth for source-resume structure; AI enrichment must not merge employers
- Personal projects must stay in `projects[]`, never bleed into `work_experience`
- Markdown role headers (`### Title — Company`) inside bullet lists must explode into separate experience entries
- Local-only by default: do not commit or deploy unless explicitly asked

## Next action
1. Fix missing `isRealExperienceBullet` import in `normalize-generation-draft.ts`
2. Fix `explodeFlattenedExperienceEntries` / role-boundary parsing so markdown-flattened fixtures split into Pleasant Solutions + AMA (not a single "Consultant — Independent" blob)
3. Restore personal-project section detection so Brad fixture yields ≥2 projects (PopUpHub, Tipsy Fox)
4. Re-run: `npx tsx --test lib/resume/deterministic-resume-parser.test.ts` and `npm run smoke:parse-brad`

## How to start the next chat
```
@PM/session-handoff.md

Task: [pick one next action above — local only, no commit]
```
