# Session handoff — ATS Resume Builder

> **Agent rule:** Update this file at the end of every session (or before handoff). Keep baseline, goal, blockers, and next action accurate.

## Baseline
- Branch: `main` (synced with `origin/main`)
- Last pushed commit: `4532609` — Deploy cv2ats
- Local WIP: `lib/resume/parse-experience-blocks.ts`, `lib/resume/resume-text-normalize.test.ts` (section-stop parsing fix — uncommitted)

## Goal
Reliable one-shot deploy from Windows: local QA → commit (if needed) → push → wait for Vercel build on current HEAD → promote to production.

## Deploy pipeline (current)
| Step | Command / script |
|------|------------------|
| One-shot (Windows) | `PM\deploy-cv2ats.bat` [commit message] [reviewer name] |
| Verify (deploy gate) | `npm run qa:verify -- --reviewer "Name" --approve-all` — smoke tests only |
| Verify (+ lint) | `npm run qa:verify -- --reviewer "Name" --full` |
| Skip QA in batch | `PM\deploy-cv2ats.bat "message" reviewer --skip-qa` |
| Promote only | `npm run qa:promote` or `npm run qa:promote -- --wait-for-head` |

`deploy-cv2ats.bat` resolves repo root from `%~dp0..` (no hardcoded path), fails fast on missing git/npm, runs QA before git, skips commit when clean, and passes `--wait-for-head` after push so promote targets the new build—not an older READY deployment.

Default commit message in the batch file matches the current WIP (override by passing a message as arg 1).

## Files in scope (deploy slice)
- `PM/deploy-cv2ats.bat`
- `scripts/qa-promote.ts` (`--wait-for-head` polls Vercel by `githubCommitSha`)
- `scripts/qa-verify.ts` (smoke by default; `--full` adds lint)
- `package.json` (`qa:promote`, `qa:verify` scripts)

## Do not touch
- `components/**`, `app/api/**` unless explicitly asked
- Resume parser beyond current section-stop fix unless explicitly asked

## Blockers
- `npm run qa:verify -- --full` fails on pre-existing ESLint errors in UI/hooks (28 errors); deploy batch uses smoke-only verify by default

## Parser work (this session)
- **Fix:** `parseWorkAndProjectsFromLines` no longer breaks on `SECTION_STOP` headings (e.g. Skills) before entering Work Experience; only stops after parsing has started in a relevant section.
- **Test:** `resume-text-normalize.test.ts` — round-trip brad fixture through serialize → parse; asserts 2 experience blocks with bullets.
- `npx tsx --test lib/resume/resume-text-normalize.test.ts` — 6/6 pass
- `npx tsx --test lib/resume/deterministic-resume-parser.test.ts` — 11/11 pass
- `npm run smoke:parse-brad` — passing on `main`

## Decisions
- QA runs **before** commit/push (do not ship failing smoke/lint)
- Vercel promote waits for **current git HEAD** SHA when deploying via batch file
- `main` may auto-deploy to production; promote then no-ops with “already production” (expected)

## Next action
1. Deploy parser fix: `PM\deploy-cv2ats.bat` (default message baked in) or pass a custom message
2. Or run smoke/verify manually first: `npm run qa:verify -- --reviewer "%USERNAME%" --approve-all`

## How to start the next chat
```
@PM/session-handoff.md

Task: [deploy parser fix | other — say if commit/deploy OK]
```
