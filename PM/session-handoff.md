# Session handoff — ATS Resume Builder

> **Agent rule:** Update this file at the end of every session (or before handoff). Keep baseline, goal, blockers, and next action accurate.

## Baseline
- Branch: `main` (synced with `origin/main`)
- Last pushed commit: `d831d5c` — Fixes
- Local WIP: `package.json` (+ `qa:promote` / `qa:verify` scripts), `scripts/qa-promote.ts`, `scripts/qa-verify.ts`, `PM/deploy-cv2ats.bat` (deploy pipeline hardening — uncommitted)

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

## Files in scope (deploy slice)
- `PM/deploy-cv2ats.bat`
- `scripts/qa-promote.ts` (`--wait-for-head` polls Vercel by `githubCommitSha`)
- `scripts/qa-verify.ts` (smoke by default; `--full` adds lint)
- `package.json` (`qa:promote`, `qa:verify` scripts)

## Do not touch
- `components/**`, `app/api/**` unless explicitly asked
- Resume parser refactor WIP in `lib/resume/` unless that task is resumed

## Blockers
- `npm run qa:verify -- --full` fails on pre-existing ESLint errors in UI/hooks (28 errors); deploy batch uses smoke-only verify by default
- Commit deploy pipeline WIP when ready

## Prior parser work (paused)
- `npm run smoke:parse-brad` — passing on `main`
- `deterministic-resume-parser.test.ts` may still have failing cases (projects isolation, markdown role headers) — run `npx tsx --test lib/resume/deterministic-resume-parser.test.ts` if resuming

## Decisions
- QA runs **before** commit/push (do not ship failing smoke/lint)
- Vercel promote waits for **current git HEAD** SHA when deploying via batch file
- `main` may auto-deploy to production; promote then no-ops with “already production” (expected)

## Next action
1. Commit deploy pipeline files when satisfied: `PM/deploy-cv2ats.bat`, `scripts/qa-*.ts`, `package.json`, this handoff
2. Run `PM\deploy-cv2ats.bat "your message"` once to validate end-to-end
3. Or resume parser work: fix `isRealExperienceBullet` import and re-run deterministic parser tests

## How to start the next chat
```
@PM/session-handoff.md

Task: [deploy validation | parser fix | other — say if commit/deploy OK]
```
