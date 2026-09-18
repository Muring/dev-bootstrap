$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
foreach ($file in @('windows\app-host.ps1', 'windows\check-orca.ps1', 'windows\bootstrap.ps1')) {
  $tokens=$null; $errors=$null
  $ast=[System.Management.Automation.Language.Parser]::ParseFile((Join-Path $root $file),[ref]$tokens,[ref]$errors)
  if ($errors.Count) { throw ($errors | Out-String) }
  if ($file -eq 'windows\app-host.ps1') {
    foreach ($name in 'Quote-Argument','Decode-WslText','Invoke-Wsl','Get-WslLines','Test-WslComplete') {
      $function=$ast.Find({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name},$true)
      . ([scriptblock]::Create($function.Extent.Text))
    }
  }
}
if ((Quote-Argument 'D:\Linux Data\Ubuntu') -ne '"D:\Linux Data\Ubuntu"') { throw 'Space quoting failed' }
if ((Quote-Argument '') -ne '""') { throw 'Empty quoting failed' }
if ((Quote-Argument 'a"b') -ne '"a\"b"') { throw 'Quote escaping failed' }
if ((Quote-Argument 'C:\') -ne '"C:\\"') { throw 'Trailing backslash failed' }
Write-Host 'PASS: PowerShell parse and native argument quoting'
$korean="Linux용 Windows 하위 시스템이 설치되어 있지 않습니다. 'wsl.exe --install'을 사용하여 설치할 수 있습니다."
if ((Decode-WslText ([Text.Encoding]::Unicode.GetBytes($korean))) -cne $korean) { throw 'UTF-16LE wsl.exe message decoding failed' }
if ((Decode-WslText ([Text.Encoding]::UTF8.GetBytes("{`"gitName`":`"홍길동`"}"))) -cne "{`"gitName`":`"홍길동`"}") { throw 'UTF-8 Linux output decoding failed' }
if ((Decode-WslText ([byte[]]@())) -ne '') { throw 'Empty output decoding failed' }
$missing=Invoke-Wsl @('-d','no-such-distro-for-test','--','true')
if ($missing.ExitCode -eq 0 -or ($missing.Output+$missing.Error) -match "`0" -or ($missing.Output+$missing.Error).Trim().Length -eq 0) { throw 'wsl.exe error capture failed' }
Write-Host 'PASS: wsl.exe UTF-16LE and Linux UTF-8 output decode without NUL residue'
$complete=Test-WslComplete
if (-not $complete.Complete -or $complete.Version -notmatch '^\d+\.\d+\.\d+') { throw ('WSL completeness check failed on a machine with WSL: ' + ($complete | ConvertTo-Json -Compress)) }
Write-Host ('PASS: installed Store WSL reports complete, version ' + $complete.Version)
$temp=Join-Path ([IO.Path]::GetTempPath()) ('bootstrap-host-test-'+[guid]::NewGuid())
New-Item -ItemType Directory -Path $temp | Out-Null
try {
  $request=Join-Path $temp 'request.json'; $result=Join-Path $temp 'result.json'
  [IO.File]::WriteAllText($request,'{"action":"inspect"}',(New-Object Text.UTF8Encoding $false))
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'windows\app-host.ps1') -RequestFile $request -ResultFile $result
  if ($LASTEXITCODE -ne 0) { throw 'Inspection failed' }
  $data=Get-Content -LiteralPath $result -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($null -eq $data.supported -or $null -eq $data.distros -or $null -eq $data.drives) { throw 'Inspection schema missing' }
  Write-Host 'PASS: real Windows read-only inspection and JSON transport'
  $distro=@($data.distros | Where-Object { $_.name -eq 'Ubuntu' })
  if ($distro.Count -gt 0) {
    $name=(& wsl.exe -d Ubuntu -- id -un | Out-String).Trim()
    $script=Join-Path $temp 'argument test.sh'
    $body='#!/bin/bash' + "`n" + 'set -eu' + "`n" + 'python3 -c ''import json,sys; from pathlib import Path; Path(sys.argv[1]).write_text(json.dumps(sys.argv[2:],ensure_ascii=False))'' "$(dirname "$0")/args.json" "$@"' + "`n"
    [IO.File]::WriteAllText($script,$body,(New-Object Text.UTF8Encoding $false))
    $linuxScript=(& wsl.exe -d Ubuntu -u $name -- wslpath -a $script | Out-String).Trim()
    $arguments=@('space here','quote " here','$(not-a-command)','C:\trailing\','', '홍 길동')
    $launch=@{action='launch';config=@{distro='Ubuntu';user=$name};script=$linuxScript;arguments=$arguments}
    [IO.File]::WriteAllText($request,($launch | ConvertTo-Json -Depth 8),(New-Object Text.UTF8Encoding $false))
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'windows\app-host.ps1') -RequestFile $request -ResultFile $result
    if ($LASTEXITCODE -ne 0) { throw 'Launch helper failed' }
    $launchResult=Get-Content -LiteralPath $result -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($launchResult.exitCode -ne 0) { throw ('WSL launch exit '+$launchResult.exitCode) }
    $received=Get-Content -LiteralPath (Join-Path $temp 'args.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($received.Count -ne $arguments.Count) { throw 'Argument count differs' }
    for ($i=0;$i -lt $arguments.Count;$i++) { if ($received[$i] -cne $arguments[$i]) { throw "Argument $i differs: $($received[$i])" } }
    Write-Host 'PASS: visible WSL launch preserves spaces, quotes, empty args, Korean and literal shell syntax'
  }

  # Home-PC scenario: the inbox wsl.exe stub (WSL not installed) prints a UTF-16LE message on stderr and fails.
  # CreateProcess resolves an unqualified name from the process working directory before System32, so a stub
  # placed there stands in for the real wsl.exe for app-host.ps1 and its children.
  $stubDir=Join-Path $temp 'stub'; New-Item -ItemType Directory -Path $stubDir | Out-Null
  $stubSource='using System; using System.Text; class Program { static int Main(string[] a) { var m = "Linux\uC6A9 Windows \uD558\uC704 \uC2DC\uC2A4\uD15C\uC774 \uC124\uCE58\uB418\uC5B4 \uC788\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. ''wsl.exe --install''\uC744 \uC0AC\uC6A9\uD558\uC5EC \uC124\uCE58\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.\r\n"; var b = new UnicodeEncoding(false, false).GetBytes(m); var e = Console.OpenStandardError(); e.Write(b, 0, b.Length); e.Flush(); return 1; } }'
  Add-Type -TypeDefinition $stubSource -OutputType ConsoleApplication -OutputAssembly (Join-Path $stubDir 'wsl.exe') -Language CSharp
  # PowerShell starts native children in $PWD, while .NET Process.Start uses the process directory: set both.
  $savedDirectory=[Environment]::CurrentDirectory
  try {
    Push-Location $stubDir; [Environment]::CurrentDirectory=$stubDir
    $stub=Invoke-Wsl @('--status')
    if ($stub.ExitCode -eq 0 -or $stub.Error -notmatch 'wsl.exe --install' -or $stub.Error -match "`0") { throw 'Stub wsl.exe was not used or its message did not decode' }
    [IO.File]::WriteAllText($request,'{"action":"inspect"}',(New-Object Text.UTF8Encoding $false))
    Remove-Item -LiteralPath $result -ErrorAction SilentlyContinue
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'windows\app-host.ps1') -RequestFile $request -ResultFile $result
    if ($LASTEXITCODE -ne 0) { throw 'Inspection with the WSL stub failed instead of reporting WSL as not ready' }
    $stubData=Get-Content -LiteralPath $result -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($stubData.wslReady -ne $false -or $stubData.locationSupported -ne $false -or $stubData.PSObject.Properties['error']) { throw ('Stub inspection result unexpected: ' + (ConvertTo-Json $stubData -Compress)) }
    [IO.File]::WriteAllText($request,'{"action":"install","config":{"distro":"Ubuntu","user":"tester","installLocation":""}}',(New-Object Text.UTF8Encoding $false))
    Remove-Item -LiteralPath $result -ErrorAction SilentlyContinue
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'windows\app-host.ps1') -RequestFile $request -ResultFile $result
    $installData=Get-Content -LiteralPath $result -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($LASTEXITCODE -eq 0 -or $installData.error -notmatch 'Complete WSL preparation first') { throw ('Install did not refuse on incomplete WSL: ' + (ConvertTo-Json $installData -Compress)) }
  } finally { Pop-Location; [Environment]::CurrentDirectory=$savedDirectory }
  Write-Host 'PASS: WSL-not-installed stub yields a clean not-ready inspection and blocks Ubuntu install'

  [IO.File]::WriteAllText($request,'{"action":"not-an-action"}',(New-Object Text.UTF8Encoding $false))
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'windows\app-host.ps1') -RequestFile $request -ResultFile $result
  if ($LASTEXITCODE -eq 0) { throw 'Unknown action accepted' }
  Write-Host 'PASS: unknown helper action rejected'
} finally { Remove-Item -LiteralPath $temp -Recurse -Force }
