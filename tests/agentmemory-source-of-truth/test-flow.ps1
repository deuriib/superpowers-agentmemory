#!/usr/bin/env pwsh
# Wrapper: run test-flow.sh with Git Bash on Windows.
# Locates Git Bash, runs the bash test script, and forwards its exit code.
$ErrorActionPreference = 'Stop'

$bashCandidates = @(
    'C:\Program Files\Git\bin\bash.exe',
    'C:\Program Files\Git\usr\bin\bash.exe'
)

$bash = $null
foreach ($candidate in $bashCandidates) {
    if (Test-Path -LiteralPath $candidate) {
        $bash = $candidate
        break
    }
}

if (-not $bash) {
    $cmd = Get-Command bash -ErrorAction SilentlyContinue
    if ($cmd) {
        $bash = $cmd.Source
    }
}

if (-not $bash) {
    Write-Error "Git Bash not found. Install Git for Windows (https://git-scm.com/download/win) or add bash.exe to your PATH, then re-run this wrapper."
}

$scriptPath = Join-Path $PSScriptRoot 'test-flow.sh'
if (-not (Test-Path -LiteralPath $scriptPath)) {
    Write-Error "test-flow.sh not found at $scriptPath"
}

& $bash $scriptPath
$code = $LASTEXITCODE
if ($null -eq $code) {
    $code = 1
}
exit $code