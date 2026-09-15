param(
    [string]$HostIp,
    [switch]$NoInstall,
    [switch]$NoOpenAndroid
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path "$PSScriptRoot\.."
$ApiPath = Join-Path $Root "apps\api"
$WebPath = Join-Path $Root "apps\paygauge-web"

function Get-LanIp {
    $addresses = Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object {
            $_.IPAddress -notlike "127.*" -and
            $_.IPAddress -notlike "169.254.*" -and
            $_.PrefixOrigin -ne "WellKnown"
        } |
        Sort-Object InterfaceMetric |
        Select-Object -ExpandProperty IPAddress

    if (-not $addresses) {
        throw "Could not detect a LAN IPv4 address. Re-run with -HostIp 192.168.x.x"
    }

    return $addresses[0]
}

if (-not $HostIp) {
    $HostIp = Get-LanIp
}

$ApiUrl = "http://$HostIp`:8000"
$WebUrl = "http://$HostIp`:3000"
$VenvPython = Join-Path $ApiPath ".venv\Scripts\python.exe"

if (-not $NoInstall) {
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
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
"@

$WebCommand = @"
Set-Location '$Root'
`$env:NEXT_PUBLIC_API_URL = '$ApiUrl'
npm --workspace apps/paygauge-web run dev -- -H 0.0.0.0
"@

Write-Host "Starting PayGauge API for phone access at $ApiUrl ..."
Start-Process powershell -ArgumentList @("-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $ApiCommand)

Write-Host "Starting PayGauge web UI for phone access at $WebUrl ..."
Start-Process powershell -ArgumentList @("-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $WebCommand)

Write-Host "Syncing Capacitor Android to $WebUrl ..."
Push-Location $WebPath
$env:CAPACITOR_SERVER_URL = $WebUrl
npx cap sync android
if (-not $NoOpenAndroid) {
    npx cap open android
}
Pop-Location

Write-Host "PayGauge phone dev server: $WebUrl"
Write-Host "FastAPI phone dev server: $ApiUrl"
Write-Host "Your phone and computer must be on the same Wi-Fi network."
