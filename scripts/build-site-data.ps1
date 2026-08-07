$ErrorActionPreference = "Stop"
$env:Path = "C:\Program Files\Git\cmd;C:\Program Files\GitHub CLI;" + $env:Path
$repo = "D:\disks\repo"
$catalog = "$repo\catalog"
$out = "$repo\docs\data"
New-Item -ItemType Directory -Force -Path $out | Out-Null

# cover-holding volumes discovered on releases
$coverVols = @('vol-36','vol-M-12','vol-K-14','vol-G-12','vol-F-12','vol-E-12','vol-B-12','vol-A-4','vol-A-12','vol-99','vol-93','vol-89','vol-86','vol-83','vol-78','vol-77','vol-76','vol-75_Damaged','vol-74_Damaged','vol-65','vol-60','vol-52','vol-34','vol-149','vol-148','vol-147','vol-146','vol-145','vol-144','vol-143','vol-142_Damaged','vol-141','vol-140','vol-139','vol-138','vol-136','vol-134','vol-132','vol-128_Damaged','vol-124','vol-123','vol-119','vol-117','vol-116','vol-110','vol-11','vol-108','vol-107','vol-106','vol-104','vol-103','vol-112') | ForEach-Object { $_.Replace('vol-','') }

$jsonFiles = Get-ChildItem "$catalog\vol_*.json"
$vols = New-Object System.Collections.Generic.List[object]
$totGames = 0L; $totRaw = 0L; $tot7z = 0L; $totIso7z = 0L; $isoCount = 0

foreach ($j in $jsonFiles) {
    $v = Get-Content $j.FullName -Raw | ConvertFrom-Json
    $slug = $v.slug
    $damaged = $slug -match 'Damaged'
    $hasCover = $coverVols -contains $slug
    $row = [PSCustomObject]@{
        vol      = $v.volume
        slug     = $slug
        damaged  = $damaged
        hasIso   = -not [string]::IsNullOrEmpty($v.isoSource)
        cover    = $hasCover
        fileCount = [long]$v.fileCount
        rawBytes  = [long]$v.rawBytes
        games7z   = [long]$v.games7z
        iso7z     = if ($null -ne $v.iso7z) { [long]$v.iso7z } else { 0 }
        source    = $v.source
        sourceSha1= $v.sourceSha1
        isoSha1   = if ($null -ne $v.isoSha1) { $v.isoSha1 } else { "" }
    }
    $vols.Add($row)
    $totGames += $row.fileCount; $totRaw += $row.rawBytes; $tot7z += $row.games7z; $totIso7z += $row.iso7z
    if ($row.hasIso) { $isoCount++ }
}
$vols | ConvertTo-Json -Depth 3 | Set-Content "$out\volumes.json" -Encoding UTF8

$meta = [PSCustomObject]@{
    volumeCount = $vols.Count
    gameCount   = $totGames
    rawBytes    = $totRaw
    games7zBytes= $tot7z
    iso7zBytes  = $totIso7z
    isoVolumeCount = $isoCount
    coverCount  = ($vols | Where-Object cover).Count
    pagesUrl    = "https://the-lust.github.io/Digerati/"
    repoUrl     = "https://github.com/the-lust/Digerati"
}
$meta | ConvertTo-Json | Set-Content "$out\meta.json" -Encoding UTF8

"volumes: $($vols.Count), games: $($totGames.ToString('N0')) files, raw $([math]::Round($totRaw/1GB,2)) GB, games.7z $([math]::Round($tot7z/1GB,2)) GB"
"iso vols: $isoCount, covers: $(($vols|? cover).Count)"