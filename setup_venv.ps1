# setup_venv.ps1
# Create a Python virtual environment and install backend dependencies.

$ErrorActionPreference = "Stop"

$venvPath = "venv"
$requirementsPath = "requirements.txt"

$pythonExe = $null
if (Get-Command py -ErrorAction SilentlyContinue) {
    $pythonExe = "py"
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    $pythonExe = "python"
} elseif (Get-Command python3 -ErrorAction SilentlyContinue) {
    $pythonExe = "python3"
}

if (-not $pythonExe) {
    $fallback = Get-ChildItem -Path "$env:LOCALAPPDATA\\Programs\\Python" -Filter python.exe -Recurse -ErrorAction SilentlyContinue |
        Select-Object -First 1 -ExpandProperty FullName

    if ($fallback) {
        $pythonExe = $fallback
        Write-Host "Using Python found at: $pythonExe" -ForegroundColor Yellow
    } else {
        Write-Host "Python launcher not found. Install Python or add it to PATH (try: 'py' or 'python')." -ForegroundColor Red
        exit 1
    }
}

if (-not (Test-Path $venvPath)) {
    Write-Host "Creating virtual environment at '$venvPath'..."
    & $pythonExe -m venv $venvPath
} else {
    Write-Host "Virtual environment already exists at '$venvPath'."
}

Write-Host "Activating virtual environment..."
& ".\\$venvPath\\Scripts\\Activate.ps1"

if (Test-Path $requirementsPath) {
    Write-Host "Installing packages from '$requirementsPath'..."
    & ".\\$venvPath\\Scripts\\python.exe" -m pip install --upgrade pip
    & ".\\$venvPath\\Scripts\\python.exe" -m pip install -r $requirementsPath
} else {
    Write-Host "requirements.txt not found. No packages installed." -ForegroundColor Yellow
}

Write-Host "Setup complete! Your virtual environment is ready to use." -ForegroundColor Green
Write-Host "To deactivate later, type: deactivate"
