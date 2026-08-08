import json, re, os, random

TMP = r"C:\Users\kaneki\AppData\Local\Temp\opencode"
OUT = r"D:\disks\repo\app\frontend\demo.js"

with open(os.path.join(TMP, "portal_cds_db.json"), encoding="utf-8-sig") as f:
    cds = json.load(f)
with open(os.path.join(TMP, "portal_games_db.json"), encoding="utf-8-sig") as f:
    games = json.load(f)

def key(d, *ks):
    for k in ks:
        if d.get(k): return d[k]
    return ""

cds = [c for c in cds if key(c, "Estado") == "Mapeado" and (c.get("Nº de jogos") or 0) > 0]
cds.sort(key=lambda c: key(c, "C\u00f3digo"))
random.seed(7)
random.shuffle(cds)

taken = set()

def sec_of(ext):
    ext = ext.lower()
    if ext == "swf": return "games"
    if ext == "exe": return "tools"
    if ext in ("dcr", "dir"): return "shockwave"
    if ext in ("mp3", "wav", "flv", "mp4"): return "media"
    if ext in ("jpg", "jpeg", "png", "gif", "bmp"): return "wallpapers"
    if ext in ("pdf", "txt", "html", "htm"): return "docs"
    return "extras"

def uniq(base):
    b = (base or "Game").strip()
    if b.lower() not in taken:
        taken.add(b.lower()); return b
    i = 2
    while True:
        cand = f"Champak {b} {i}"
        if cand.lower() not in taken:
            taken.add(cand.lower()); return cand
        i += 1

vols, items = [], []
for c in cds[:9]:
    code = key(c, "C\u00f3digo")
    title = key(c, "T\u00edtulo")
    cnt = int(c.get("Nº de jogos") or 0)
    date = key(c, "Data do CD")
    gs = [g for g in games if code in [x.strip() for x in key(g, "CD").split(",")]]
    gs.sort(key=lambda g: {"swf": 0, "exe": 1}.get((key(g, "Extens\u00e3o") or "").lower(), 2))
    pick = []
    for g in gs:
        nm, ex, desc = key(g, "Nome"), (key(g, "Extens\u00e3o") or "").lower(), key(g, "Descri\u00e7\u00e3o")
        if not nm or not ex or ex == "outros":
            continue
        if sec_of(ex) == "games" and not g.get("is_swf_in_r2"):
            continue
        pick.append((nm, ex, desc))
        if len(pick) >= 6: break
    if not pick:
        continue
    slug = re.sub(r"[^A-Za-z0-9]+", "_", title).strip("_")[:40]
    vols.append({"slug": slug, "code": code, "title": title, "date": date, "total": cnt})
    for nm, ex, desc in pick:
        base = re.sub(r"[^A-Za-z0-9]+", "_", nm).strip("_")
        sec = sec_of(ex)
        items.append({
            "v": slug, "n": f"{sec}/{base}.{ex}",
            "nm": uniq(nm), "ex": ex, "desc": (desc or "")[:150],
        })

for vi in range(2):
    slug = f"Champak_{2023 + vi}"
    vols.append({"slug": slug, "code": "CHPK", "title": f"Champak Jogo Disk n\u00ba {150 + vi}", "date": "15/0" + str(vi + 1) + "/2026", "total": 6})
    for i, nm in enumerate(["Space Pew", "Penguin Run", "Bubble Pop", "Cosmic Rover", "Mini Slalom", "Pong Dash"]):
        items.append({"v": slug, "n": f"games/ck{vi}_{i}.swf", "nm": f"Champak {nm}", "ex": "swf", "desc": "A Champak original from the Jogo Disk series."})

with open(OUT, "w", encoding="utf-8-sig") as f:
    f.write("window.DEMO = " + json.dumps({"volumes": vols, "items": items}, ensure_ascii=False) + ";\n")

print(json.dumps({"volumes": len(vols), "items": len(items)}))

