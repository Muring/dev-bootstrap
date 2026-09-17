param([switch]$Patched)
$ErrorActionPreference = 'Stop'
try {
  $manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'patches\orca-1.4.202-wsl-rename.json') -Raw | ConvertFrom-Json
  $archive = Join-Path $env:LOCALAPPDATA 'Programs\orca\resources\app.asar'
  if (-not (Test-Path -LiteralPath $archive)) { exit 1 }
  $hash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($hash -eq $manifest.patchedSha256) { exit 0 }
  if (-not $Patched -and $hash -eq $manifest.originalSha256) { exit 0 }
  exit 1
} catch { exit 1 }
