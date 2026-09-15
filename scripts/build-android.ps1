$ErrorActionPreference = "Stop"

$Root = Resolve-Path "$PSScriptRoot\.."
$WebPath = Join-Path $Root "apps\paygauge-web"

Remove-Item Env:\CAPACITOR_SERVER_URL -ErrorAction SilentlyContinue

Push-Location $WebPath
npm run build
npx cap sync android
Pop-Location

Write-Host "PayGauge Android project synced with bundled app assets from apps/paygauge-web/out."
