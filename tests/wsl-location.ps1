# Parses bootstrap and tests location helpers without installing or moving WSL.
$ErrorActionPreference = 'Stop'
$tokens = $null
$errors = $null
$bootstrap = Join-Path $PSScriptRoot '..\windows\bootstrap.ps1'
$ast = [System.Management.Automation.Language.Parser]::ParseFile($bootstrap, [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw ($errors | Out-String) }
$names = @('Resolve-WslInstallLocation', 'Assert-WslInstallLocation', 'Get-WslInstallArguments', 'Get-WslDriveOptions', 'Select-WslInstallLocation')
foreach ($name in $names) {
  $function = $ast.Find({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name }, $true)
  if (-not $function) { throw "Missing helper: $name" }
  . ([scriptblock]::Create($function.Extent.Text))
}
function Assert($condition, $message) { if (-not $condition) { throw $message } }
function Reject([scriptblock]$action) {
  $rejected = $false
  try { & $action | Out-Null } catch { $rejected = $true }
  Assert $rejected 'Expected rejection'
}
$root = Join-Path ([IO.Path]::GetTempPath()) ('wsl-location-test-' + [guid]::NewGuid())
try {
  New-Item -ItemType Directory -Path $root | Out-Null
  $drive = $env:SystemDrive.TrimEnd(':')
  $location = Resolve-WslInstallLocation $drive '' 'Ubuntu'
  Assert ($location -eq "${drive}:\WSL\Ubuntu") 'Drive expansion failed'
  Assert ($null -eq (Resolve-WslInstallLocation '' '' 'Ubuntu')) 'Default path changed'
  $folder = Join-Path $root 'Ubuntu with spaces'
  $location = Resolve-WslInstallLocation '' $folder 'Ubuntu'
  $arguments = @(Get-WslInstallArguments 'Ubuntu' $location '--install --location <path>')
  Assert ($arguments.Count -eq 6 -and $arguments[4] -eq '--location' -and $arguments[5] -eq $folder) 'Location must be a single argument'
  Assert (@(Get-WslInstallArguments 'Ubuntu' '' '').Count -eq 4) 'Default install needs no location support'
  Reject { Get-WslInstallArguments 'Ubuntu' $folder '--install --no-launch' }
  Reject { Resolve-WslInstallLocation $drive $folder 'Ubuntu' }
  Reject { Resolve-WslInstallLocation '' 'relative\Ubuntu' 'Ubuntu' }
  Reject { Resolve-WslInstallLocation '' '\\server\share\Ubuntu' 'Ubuntu' }
  Reject { Resolve-WslInstallLocation '' "${drive}:\" 'Ubuntu' }
  Reject { Resolve-WslInstallLocation '' "${drive}:\bad*path" 'Ubuntu' }
  New-Item -ItemType Directory -Path $folder | Out-Null
  Get-WslInstallArguments 'Ubuntu' $folder '--location' | Out-Null
  Set-Content -LiteralPath (Join-Path $folder 'keep.txt') -Value 'keep'
  Reject { Get-WslInstallArguments 'Ubuntu' $folder '--location' }
  Assert (Test-Path -LiteralPath (Join-Path $folder 'keep.txt')) 'Existing file changed'
  Assert-WslInstallLocation $folder ($folder.ToUpperInvariant() + '\')
  Assert-WslInstallLocation '' $folder
  Reject { Assert-WslInstallLocation $folder '' }
  Reject { Assert-WslInstallLocation $folder (Join-Path $root 'elsewhere') }
  Assert (@(Get-WslDriveOptions | Where-Object { $_.Drive -eq $drive }).Count -eq 1) 'System drive missing from menu'
  $script:menuDrive = $drive
  function Get-WslDriveOptions { [pscustomobject]@{ Drive = $script:menuDrive; FreeGB = 100 } }
  $script:answers = New-Object 'System.Collections.Generic.Queue[string]'
  function Read-Host($prompt) {
    if ($script:answers.Count -eq 0) { throw 'Unexpected prompt' }
    return $script:answers.Dequeue()
  }
  $script:answers.Enqueue('')
  $script:answers.Enqueue('bad')
  $script:answers.Enqueue('1')
  Assert ($null -eq (Select-WslInstallLocation 'Ubuntu' '' '' '')) 'Default menu selection failed'
  Assert ($script:answers.Count -eq 0) 'Blank input silently selected a default'
  $script:answers.Enqueue('2')
  Assert ((Select-WslInstallLocation 'Ubuntu' '' '' '') -eq "${drive}:\WSL\Ubuntu") 'Drive menu failed'
  $script:answers.Enqueue('3')
  $script:answers.Enqueue($folder)
  Assert ((Select-WslInstallLocation 'Ubuntu' '' '' '') -eq $folder) 'Custom menu failed'
  $script:answers.Enqueue('1')
  Assert ($null -eq (Select-WslInstallLocation 'Ubuntu' $folder '' '')) 'Keep existing failed'
  $script:answers.Enqueue('Q')
  Reject { Select-WslInstallLocation 'Ubuntu' '' '' '' }
  Assert ((Select-WslInstallLocation 'Ubuntu' '' $drive '') -eq "${drive}:\WSL\Ubuntu") 'Explicit selection unexpectedly prompted'
  [Console]::WriteLine('PASS: menu drives, default, empty/invalid retry, custom, existing, cancel, explicit selection')
  [Console]::WriteLine('PASS: default, drive, custom path, spaces, old WSL, invalid paths, nonempty target, existing location mismatch')
} finally { if (Test-Path -LiteralPath $root) { Remove-Item -LiteralPath $root -Recurse -Force } }
