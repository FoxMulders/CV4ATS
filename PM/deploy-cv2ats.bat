@echo off
setlocal EnableExtensions

rem Repo root = parent of PM\ (works from any drive, user, or cwd)
cd /d "%~dp0.." || (
  echo ERROR: Could not change to repo root from "%~dp0".
  exit /b 1
)

where git >nul 2>&1 || (
  echo ERROR: git is not on PATH.
  exit /b 1
)
where npm >nul 2>&1 || (
  echo ERROR: npm is not on PATH.
  exit /b 1
)

if not exist "package.json" (
  echo ERROR: package.json not found in "%CD%" — wrong directory?
  exit /b 1
)

set "COMMIT_MSG=%~1"
if not defined COMMIT_MSG set "COMMIT_MSG=Fix experience parsing when section stop precedes work experience heading"

set "REVIEWER=%~2"
if not defined REVIEWER set "REVIEWER=%USERNAME%"

rem Optional: deploy-cv2ats.bat "message" reviewer --skip-qa
set "SKIP_QA=0"
if /i "%~3"=="--skip-qa" set "SKIP_QA=1"
if /i "%~2"=="--skip-qa" (
  set "SKIP_QA=1"
  set "REVIEWER=%USERNAME%"
)

echo.
echo === Deploy cv2ats ===
echo Repo: %CD%
echo.

if "%SKIP_QA%"=="1" (
  echo [1/4] Local QA verification... SKIPPED ^(--skip-qa^)
  goto :git_stage
)

echo [1/4] Local QA verification ^(smoke tests^)...
call npm run qa:verify -- --reviewer "%REVIEWER%" --approve-all
if errorlevel 1 (
  echo ERROR: QA verification failed. Fix issues before deploying.
  exit /b 1
)

:git_stage
echo.
echo [2/4] Git stage and commit...
git add -A
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "%COMMIT_MSG%"
  if errorlevel 1 (
    echo ERROR: git commit failed.
    exit /b 1
  )
) else (
  echo Nothing to commit; working tree already clean.
)

echo.
echo [3/4] Git push...
git push
if errorlevel 1 (
  echo ERROR: git push failed.
  exit /b 1
)

echo.
echo [4/4] Wait for Vercel build and promote to production...
call npm run qa:promote -- --wait-for-head
if errorlevel 1 (
  echo ERROR: Vercel promote failed.
  exit /b 1
)

echo.
echo Deploy cv2ats completed successfully.
endlocal
exit /b 0
