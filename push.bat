@echo off
REM ============================================================
REM  push.bat — stage, commit, and push in one step.
REM  Only asks for the commit message; figures out the rest.
REM ============================================================

REM Always run from the folder this script lives in.
cd /d "%~dp0"

REM Make sure we're inside a git repo with a remote set.
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo.
  echo  This folder is not a git repository yet.
  echo  Set it up once with:
  echo      git init
  echo      git remote add origin https://github.com/^<you^>/^<repo^>.git
  echo.
  pause
  exit /b 1
)

REM Ask for the commit message.
echo.
set "msg="
set /p "msg=Commit message: "
if not defined msg (
  echo No message entered - nothing done.
  pause
  exit /b 1
)

echo.
echo  Staging changes...
git add -A

echo  Committing...
git commit -m "%msg%"

REM Detect the current branch name.
for /f "delims=" %%b in ('git rev-parse --abbrev-ref HEAD') do set "branch=%%b"

echo  Pushing to origin/%branch%...
REM -u sets the upstream on the first push and is harmless afterward.
git push -u origin %branch%
if errorlevel 1 (
  echo.
  echo  Push failed. Common causes:
  echo    - no "origin" remote set  ^(git remote add origin ...^)
  echo    - not signed in to GitHub
  echo.
  pause
  exit /b 1
)

echo.
echo  Done.
pause
