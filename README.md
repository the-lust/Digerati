# Digerati

Open archive of the **Champak Jogo Disk** cover CDs (produced by Digerati for Champak magazine,in India, during mid 2000s to early 2010s).

Every volume is preserved twice:

- `Vol_XXX.games.7z` — per game compression (LZMA2 max, non solid): each game/extras file is an independently extractable entry, so individual games can be pulled without the whole disc.
- `Vol_XXX.iso.7z` — whole disc super compressed archive (solid LZMA2 max).

All archives are attached as GitHub Release assets (one release `vol-XXX` per volume) and are free to download.

## Archive contents (August 2026)

- **98 volumes** (Vol 11–149 + letter series A-4 through M-12), covering the complete known Jogo Disk run
- **196 release assets = 16.7 GB** compressed (`.games.7z` + `.iso.7z` per volume)
- **48 disc cover scans** (release `disc-covers`)
- Original sources: ~19.5 GB of ZIP/ISO media (redundancy removed)
- Every download is SHA-1 verified against archive.org metadata

Volumes: 11, 12, 25, 26 (Anniversary), 28–41, 43–47, 49, 50, 52–56, 59–66, 74–76, 78, 83, 86, 89, 93, 99, 100, 103, 104, 106–110, 112, 114, 116, 117, 119, 120, 122–125, 127–130, 132, 134–136, 138–149, A-4, A-12, B-12, C-12, C-14, E-12, E-14, F-12, G-12, K-12, K-14, M-12

## Sources

- Main ISO collection (73 vols): https://archive.org/details/jogo-disk-collection
- ZIP archive (94 vols): https://archive.org/details/champak-jogo-disk-archive
- Gap volumes 48, 77, 124: individual archive.org items (`jogo-disk-48`, `jogo-disk-77`, `jogo-disk-124`)
- Volume 107 ISO: `jogo-disk-107`
- Physical originals: pastcart.com (Vol 106/107/108/113)
- Reddit thread: r/IndianGaming `ldtf6p` + Google Drive mirror by u/ReasonablyIntelligent

## Playing the games

The games are Flash based (`.swf`) shareware games. Use **Ruffle** (ruffle.rs) to play them; `.exe` tools (Click and Paint, Magic Blackboard, wallpapers installer) run on Windows or via Wine on macOS/Linux; `.dcr` Shockwave/Director games have no maintained emulator.

## How the archive was built

1. `scripts/process-volume.ps1 -Vol <N>` downloads the volume from archive.org, verifies SHA-1, extracts, compresses per game + solid disc archives, uploads to the GitHub release `vol-<N>`, then deletes local copies.
2. `catalog/vol_<N>.json` holds per-volume metadata (file counts, sizes, source URLs, hashes).

## Catalog

- `catalog/vol_*.json` — per volume metadata
- `catalog/process.log` — processing log

Repo layout:

```
scripts/    pipeline scripts
catalog/    per volume metadata + log
```

License: The games are shareware/embeddable titles bundled with a magazine; preserved for archival/educational purposes.
