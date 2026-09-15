param(
    [switch]$NoInstall,
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path "$PSScriptRoot\.."
$ApiPath = Join-Path $Root "apps\api"
$WebUrl = "http://localhost:3000/loans"

function Test-Command($Name) {
    return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

if (-not (Test-Command "python")) {
    throw "Python was not found on PATH. Install Python, then run this script again."
}

if (-not (Test-Command "npm")) {
    throw "npm was not found on PATH. Install Node.js, then run this script again."
}

if (-not $NoInstall) {
    $VenvPython = Join-Path $ApiPath ".venv\Scripts\python.exe"
    if (-not (Test-Path $VenvPython)) {
        Write-Host "Creating API virtual environment..."
        Push-Location $ApiPath
        python -m venv .venv
        Pop-Location
    }

    Write-Host "Installing API dependencies..."
    & $VenvPython -m pip install -r (Join-Path $ApiPath "requirements.txt")

    if (-not (Test-Path (Join-Path $Root "node_modules"))) {
        Write-Host "Installing web dependencies..."
        Push-Location $Root
        npm install
        Pop-Location
    }
}

$ApiCommand = @"
Set-Location '$ApiPath'
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
"@

$WebCommand = @"
Set-Location '$Root'
npm run dev:web
"@

Write-Host "Starting PayGauge API on http://localhost:8000 ..."
Start-Process powershell -ArgumentList @("-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $ApiCommand)

Write-Host "Starting PayGauge web UI on http://localhost:3000 ..."
Start-Process powershell -ArgumentList @("-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $WebCommand)

if (-not $NoBrowser) {
    Start-Process $WebUrl
}

Write-Host "PayGauge is starting. Open $WebUrl after Next.js finishes compiling."
