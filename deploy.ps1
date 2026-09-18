# Deploy X-Ray to Cloudflare Pages (x-ray.jonbailey.xyz)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Public = Join-Path $Root "public"
$Project = "x-ray-jonbailey"

if (-not (Test-Path (Join-Path $Public "index.html"))) {
  Write-Error "Missing public/index.html"
}

Write-Host "[DEPLOY] X-Ray Pages project=$Project" -ForegroundColor Cyan
Push-Location $Root
try {
  npx --yes wrangler pages deploy $Public --project-name=$Project --commit-dirty=true
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  Pop-Location
}

Write-Host ""
Write-Host "Site:    https://x-ray.jonbailey.xyz/"
Write-Host "Preview: https://$Project.pages.dev/"
Write-Host "Signal:  https://xray-signal.jonbailey.xyz/"
Write-Host "Source:  $Root"
