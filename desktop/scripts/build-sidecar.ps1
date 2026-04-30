$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\\..")).Path
$pythonExe = Join-Path $repoRoot "venv\\Scripts\\python.exe"
$entryScript = Join-Path $repoRoot "backend\\engine_main.py"
$distDir = Join-Path $repoRoot "desktop\\build\\sidecar"
$workDir = Join-Path $repoRoot "desktop\\build\\pyinstaller-work"
$specDir = Join-Path $repoRoot "desktop\\build\\pyinstaller-spec"

if (-not (Test-Path $pythonExe)) {
    throw "Python virtual environment not found at $pythonExe"
}

if (-not (Test-Path $entryScript)) {
    throw "Backend launcher not found at $entryScript"
}

Remove-Item $distDir -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item $workDir -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item $specDir -Recurse -Force -ErrorAction SilentlyContinue

New-Item -ItemType Directory -Force -Path $distDir | Out-Null
New-Item -ItemType Directory -Force -Path $workDir | Out-Null
New-Item -ItemType Directory -Force -Path $specDir | Out-Null

& $pythonExe -m PyInstaller `
    --noconfirm `
    --clean `
    --onefile `
    --name finledge-engine `
    --distpath $distDir `
    --workpath $workDir `
    --specpath $specDir `
    --paths $repoRoot `
    --collect-submodules backend `
    $entryScript

if ($LASTEXITCODE -ne 0) {
    throw "PyInstaller build failed."
}

$enginePath = Join-Path $distDir "finledge-engine.exe"
if (-not (Test-Path $enginePath)) {
    throw "Expected sidecar executable not found at $enginePath"
}

Write-Host "Built Python sidecar: $enginePath"
