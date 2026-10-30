$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\\..")).Path
$pythonExe = Join-Path $repoRoot "venv\\Scripts\\python.exe"
$entryScript = Join-Path $repoRoot "backend\\engine_main.py"
$transferDirectionRules = Join-Path $repoRoot "backend\\services\\transfer_direction_rules.json"
$distDir = Join-Path $repoRoot "desktop\\build\\sidecar"
$workDir = Join-Path $repoRoot "desktop\\build\\pyinstaller-work"
$specDir = Join-Path $repoRoot "desktop\\build\\pyinstaller-spec"
$versionGenerator = Join-Path $PSScriptRoot "generate-sidecar-version.py"

if (-not (Test-Path $pythonExe)) {
    throw "Python virtual environment not found at $pythonExe"
}

if (-not (Test-Path $entryScript)) {
    throw "Backend launcher not found at $entryScript"
}

if (-not (Test-Path $transferDirectionRules)) {
    throw "Transfer direction rules not found at $transferDirectionRules"
}

Remove-Item $distDir -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item $workDir -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item $specDir -Recurse -Force -ErrorAction SilentlyContinue

New-Item -ItemType Directory -Force -Path $distDir | Out-Null
New-Item -ItemType Directory -Force -Path $workDir | Out-Null
New-Item -ItemType Directory -Force -Path $specDir | Out-Null
$versionInfoPath = Join-Path $specDir "finledge-engine-version.txt"
& $pythonExe $versionGenerator --project-root $repoRoot --output $versionInfoPath
if ($LASTEXITCODE -ne 0) {
    throw "Could not generate the FinLedge sidecar version resource."
}

& $pythonExe -m PyInstaller `
    --noconfirm `
    --clean `
    --onedir `
    --name finledge-engine `
    --exclude-module matplotlib `
    --exclude-module numpy `
    --exclude-module PIL `
    --exclude-module tkinter `
    --distpath $distDir `
    --workpath $workDir `
    --specpath $specDir `
    --version-file $versionInfoPath `
    --paths $repoRoot `
    --add-data "$transferDirectionRules;backend/services" `
    $entryScript

if ($LASTEXITCODE -ne 0) {
    throw "PyInstaller build failed."
}

$enginePath = Join-Path $distDir "finledge-engine\finledge-engine.exe"
if (-not (Test-Path $enginePath)) {
    throw "Expected sidecar executable not found at $enginePath"
}

Write-Host "Built Python sidecar: $enginePath"
