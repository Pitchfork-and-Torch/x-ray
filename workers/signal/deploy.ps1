# Deploy X-Ray Shared Reality signaling Worker (xray-signal.jonbailey.xyz)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "[DEPLOY] xray-signal Worker" -ForegroundColor Cyan
Push-Location $Root
try {
  npx --yes wrangler deploy
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  Pop-Location
}

Write-Host ""
Write-Host "Signal:  https://xray-signal.jonbailey.xyz/"
Write-Host "Health:  https://xray-signal.jonbailey.xyz/health"
