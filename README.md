# Digerati

Open archive of the **Champak Jogo Disk** cover CDs (produced by Digerati for Champak magazine, India, mid-2000s to early 2010s).

Every volume is preserved twice:

- `Vol_XXX.games.7z` — per-game compression (LZMA2 max, non-solid): each game/extras file is an independently extractable entry, so individual games can be pulled without the whole disc.
- `Vol_XXX.iso.7z` — whole-disc super-compressed archive (solid LZMA2 max).

All archives are attached as GitHub Release assets (one release `vol-XXX` per volume) and are free to download.

## Sources

- Main ISO collection (73 vols): https://archive.org/details/jogo-disk-collection
- ZIP archive (94 vols): https://archive.org/details/champak-jogo-disk-archive
- Gap volumes 48, 77, 124: individual archive.org items (`jogo-disk-48`, `jogo-disk-77`, `jogo-disk-124`)
- Volume 107 ISO: `jogo-disk-107`
- Physical originals: pastcart.com (Vol 106/107/108/113)
- Reddit thread: r/IndianGaming `ldtf6p` + Google Drive mirror by u/ReasonablyIntelligent

## Playing the games

The games are Flash (`.swf`) shareware games. Use **Ruffle** (ruffle.rs) to play them; `.exe` tools (Click and Paint, Magic Blackboard, wallpapers installer) run on Windows or via Wine on macOS/Linux; `.dcr` Shockwave/Director games have no maintained emulator.

## How the archive was built

1. `scripts/process-volume.ps1 -Vol <N>` downloads the volume from archive.org, verifies SHA-1, extracts, compresses per-game + solid disc archives, uploads to the GitHub release `vol-<N>`, then deletes local copies.
2. `catalog/vol_<N>.json` holds per-volume metadata (file counts, sizes, source URLs, hashes).

## Catalog

- `catalog/vol_*.json` — per-volume metadata
- `catalog/process.log` — processing log

Repo layout:

```
scripts/    pipeline scripts
catalog/    per-volume metadata + log
```

License: The games are shareware/embeddable titles bundled with a magazine; preserved for archival/educational purposes.
