# Builds the embedded runtime blob: app/bundles -> app/src-tauri/embedded/runtime.7z
# Layout inside the archive (must match runtime.rs expectations):
#   ruffle/            - self-hosted Ruffle player
#   projectors/        - Director projector skeletons
#   ffmpeg.exe         - for FLV -> MP4 transcoding
#   trilha.mp3         - menu music (at root, NOT under audio/)
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$bundles = Join-Path $root "bundles"
$embeddedDir = Join-Path $root "src-tauri\embedded"
$out = Join-Path $embeddedDir "runtime.7z"
$tmp = Join-Path $env:TEMP "runtime_stage"

$sevenZip = "C:\Program Files\7-Zip\7z.exe"
if (-not (Test-Path $sevenZip)) { throw "7-Zip not found at $sevenZip" }

foreach ($p in @("$bundles\ruffle", "$bundles\projectors", "$bundles\runtime\ffmpeg.exe")) {
    if (-not (Test-Path $p)) { throw "missing bundle path: $p" }
}
if (-not (Test-Path "$bundles\audio\trilha.mp3")) { throw "missing bundles\audio\trilha.mp3" }

# stage the exact layout
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
New-Item -ItemType Directory -Path $tmp | Out-Null
Copy-Item "$bundles\ruffle" "$tmp\ruffle" -Recurse
Copy-Item "$bundles\projectors" "$tmp\projectors" -Recurse
Copy-Item "$bundles\runtime\ffmpeg.exe" "$tmp\ffmpeg.exe"
Copy-Item "$bundles\audio\trilha.mp3" "$tmp\trilha.mp3"

New-Item -ItemType Directory -Path $embeddedDir -Force | Out-Null
& $sevenZip a -t7z -mx=5 -m0=LZMA2 -mmt=on $out "$tmp\*" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "7z failed with exit $LASTEXITCODE" }

Remove-Item $tmp -Recurse -Force
$sz = (Get-Item $out).Length / 1MB
Write-Host "runtime.7z written: $([math]::Round($sz, 1)) MB"
