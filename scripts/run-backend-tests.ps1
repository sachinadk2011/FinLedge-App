$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$venvPython = Join-Path $repoRoot 'venv\Scripts\python.exe'
$pythonCommand = if (Test-Path -LiteralPath $venvPython) { $venvPython } else { 'python' }
$runName = 'backend-' + (Get-Date -Format 'yyyyMMdd-HHmmssfff') + '-' + [guid]::NewGuid().ToString('N').Substring(0, 8)
$runRoot = Join-Path $repoRoot (Join-Path '.pytest-artifacts\runs' $runName)

New-Item -ItemType Directory -Path $runRoot -Force | Out-Null
Push-Location $repoRoot
try {
    $testSelection = @($args)
    if ($testSelection.Count -eq 0) {
        $testSelection = @('backend/tests')
    }
    & $pythonCommand -m pytest $testSelection --basetemp $runRoot
    $testExitCode = $LASTEXITCODE
}
finally {
    Pop-Location
}

exit $testExitCode
