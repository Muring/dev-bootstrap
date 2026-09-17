[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$RequestFile, [Parameter(Mandatory=$true)][string]$ResultFile)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false
function Write-Result($value) {
  $json = ConvertTo-Json -InputObject $value -Depth 12 -Compress
  $tmp = "$ResultFile.tmp"
  [IO.File]::WriteAllText($tmp, $json, (New-Object System.Text.UTF8Encoding $false))
  Move-Item -LiteralPath $tmp -Destination $ResultFile -Force
}
function Report-Progress([string]$Label, [int]$Completed=-1, [int]$Total=0) {
  $event = @{label=$Label}
  if ($Completed -ge 0 -and $Total -gt 0) { $event.completed=$Completed; $event.total=$Total; $event.unit='items' }
  [IO.File]::AppendAllText("$ResultFile.progress.jsonl", ((ConvertTo-Json $event -Compress)+"`n"), (New-Object System.Text.UTF8Encoding $false))
}
# Windows command-line quoting for ProcessStartInfo / Start-Process; no shell evaluation.
function Quote-Argument([string]$Value) {
  # WSL parses its option prefix itself; quoted switches are treated as a shell command.
  if ($Value -match '^[A-Za-z0-9_./:=+-]+$') { return $Value }
  return '"' + ([regex]::Replace(([regex]::Replace($Value, '(\\*)"', '$1$1\"')), '(\\+)$', '$1$1')) + '"'
}
function Start-Native($Program, [string[]]$Arguments, [switch]$Wait, [switch]$Elevate) {
  $params = @{ FilePath=$Program; ArgumentList=(($Arguments | ForEach-Object { Quote-Argument $_ }) -join ' '); PassThru=$true }
  if ($Wait) { $params.Wait = $true }
  if ($Elevate) { $params.Verb = 'RunAs' }
  return Start-Process @params
}
function Native($Arguments) {
  & wsl.exe @Arguments
  if ($LASTEXITCODE -ne 0) { throw "WSL command failed: exit $LASTEXITCODE" }
}
try {
  $request = Get-Content -LiteralPath $RequestFile -Raw -Encoding UTF8 | ConvertFrom-Json
  switch ($request.action) {
    'inspect' {
      Report-Progress 'Windows 버전과 지원 환경 확인' 0 4
      $build = [int](Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion').CurrentBuildNumber
      Report-Progress 'WSL 준비 상태와 지원 기능 확인' 1 4
      $help = ((& wsl.exe --help 2>&1) -join "`n") -replace "`0", ''
      $ready = $false
      & wsl.exe --status *> $null
      if ($LASTEXITCODE -eq 0) { $ready = $true }
      Report-Progress 'Ubuntu 배포판과 저장 공간 확인' 2 4
      $distros = @()
      $key = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Lxss'
      if (Test-Path $key) {
        foreach ($entry in Get-ChildItem $key) {
          $distros += @{ name=[string]$entry.GetValue('DistributionName'); location=([string]$entry.GetValue('BasePath') -replace '^\\\\\?\\', ''); version=[int]$entry.GetValue('Version') }
        }
      }
      $drives = @([IO.DriveInfo]::GetDrives() | Where-Object { $_.IsReady -and $_.DriveType -eq 'Fixed' } | ForEach-Object { @{ root=$_.Name; freeGB=[math]::Round($_.AvailableFreeSpace / 1GB, 1) } })
      Report-Progress 'Orca 설치 상태와 패치 호환성 확인' 3 4
      $archive = Join-Path $env:LOCALAPPDATA 'Programs\orca\resources\app.asar'
      $supported = $false; $patched = $false
      if (Test-Path -LiteralPath $archive) {
        $manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'patches\orca-1.4.202-wsl-rename.json') -Raw | ConvertFrom-Json
        $hash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
        $patched = $hash -eq $manifest.patchedSha256
        $supported = $patched -or $hash -eq $manifest.originalSha256
      }
      Report-Progress 'Windows 검사 완료' 4 4
      Write-Result @{ supported=($build -ge 22000 -and [Environment]::Is64BitOperatingSystem -and $env:PROCESSOR_ARCHITECTURE -ne 'ARM64' -and $env:PROCESSOR_ARCHITEW6432 -ne 'ARM64'); windowsBuild=$build; wslReady=$ready; locationSupported=($help -match '--location\b'); distros=$distros; drives=$drives; orcaInstalled=(Test-Path -LiteralPath $archive); patchSupported=$supported; patchApplied=$patched }
    }
    'prepare' {
      Report-Progress 'Windows 관리자 권한 승인 대기'
      # Only this narrowly scoped helper is elevated; distro/user operations stay unelevated.
      $childRequest = "$RequestFile.system.json"
      [IO.File]::WriteAllText($childRequest, '{"action":"system"}', (New-Object System.Text.UTF8Encoding $false))
      $process = Start-Native 'powershell.exe' @('-NoProfile','-ExecutionPolicy','Bypass','-File', $PSCommandPath, '-RequestFile', $childRequest, '-ResultFile', $ResultFile) -Wait -Elevate
      if (-not (Test-Path -LiteralPath $ResultFile)) { throw "WSL preparation failed: $($process.ExitCode)" }
    }
    'system' {
      Report-Progress 'WSL 시스템 구성 설치 · Windows 처리 대기'
      & wsl.exe --install --no-distribution
      $installCode = $LASTEXITCODE
      if ($installCode -eq 3010 -or $installCode -eq 1641) { Write-Result @{reboot=$true}; break }
      if ($installCode -ne 0) { throw "WSL installation failed ($installCode). Review the terminal output; reboot if requested." }
      Report-Progress 'WSL 구성 요소 다운로드 및 업데이트'
      & wsl.exe --update
      if ($LASTEXITCODE -ne 0) { throw 'WSL update failed. Review the terminal output and retry.' }
      & wsl.exe --status *> $null
      Write-Result @{ reboot=($LASTEXITCODE -ne 0); prepared=$true }
    }
    'install' {
      Report-Progress 'Ubuntu 설치 대상과 사용자 확인'
      $config = $request.config
      if ($config.distro -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]*$' -or $config.user -notmatch '^[a-z_][a-z0-9_-]{0,31}$' -or $config.user -eq 'root') { throw 'Invalid distro/user' }
      $installed = @((& wsl.exe -l -q 2>$null) -replace "`0", '' | ForEach-Object { $_.Trim() })
      if ($installed -contains $config.distro) {
        Native @('-d',$config.distro,'-u',$config.user,'--exec','id','-u')
        Write-Result @{ installed=$true; existing=$true }; break
      }
      if ($config.distro -ne 'Ubuntu') { throw 'New installations support Ubuntu only. Select an existing Ubuntu distribution or use Ubuntu.' }
      $location = [string]$config.installLocation
      $arguments = @('--install','--no-launch','-d','Ubuntu')
      if ($location) {
        if ($location -notmatch '^[A-Za-z]:\\.+' -or $location -match '[<>"|?*]' -or $location.Substring(2).Contains(':')) { throw 'Invalid install path' }
        $full = [IO.Path]::GetFullPath($location).TrimEnd('\')
        if ($full -eq [IO.Path]::GetPathRoot($full).TrimEnd('\')) { throw 'Choose a dedicated folder' }
        if (-not (Test-Path ([IO.Path]::GetPathRoot($full)))) { throw 'Drive does not exist' }
        if ((Test-Path -LiteralPath $full) -and (-not (Test-Path -LiteralPath $full -PathType Container) -or @(Get-ChildItem -LiteralPath $full -Force).Count -gt 0)) { throw 'Target folder must be empty' }
        Report-Progress 'WSL 저장 위치 기능 확인'
      $help = ((& wsl.exe --help) -join "`n") -replace "`0", ''
        if ($help -notmatch '--location\b') { throw 'Update WSL before selecting a custom location' }
        $arguments += @('--location',$full)
      }
      $ciDir = Join-Path $env:USERPROFILE '.cloud-init'
      New-Item -ItemType Directory -Force -Path $ciDir | Out-Null
      $ci = Join-Path $ciDir 'Ubuntu.user-data'
      if (Test-Path -LiteralPath $ci) { Copy-Item -LiteralPath $ci -Destination "$ci.bak.$([DateTime]::UtcNow.Ticks)" }
      $data = "#cloud-config`nusers:`n  - name: $($config.user)`n    groups: [adm, sudo]`n    sudo: ALL=(ALL) NOPASSWD:ALL`n    shell: /bin/bash`n"
      [IO.File]::WriteAllText($ci, $data, (New-Object System.Text.UTF8Encoding $false))
      Native @('--set-default-version','2')
      Report-Progress 'Ubuntu 다운로드 및 배포판 등록 · WSL 처리 대기'
      Native $arguments
      Report-Progress 'Ubuntu 초기화와 개발 계정 생성 대기'
      Native @('-d','Ubuntu','-u','root','--exec','cloud-init','status','--wait')
      Native @('-d','Ubuntu','-u',$config.user,'--exec','id','-u')
      Report-Progress 'Ubuntu 기본 사용자와 설치 위치 검증'
      # Configure default user, preserving existing wsl.conf keys.
      $script = Join-Path $PSScriptRoot '..\linux\wsl-config.py'
      $linuxScript = (& wsl.exe -d Ubuntu -- wslpath -a $script | Out-String).Trim()
      Native @('-d','Ubuntu','-u','root','--exec','python3',$linuxScript,$config.user)
      if ($location) {
        $actual = Get-ChildItem 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Lxss' | Where-Object { $_.GetValue('DistributionName') -eq 'Ubuntu' } | ForEach-Object { [string]$_.GetValue('BasePath') }
        $actual = ($actual -replace '^\\\\\?\\', '').TrimEnd('\')
        if ($actual -ine $full) { throw "Installed location differs: $actual" }
      }
      Write-Result @{installed=$true; restartWsl=$true}
    }
    'launch' {
      Report-Progress 'Ubuntu 실행 창에서 작업 중 · 입력 요청은 해당 창에서 진행하세요.'
      $config = $request.config
      $arguments = @('-d',[string]$config.distro,'-u',[string]$config.user,'--exec','bash',[string]$request.script) + @($request.arguments | ForEach-Object { [string]$_ })
      $process = Start-Native 'wsl.exe' $arguments -Wait
      Write-Result @{exitCode=$process.ExitCode}
    }
    'shutdown' { Native @('--shutdown'); Write-Result @{stopped=$true} }
    'reboot' { & shutdown.exe /r /t 30; if ($LASTEXITCODE -ne 0) { throw 'Reboot request failed' }; Write-Result @{reboot=$true} }
    default { throw 'Unknown helper action' }
  }
} catch {
  Write-Result @{error=$_.Exception.Message}
  exit 1
}
