$ErrorActionPreference = "Stop"

$Root = Resolve-Path "$PSScriptRoot\.."
$WebPath = Join-Path $Root "apps\paygauge-web"

if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) {
	throw "Node.js was not found on PATH. Install Node.js before building Android."
}

if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
	throw "npm was not found on PATH. Install Node.js before building Android."
}

if (-not $env:JAVA_HOME -or -not (Test-Path (Join-Path $env:JAVA_HOME "bin\java.exe"))) {
	$AndroidStudioJava = Join-Path ${env:ProgramFiles} "Android\Android Studio\jbr"
	if (Test-Path (Join-Path $AndroidStudioJava "bin\java.exe")) {
		$env:JAVA_HOME = $AndroidStudioJava
		Write-Host "Using Android Studio bundled JDK at $env:JAVA_HOME"
	} else {
		throw "JAVA_HOME must point to a JDK installation before building Android."
	}
}

if (-not (Test-Path (Join-Path $Root "node_modules"))) {
	throw "Dependencies are not installed. Run npm.cmd install from the repository root first."
}

Remove-Item Env:\CAPACITOR_SERVER_URL -ErrorAction SilentlyContinue

Push-Location $WebPath
try {
	npm.cmd run build
	if ($LASTEXITCODE -ne 0) {
		throw "The Next.js build failed. Android assets were not synced."
	}
	if (-not (Test-Path (Join-Path $WebPath "out"))) {
		throw "The Next.js build did not create apps/paygauge-web/out."
	}
	npx.cmd cap sync android
	if ($LASTEXITCODE -ne 0) {
		throw "Capacitor Android sync failed."
	}
} finally {
	Pop-Location
}

Write-Host "PayGauge Android project synced with bundled app assets from apps/paygauge-web/out."
