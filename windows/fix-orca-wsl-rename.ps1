# Applies the verified Orca 1.4.202 archive delta; no downloads or app termination.
[CmdletBinding()]
param(
  [string]$AppDir = (Join-Path $env:LOCALAPPDATA 'Programs\orca'),
  [switch]$Restore
)
$ErrorActionPreference = 'Stop'
try {
  $manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'patches\orca-1.4.202-wsl-rename.json') -Raw | ConvertFrom-Json
  $target = Join-Path $AppDir 'resources\app.asar'
  $backup = "$target.bootstrap-wsl-rename.original"
  if (-not (Test-Path -LiteralPath $target)) {
    throw 'Orca is not installed at this path. Install Orca, then rerun setup (or pass -AppDir).'
  }
  function Hash($path) { (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() }
  $current = Hash $target
  $desired = if ($Restore) { $manifest.originalSha256 } else { $manifest.patchedSha256 }
  $expected = if ($Restore) { $manifest.patchedSha256 } else { $manifest.originalSha256 }
  if ($current -eq $desired) { Write-Host 'Orca WSL rename: checksum verified; already in desired state.'; exit 0 }
  if ($current -ne $expected) {
    throw 'Unsupported Orca archive. Only the verified 1.4.202 build is supported; review this version before patching.'
  }
  $temp = "$target.bootstrap-$([guid]::NewGuid().ToString('N')).tmp"
  try {
    if ($Restore) {
      if (-not (Test-Path -LiteralPath $backup) -or (Hash $backup) -ne $desired) { throw 'Verified backup is missing.' }
      Copy-Item -LiteralPath $backup -Destination $temp
    } else {
      if (Test-Path -LiteralPath $backup) {
        if ((Hash $backup) -ne $expected) { throw 'Existing backup checksum mismatch.' }
      } else {
        [System.IO.File]::Copy($target, $backup, $false)
      }
      if ((Hash $backup) -ne $expected) { throw 'Backup verification failed.' }
      $bytes = [System.IO.File]::ReadAllBytes($backup)
      $stream = [System.IO.File]::Open($temp, [System.IO.FileMode]::CreateNew)
      try {
        $cursor = 0
        foreach ($edit in $manifest.edits) {
          $stream.Write($bytes, $cursor, [int]$edit.offset - $cursor)
          $replacement = [System.Text.Encoding]::UTF8.GetBytes([string]$edit.text)
          $stream.Write($replacement, 0, $replacement.Length)
          $cursor = [int]$edit.offset + [int]$edit.remove
        }
        $stream.Write($bytes, $cursor, $bytes.Length - $cursor)
      } finally { $stream.Dispose() }
    }
    if ((Hash $temp) -ne $desired) { throw 'Generated archive checksum mismatch.' }
    if ((Hash $target) -ne $expected) { throw 'Orca changed during patching. Rerun after the update finishes.' }
    # Windows PowerShell 5.1 needs NullString instead of $null here.
    [System.IO.File]::Replace($temp, $target, [System.Management.Automation.Language.NullString]::Value)
    if ((Hash $target) -ne $desired) { throw 'Installed archive verification failed.' }
    Write-Host 'Orca WSL rename: applied and checksum verified. Reopen Orca. Backup retained beside app.asar.'
  } finally {
    if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp }
  }
} catch {
  Write-Host "Orca WSL rename incomplete: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host 'If Orca is running, close it completely and rerun setup. The installer does not close active work.'
  exit 1
}
