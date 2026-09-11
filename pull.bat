@echo off
REM ============================================================
REM  pull.bat — sync this folder with the latest on GitHub.
REM  Sets aside local edits to tracked files, pulls, restores.
REM  (It never touches untracked files, so it can't delete
REM   itself or any other loose files in the folder.)
REM ============================================================

REM Always run from the folder this script lives in.
cd /d "%~dp0"
setlocal EnableExtensions EnableDelayedExpansion

REM Make sure we're inside a git repo.
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo.
  echo  This folder is not a git repository.
  echo  Clone it first with:
  echo      git clone https://github.com/zacriel/zachsbullshit.git
  echo.
  pause
  exit /b 1
)

REM Detect the current branch name.
for /f "delims=" %%b in ('git rev-parse --abbrev-ref HEAD') do set "branch=%%b"

REM Do we have local edits to TRACKED files that would block a pull?
set "stashed="
git diff --quiet
if errorlevel 1 set "stashed=1"
git diff --cached --quiet
if errorlevel 1 set "stashed=1"

if defined stashed (
  echo  Setting aside your local edits...
  git stash push -m "pull.bat auto-stash"
)

echo.
echo  Pulling latest from origin/%branch%...
git pull origin %branch%
if errorlevel 1 (
  echo.
  echo  Pull failed ^(check your connection or sign-in^).
  if defined stashed (
    echo  Your local edits are safe in a stash: run  git stash pop
  )
  pause
  exit /b 1
)

if defined stashed (
  echo.
  echo  Restoring your local edits...
  git stash pop
  if errorlevel 1 (
    echo.
    echo  Your edits clashed with the update and need a manual merge.
    echo  They are still saved: run  git stash list  to find them.
    pause
    exit /b 1
  )
)

echo.
echo  Done - you're up to date.
pause
