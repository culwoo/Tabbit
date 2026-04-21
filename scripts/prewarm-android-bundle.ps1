param(
  [string]$MetroUrl = "http://localhost:8081"
)

$ErrorActionPreference = "Stop"

$manifestUrl = "${MetroUrl}?platform=android"
$headers = @{
  Accept = "application/expo+json,application/json"
}

Write-Host "Prewarming Android manifest: $manifestUrl"
$manifest = Invoke-RestMethod -UseBasicParsing -Headers $headers -Uri $manifestUrl -TimeoutSec 30

if (-not $manifest.launchAsset -or -not $manifest.launchAsset.url) {
  throw "Expo manifest did not include launchAsset.url"
}

$bundleUrl = [string]$manifest.launchAsset.url
Write-Host "Prewarming Android bundle: $bundleUrl"
$response = Invoke-WebRequest -UseBasicParsing -Uri $bundleUrl -TimeoutSec 180
Write-Host "Android bundle ready: $($response.RawContentLength) bytes"
