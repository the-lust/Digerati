param(
    [Parameter(Mandatory = $true)][string]$Vol,
    [string]$Work = "D:\disks\work",
    [string]$Repo = "D:\disks\repo",
    [string]$Manifest = "D:\disks\work\source_manifest.csv"
)

$ErrorActionPreference = "Stop"
$env:Path = "C:\Program Files\Git\cmd;C:\Program Files\GitHub CLI;C:\Program Files\7-Zip;" + $env:Path

$src = Import-Csv $Manifest | Where-Object { $_.Vol -eq $Vol }
if (-not $src) { throw "Volume $Vol not found in manifest" }

$slug = ($Vol -replace '[\s()]+', '_' -replace '_+', '_').Trim('_')
if (-not $slug) { $slug = $Vol.Trim() }

$rawDir = Join-Path $Work "raw"
$extractDir = Join-Path $Work "extract\Vol_$slug"
$relDir = Join-Path $Work "rel"
New-Item -ItemType Directory -Force -Path $rawDir, $extractDir, $relDir | Out-Null

$rawFile = Join-Path $rawDir $src.File
$games7z = Join-Path $relDir "Vol_${slug}.games.7z"
$iso7z = Join-Path $relDir "Vol_${slug}.iso.7z"

$log = Join-Path $Repo "catalog\process.log"
function Log([string]$msg) { $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [$Vol] $msg"; Add-Content -Path $log -Value $line; Write-Host $line }

function Get-Validated([string]$file, [string]$sha1) {
    if (Test-Path -LiteralPath $file) {
        $h = (Get-FileHash -LiteralPath $file -Algorithm SHA1 -ErrorAction SilentlyContinue).Hash.ToLower()
        if ($h -eq $sha1) { return $true }
    }
    return $false
}

# Step 1: download (resume-capable)
$done = Get-Validated $rawFile $src.SHA1
if (-not $done) {
    Log "downloading $($src.File) ($([math]::Round([long]$src.Size/1MB,1)) MB)"
    curl.exe -L -C - --retry 5 -o $rawFile $src.URL
    if ($LASTEXITCODE -ne 0) { throw "curl failed with exit $LASTEXITCODE" }
}
$done = Get-Validated $rawFile $src.SHA1
if (-not $done) { throw "SHA-1 mismatch for $($src.File)" }
Log "SHA-1 verified"

# Step 2: extract (skip if already extracted fully)
$probe = Get-ChildItem $extractDir -Recurse -File -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $probe) {
    Log "extracting"
    & 7z x $rawFile -o"$extractDir" -y -bd | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "extract failed" }
    # fix INTERFAC -> interface (known XP-era issue)
    if (Test-Path "$extractDir\INTERFAC") { Rename-Item "$extractDir\INTERFAC" "interface" }
}
$inner = Get-ChildItem $extractDir -Directory | Select-Object -First 1
$payload = if ($inner) { $inner.FullName } else { $extractDir }

# Step 3: per-game compression (non-solid: each game independently extractable)
if (-not (Test-Path $games7z)) {
    Log "compressing per-game 7z"
    & 7z a -t7z $games7z "$payload" -mx=9 -m0=LZMA2 -ms=off -mmt=on -y -bd | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "games compress failed" }
}

# Step 4: whole-disc solid compression (super-compressed ISO)
if (-not (Test-Path $iso7z)) {
    Log "compressing solid iso 7z"
    & 7z a -t7z $iso7z "$payload" -mx=9 -m0=LZMA2:d=512m -ms=on -mmt=on -y -bd | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "iso compress failed" }
}

# Step 5: build catalog entry
$files = Get-ChildItem $payload -Recurse -File
$entry = [PSCustomObject]@{
    volume   = $Vol
    slug     = $slug
    source   = $src.URL
    sourceSha1 = $src.SHA1
    fileCount = $files.Count
    rawBytes = ($files | Measure-Object Length -Sum).Sum
    games7z  = (Get-Item $games7z).Length
    iso7z    = (Get-Item $iso7z).Length
}
$entry | ConvertTo-Json | Set-Content -Path "$Repo\catalog\vol_$slug.json" -Encoding UTF8
Log "catalog entry written ($($files.Count) files)"

# Step 6: upload to GitHub release
$savedEAP = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$tag = "vol-$slug"
gh release view $tag --repo the-lust/Digerati *> $null
$exists = ($LASTEXITCODE -eq 0)
if (-not $exists) {
    Log "creating release $tag"
    gh release create $tag --repo the-lust/Digerati --title "Jogo Disk Volume $Vol" --notes "Volume $Vol of the Champak Jogo Disk archive. $($files.Count) files, $([math]::Round(($files | Measure-Object Length -Sum).Sum/1MB,1)) MB extracted." $games7z $iso7z *> $null
    if ($LASTEXITCODE -ne 0) { throw "release create failed" }
} else {
    Log "release $tag exists; uploading missing assets"
    gh release upload $tag --repo the-lust/Digerati --clobber $games7z $iso7z *> $null
    if ($LASTEXITCODE -ne 0) { throw "release upload failed" }
}
$ErrorActionPreference = $savedEAP
Log "uploaded; cleaning local"
Remove-Item -LiteralPath $rawFile -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $extractDir -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $games7z, $iso7z -Force -ErrorAction SilentlyContinue
Log "DONE"
