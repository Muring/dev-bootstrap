<#
.SYNOPSIS
  새 Windows PC 에 WSL2 + Ubuntu 를 올리고 리눅스 쪽 setup.sh 까지 실행한다.
.NOTES
  관리자 권한이 필요하다(wsl --install). WSL 기능이 처음 켜지는 PC 는 재부팅이 한 번 낀다.
#>
[CmdletBinding()]
param(
  [string]$User   = $env:USERNAME.ToLower(),
  [string]$Distro = 'Ubuntu',
  [string]$Repo   = 'https://github.com/Muring/dev-bootstrap.git'
)

$ErrorActionPreference = 'Stop'
function Step($m) { Write-Host "`n==> $m" -ForegroundColor Cyan }
function Ok($m)   { Write-Host "    OK  $m" -ForegroundColor Green }
function Warn($m) { Write-Host "    !   $m" -ForegroundColor Yellow }

$admin = ([Security.Principal.WindowsPrincipal] `
  [Security.Principal.WindowsIdentity]::GetCurrent()
).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) { throw "관리자 권한 PowerShell 에서 실행한다." }

# ---------------------------------------------------------------- WSL
Step "WSL / $Distro"
$installed = (wsl.exe -l -q 2>$null) -replace "`0","" | ForEach-Object { $_.Trim() }
if ($installed -contains $Distro) {
  Ok "$Distro 이미 설치됨"
} else {
  # cloud-init 을 첫 부팅 전에 깔아둬야 사용자명/비밀번호 대화형 프롬프트가 뜨지 않는다.
  Step "cloud-init (무인 사용자 생성)"
  $ciDir = Join-Path $env:USERPROFILE '.cloud-init'
  New-Item -ItemType Directory -Force -Path $ciDir | Out-Null
  @"
#cloud-config
users:
  - name: $User
    groups: [adm, sudo]
    sudo: ALL=(ALL) NOPASSWD:ALL
    shell: /bin/bash
"@ | Set-Content -Encoding UTF8 -NoNewline (Join-Path $ciDir "$Distro.user-data")
  Ok "$Distro.user-data 작성"

  Step "$Distro 설치"
  wsl.exe --install --no-launch -d $Distro
  if ($LASTEXITCODE -ne 0) {
    Warn "WSL 기능이 방금 켜졌을 수 있다. 재부팅 후 이 스크립트를 다시 실행한다."
    exit 1
  }
  wsl.exe -d $Distro -- true    # 첫 부팅 → cloud-init 실행
  Ok "$Distro 설치 및 초기화"
}

# ---------------------------------------------------------------- Orca
Step "Orca"
$orcaExe = Join-Path $env:LOCALAPPDATA 'Programs\orca\resources\bin\orca.exe'
if (Test-Path $orcaExe) {
  Ok "이미 설치됨"
} else {
  # Orca 는 winget 패키지가 아니라 배포용 인스톨러다. 링크는 배포처에서 받는다.
  Warn "Orca 미설치 — 설치 후 WSL 터미널을 한 번 열면 ~/.local/bin/orca-ide 브리지가 생긴다."
}

# ---------------------------------------------------------------- 리눅스 쪽
Step "$Distro 안에서 setup.sh 실행"
$sh = @"
set -e
if [ -d ~/dev-bootstrap/.git ]; then git -C ~/dev-bootstrap pull --ff-only -q
else git clone -q $Repo ~/dev-bootstrap; fi
bash ~/dev-bootstrap/linux/setup.sh
"@ -replace "`r`n","`n"
wsl.exe -d $Distro -u $User -- bash -lc $sh

Write-Host "`n완료. 남은 것: claude / codex login / gh auth login / Orca 계정 로그인" -ForegroundColor Cyan
