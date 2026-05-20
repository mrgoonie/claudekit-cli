<#
.SYNOPSIS
  Clean-state ClaudeKit install + Codex migration smoke harness for Windows (i9-bootcamp).

.DESCRIPTION
  Nukes ~/.claude and ~/.codex, installs the CLI (npm channel OR a local tarball for
  pre-merge branch testing), installs the engineer kit (npm release OR a local --kit-path
  for branch testing), optionally runs `ck migrate -a codex -g -y`, then prints a
  diagnostic summary: how many hooks wired in Claude settings.json, how many in Codex
  hooks.json, and whether config.toml carries the codex hooks feature flag.

  Post-merge usage (npm dev channel):
    powershell -File reset-i9bootcamp-test.ps1

  Pre-merge usage (test a branch build):
    powershell -File reset-i9bootcamp-test.ps1 -CliTarball C:\tmp\claudekit-cli.tgz -KitPath C:\tmp\eng-kit

.PARAMETER CliChannel
  npm dist-tag to install when -CliTarball is not given. Default: dev.

.PARAMETER CliTarball
  Path to a local `npm pack` .tgz to install instead of an npm channel (branch testing).

.PARAMETER KitRelease
  Engineer kit release tag to install (e.g. v2.19.1-beta.7). Ignored when -KitPath given.

.PARAMETER KitPath
  Path to a local engineer kit root (a directory containing `claude/`) for branch testing.
  Uses `ck init --kit-path`.

.PARAMETER SkipMigrate
  Skip the `ck migrate -a codex -g -y` step.
#>
param(
  [string]$CliChannel = "dev",
  [string]$CliTarball = "",
  [string]$KitRelease = "",
  [string]$KitPath = "",
  [switch]$SkipMigrate
)

$ErrorActionPreference = "Stop"

function Section($t) { Write-Host ""; Write-Host "=== $t ===" -ForegroundColor Cyan }

Section "Cleaning state"
Remove-Item -Recurse -Force "$HOME\.claude" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$HOME\.codex"  -ErrorAction SilentlyContinue
Write-Host "Removed ~/.claude and ~/.codex"

Section "Installing CLI"
npm uninstall -g claudekit-cli 2>$null | Out-Null
if ($CliTarball) {
  if (-not (Test-Path $CliTarball)) { throw "CliTarball not found: $CliTarball" }
  Write-Host "Installing CLI from local tarball: $CliTarball"
  npm i -g $CliTarball
} else {
  Write-Host "Installing claudekit-cli@$CliChannel from npm"
  npm i -g "claudekit-cli@$CliChannel"
}

Section "ck --version"
ck --version

Section "Installing engineer kit"
$initArgs = @("init", "-g", "--kit", "engineer", "-y", "--skip-setup")
if ($KitPath) {
  if (-not (Test-Path $KitPath)) { throw "KitPath not found: $KitPath" }
  Write-Host "Installing engineer kit from local path: $KitPath"
  $initArgs += @("--kit-path", $KitPath)
} elseif ($KitRelease) {
  $initArgs += @("--release", $KitRelease)
}
& ck @initArgs

if (-not $SkipMigrate) {
  Section "Migrating to Codex"
  ck migrate -a codex -g -y
}

Section "Diagnostic summary"

function Count-Hooks($jsonPath) {
  if (-not (Test-Path $jsonPath)) { return $null }
  $obj = Get-Content $jsonPath -Raw | ConvertFrom-Json
  if (-not $obj.hooks) { return 0 }
  $n = 0
  foreach ($evt in $obj.hooks.PSObject.Properties) {
    foreach ($group in $evt.Value) {
      if ($group.hooks) { $n += $group.hooks.Count } else { $n += 1 }
    }
  }
  return $n
}

$claudeSettings = "$HOME\.claude\settings.json"
$claudeCount = Count-Hooks $claudeSettings
if ($null -eq $claudeCount) { Write-Host "Claude settings.json: MISSING" -ForegroundColor Red }
else { Write-Host "Claude hooks wired: $claudeCount" }

# List the actual Claude hook commands for eyeballing
if (Test-Path $claudeSettings) {
  $s = Get-Content $claudeSettings -Raw | ConvertFrom-Json
  foreach ($evt in $s.hooks.PSObject.Properties) {
    foreach ($group in $evt.Value) {
      foreach ($h in $group.hooks) {
        Write-Host ("  [{0}] {1}" -f $evt.Name, $h.command)
      }
    }
  }
}

$codexHooks = "$HOME\.codex\hooks.json"
$codexCount = Count-Hooks $codexHooks
if ($null -eq $codexCount) { Write-Host "Codex hooks.json: MISSING" -ForegroundColor Red }
else { Write-Host "Codex hooks wired: $codexCount" }

$codexToml = "$HOME\.codex\config.toml"
if (Test-Path $codexToml) {
  $hasFlag = Select-String -Path $codexToml -Pattern "hooks\s*=\s*true|codex_hooks\s*=\s*true" -Quiet
  Write-Host "config.toml hooks feature flag: $hasFlag"
} else {
  Write-Host "config.toml: MISSING" -ForegroundColor Red
}

Section "Done"
Write-Host "Next: run the manual hook-fire check from tools/smoke-i9bootcamp-codex-hooks.md"
