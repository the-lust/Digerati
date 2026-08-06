$ErrorActionPreference = "Continue"
$env:Path = "C:\Program Files\Git\cmd;C:\Program Files\GitHub CLI;C:\Program Files\7-Zip;" + $env:Path
$Repo = "D:\disks\repo"
$Manifest = "D:\disks\work\source_manifest.csv"
$Script = Join-Path $Repo "scripts\process-volume.ps1"

$vols = (Import-Csv $Manifest).Vol | Sort-Object @{Expression = {
    if ($_ -match '^(\d+)$') { [int]$matches[1] } elseif ($_ -match '^([A-Z])-(\d+)$') { 1000 + [int]$matches[2] } else { 2000 }
}}
$vols = $vols | Sort-Object

$existing = gh release list --repo the-lust/Digerati --limit 200 --json tagName --jq '.[].tagName' 2>$null | ForEach-Object { $_ -replace '^vol-','' }
$vols = $vols | Where-Object { $_ -notin $existing }
Write-Host "Skipping $($existing.Count) already-uploaded volumes. Pending: $($vols.Count)"

$done = @(); $failed = @()
foreach ($vol in $vols) {
    Write-Host "`n===== Processing [$vol] =====" -ForegroundColor Cyan
    & powershell -NoProfile -ExecutionPolicy Bypass -File $Script -Vol $vol
    if ($LASTEXITCODE -eq 0 -and $?) { $done += $vol } else { $failed += $vol; Write-Host "FAILED: $vol" -ForegroundColor Red }
    git -C $Repo add -A 2>$null
    git -C $Repo -c user.name="the-lust" -c user.email="the-lust@users.noreply.github.com" commit -m "catalog: volume $vol" 2>$null | Out-Null
    git -C $Repo push 2>$null | Out-Null
}
Write-Host "`n=== SUMMARY ===" -ForegroundColor Green
Write-Host "Done: $($done.Count) | Failed: $($failed.Count)"
if ($failed.Count) { Write-Host "Failed: $($failed -join ', ')" -ForegroundColor Red }
