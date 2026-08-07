param(
    [string]$Manifest = "D:\disks\work\source_manifest.csv",
    [string]$Work = "D:\disks\work\gi",
    [string]$Out = "D:\disks\repo\catalog\games.json",
    [string]$Log = "D:\disks\work\gi.log",
    [string]$State = "D:\disks\work\gi_done.txt"
)

$ErrorActionPreference = "Stop"
$env:Path = "C:\Program Files\7-Zip;" + $env:Path
Add-Type -AssemblyName System.Net.Http
New-Item -ItemType Directory -Force -Path $Work | Out-Null

function Log([string]$m) { $l = "$(Get-Date -Format 'HH:mm:ss') $m"; Add-Content -Path $Log -Value $l; Write-Host $l }

# ---------- binary helpers ----------
function Read-U16([byte[]]$b, [int]$o) { return [BitConverter]::ToUInt16($b, $o) }
function Read-U32([byte[]]$b, [int]$o) { return [BitConverter]::ToUInt32($b, $o) }
function Read-U64([byte[]]$b, [int]$o) { return [BitConverter]::ToUInt64($b, $o) }

function Get-Range([string]$url, [long]$start, [long]$count, [int]$retries = 4) {
    while ($true) {
        try {
            $req = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Get, $url)
            $req.Headers.TryAddWithoutValidation("Range", "bytes=$start-$($start+$count-1)") | Out-Null
            $resp = $Http.SendAsync($req).Result
            if (-not $resp.IsSuccessStatusCode) { throw "HTTP $([int]$resp.StatusCode)" }
            $bytes = $resp.Content.ReadAsByteArrayAsync().Result
            return $bytes
        } catch {
            $retries--
            if ($retries -le 0) { throw "range fetch failed for ${url} @ ${start}: $_" }
            Start-Sleep -Seconds 2
        }
        $req.Dispose(); $resp.Dispose()
    }
}

function Get-ZipCentralDirectory([string]$url, [long]$fileSize) {
    # fetch tail (EOCD + zip64 locator region)
    $tailLen = [math]::Min($fileSize, 131072)
    $tail = Get-Range $url ($fileSize - $tailLen) $tailLen
    if ($tail.Length -lt 22) { return @() }

    # find EOCD (signature 0x06054b50) scanning back from end
    $eocd = -1
    for ($i = $tail.Length - 22; $i -ge 0; $i--) {
        if ($tail[$i] -eq 0x50 -and $tail[$i+1] -eq 0x4b -and $tail[$i+2] -eq 0x05 -and $tail[$i+3] -eq 0x06) { $eocd = $i; break }
    }
    if ($eocd -lt 0) { throw "EOCD not found" }

    # inside tail array, absolute positions = (fileSize - tailLen) + index
    $base = $fileSize - $tailLen
    $cdOffset   = [long](Read-U32 $tail ($eocd + 16))
    $cdSize     = Read-U32 $tail ($eocd + 12)
    $entries    = Read-U16 $tail ($eocd + 10)
    $zip64      = $false
    if ($cdOffset -eq 0xFFFFFFFF -or $cdSize -eq 0xFFFFFFFF -or $entries -eq 0xFFFF) {
        # zip64 locator: just before comment at eocd+22
        $cmtLen = Read-U16 $tail ($eocd + 20)
        $locPos = $eocd + 22 + $cmtLen - 20
        if ($locPos -ge 0 -and $locPos + 20 -le $tail.Length -and $tail[$locPos] -eq 0x50 -and $tail[$locPos+1] -eq 0x4b -and $tail[$locPos+2] -eq 0x06 -and $tail[$locPos+3] -eq 0x07) {
            $z64Off = Read-U64 $tail ($locPos + 8)
            $z64 = Get-Range $url $z64Off 56
            $cdOffset   = [long](Read-U64 $z64 48)
            $cdSize     = Read-U64 $z64 40
            $entries    = [int](Read-U64 $z64 32)
        }
    }

    # fetch central directory
    if ($cdSize -eq 0 -or $cdSize -gt 20000000) { return @() }
    $cd = Get-Range $url $cdOffset $cdSize
    $files = New-Object System.Collections.Generic.List[object]
    $o = 0
    $n = 0
    while ($o + 46 -le $cd.Length -and $n -lt $entries) {
        if (-not ($cd[$o] -eq 0x50 -and $cd[$o+1] -eq 0x4b -and $cd[$o+2] -eq 0x01 -and $cd[$o+3] -eq 0x02)) { break }
        $nameLen  = Read-U16 $cd ($o + 28)
        $extraLen = Read-U16 $cd ($o + 30)
        $cmtLen   = Read-U16 $cd ($o + 32)
        $uncompSize = Read-U32 $cd ($o + 24)
        $method   = Read-U16 $cd ($o + 10)
        if ($nameLen -gt 0) {
            $enc = New-Object System.Text.UTF8Encoding($false)
            $name = $enc.GetString($cd, $o + 46, $nameLen)
            if ($name -match '\ufffd') { $name = [System.Text.Encoding]::GetEncoding(437).GetString($cd, $o + 46, $nameLen) }
            $isDir = $name.EndsWith('/')
            if (-not $isDir) {
                $files.Add([PSCustomObject]@{ n = $name; s = [long]$uncompSize; m = $method })
            }
        }
        $o += 46 + $nameLen + $extraLen + $commentLen
        $n++
    }
    return $files
}

# ---------- main ----------
$Http = [System.Net.Http.HttpClient]::new()
$rows = Import-Csv $Manifest | Sort-Object Vol
$done = @()
if (Test-Path $State) { $done = @(Get-Content $State) }
$all = New-Object System.Collections.Generic.List[object]

foreach ($r in $rows) {
    if ($done -contains $r.Vol) { continue }
    if ($r.Kind -ne "zip") { continue }
    Log "### $($r.Vol): $($r.File) ($([math]::Round([long]$r.Size/1MB,1)) MB)"
    try {
        $files = Get-ZipCentralDirectory $r.URL ([long]$r.Size)
        Log "   -> $($files.Count) files"
        foreach ($f in $files) {
            $all.Add([PSCustomObject]@{ v = $r.Vol; n = $f.n; s = $f.s })
        }
        Add-Content $State -Value $r.Vol
    } catch {
        Log "   FAILED: $_"
    }
}

$saver = @($all | ForEach-Object {
    $slug = ($_.v -replace '[\s()]+', '_' -replace '_+', '_').Trim('_')
    [PSCustomObject]@{ v = $slug; n = $_.n; s = $_.s }
})
$saver | ConvertTo-Json -Depth 2 | Set-Content -Path $Out -Encoding UTF8
Log "saved $($saver.Count) entries -> $Out"
$Http.Dispose()