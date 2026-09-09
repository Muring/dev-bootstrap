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

# Windows 사용자명은 공백·대문자·한글이 들어갈 수 있어 리눅스 사용자명으로 못 쓴다.
$User = ($User.ToLower() -replace '[^a-z0-9_-]', '')
if ($User -notmatch '^[a-z_][a-z0-9_-]{0,31}$') {
  throw "리눅스 사용자명으로 쓸 수 없다: '$User'. -User <이름> 으로 직접 준다."
}

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
  # cloud-init 은 '#cloud-config' 가 첫 바이트여야 한다.
  # Set-Content -Encoding UTF8 은 PowerShell 5.1 에서 BOM 을 붙여 이 검사를 깬다.
  # sudo NOPASSWD: cloud-init 사용자는 비밀번호가 없어 이게 없으면 sudo 자체가 막힌다.
  $userData = @"
#cloud-config
users:
  - name: $User
    groups: [adm, sudo]
    sudo: ALL=(ALL) NOPASSWD:ALL
    shell: /bin/bash

"@ -replace "`r`n", "`n"
  $ciPath = Join-Path $ciDir "$Distro.user-data"
  [System.IO.File]::WriteAllText($ciPath, $userData,
    (New-Object System.Text.UTF8Encoding $false))

  $head = [System.IO.File]::ReadAllBytes($ciPath)[0..2] -join ' '
  if ($head -eq '239 187 191') { throw "user-data 에 BOM 이 붙었다. cloud-init 이 무시한다." }
  Ok "$Distro.user-data 작성 (BOM 없음 확인)"

  Step "$Distro 설치"
  wsl.exe --install --no-launch -d $Distro
  if ($LASTEXITCODE -ne 0) {
    Warn "WSL 기능이 방금 켜졌을 수 있다. 재부팅 후 이 스크립트를 다시 실행한다."
    exit 1
  }
  wsl.exe -d $Distro -- true    # 첫 부팅 → cloud-init 실행
  if ($LASTEXITCODE -ne 0) { throw "$Distro 첫 부팅에 실패했다 (exit $LASTEXITCODE)." }
  Ok "$Distro 설치 및 초기화"

  # cloud-init 이 조용히 무시되면 여기서 드러난다. 다음 단계로 넘기지 않는다.
  wsl.exe -d $Distro -- id -u $User 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "cloud-init 이 사용자 '$User' 를 만들지 못했다. " +
          "'wsl -d $Distro' 로 직접 들어가 사용자를 만든 뒤 linux/setup.sh 를 돌린다."
  }
  Ok "사용자 '$User' 확인"
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
# setup.sh 는 검증에 실패하면 0 이 아닌 코드로 끝난다. 그걸 확인하지 않으면
# 리눅스 쪽이 반쯤 실패했는데 Windows 는 "완료" 라고 말한다.
if ($LASTEXITCODE -ne 0) {
  Warn "setup.sh 가 실패했다 (exit $LASTEXITCODE)."
  Warn "로그: \\wsl.localhost\$Distro\home\$User\dev-bootstrap-setup.log"
  Warn "고친 뒤 다시 돌린다: wsl -d $Distro -u $User -- bash ~/dev-bootstrap/linux/setup.sh"
  exit $LASTEXITCODE
}

Write-Host "`n완료. 남은 것: claude / codex login / gh auth login / Orca 계정 로그인" -ForegroundColor Cyan
