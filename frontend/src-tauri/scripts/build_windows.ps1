# Build Snowan for Windows (PyInstaller backend + Tauri NSIS/MSI installer).
# Run on a Windows machine with: Node, Rust (MSVC), uv, and WebView2 available.
#
#   pwsh frontend/src-tauri/scripts/build_windows.ps1
#
# Output: frontend/src-tauri/target/release/bundle/nsis/*.exe (and msi/*.msi)
$ErrorActionPreference = 'Stop'

$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$SrcTauri   = Resolve-Path (Join-Path $ScriptDir '..')
$FrontendDir = Resolve-Path (Join-Path $SrcTauri '..')
$RepoRoot   = Resolve-Path (Join-Path $FrontendDir '..')
$BackendDir = Join-Path $RepoRoot 'backend'
$Spec       = Join-Path $ScriptDir 'snowan-backend.spec'
$Dist       = Join-Path $RepoRoot 'dist'

Write-Host '== Step 1: PyInstaller backend ==' -ForegroundColor Cyan
Push-Location $BackendDir
uv sync
uv pip install "pyinstaller>=6.0.0" "pyinstaller-hooks-contrib>=2024.9"
uv run python -m PyInstaller "$Spec" --distpath (Join-Path $Dist 'pyinstaller') --workpath (Join-Path $Dist 'pyinstaller-build') --clean --noconfirm
Pop-Location

$BundleSrc = Join-Path $Dist 'pyinstaller\snowan-backend'
$BundleExe = Join-Path $BundleSrc 'snowan-backend.exe'
if (-not (Test-Path $BundleExe)) { throw "backend exe not found at $BundleExe" }

Write-Host '== Step 2: stage backend into Tauri resources ==' -ForegroundColor Cyan
$Dest = Join-Path $SrcTauri 'binaries\snowan-backend'
if (Test-Path $Dest) { Remove-Item -Recurse -Force $Dest }
New-Item -ItemType Directory -Force -Path (Split-Path $Dest) | Out-Null
Copy-Item -Recurse -Force $BundleSrc $Dest

Write-Host '== Step 3: Tauri build (NSIS + MSI) ==' -ForegroundColor Cyan
Push-Location $FrontendDir
npm ci
npm run tauri:build
Pop-Location

Write-Host ''
Write-Host 'Build complete. Installers:' -ForegroundColor Green
Get-ChildItem (Join-Path $SrcTauri 'target\release\bundle\nsis\*.exe'), (Join-Path $SrcTauri 'target\release\bundle\msi\*.msi') -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "  $($_.FullName)" }
