param(
  [string]$Output = "public/assets/dota",
  [switch]$Force
)

$ErrorActionPreference = "Stop"
$cdn = "https://cdn.cloudflare.steamstatic.com"
$api = "https://api.opendota.com/api/constants"
$heroDir = Join-Path $Output "heroes"
$itemDir = Join-Path $Output "items"
$dataDir = Join-Path $Output "data"
New-Item -ItemType Directory -Force $heroDir, $itemDir, $dataDir | Out-Null

function Save-Asset([string]$Url, [string]$Path) {
  if ((Test-Path $Path) -and -not $Force) { return }
  try {
    Invoke-WebRequest -Uri $Url -OutFile $Path -UseBasicParsing
    Write-Host "OK  $Path"
  } catch {
    Write-Warning "Skip $Url ($($_.Exception.Message))"
  }
}

Write-Host "Fetching current OpenDota constants..."
$heroes = Invoke-RestMethod "$api/heroes"
$items = Invoke-RestMethod "$api/items"
$heroes | ConvertTo-Json -Depth 20 | Set-Content (Join-Path $dataDir "heroes.json") -Encoding UTF8
$items | ConvertTo-Json -Depth 20 | Set-Content (Join-Path $dataDir "items.json") -Encoding UTF8

foreach ($property in $heroes.PSObject.Properties) {
  $hero = $property.Value
  $key = $hero.name -replace '^npc_dota_hero_', ''
  $remote = if ($hero.img) { "$cdn$($hero.img)" } else { "$cdn/apps/dota2/images/dota_react/heroes/$key.png" }
  Save-Asset $remote (Join-Path $heroDir "$key.png")
}

foreach ($property in $items.PSObject.Properties) {
  $item = $property.Value
  if (-not $item.img) { continue }
  Save-Asset "$cdn$($item.img)" (Join-Path $itemDir "$($property.Name).png")
}

Write-Host "Done. Assets saved under $Output"
