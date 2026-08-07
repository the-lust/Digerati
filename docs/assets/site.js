"use strict";

const BASE = "";
const RELEASE = "https://github.com/the-lust/Digerati/releases/download";

let META = null, VOLUMES = [], GAMES = [];
let gameState = { q: "", vol: "", page: 1, per: 48, filtered: [] };

function $(s, r = document) { return r.querySelector(s); }
function $$(s, r = document) { return [...r.querySelectorAll(s)]; }
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function fmt(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + " GB";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + " MB";
  if (n >= 1e3) return (n / 1e3).toFixed(0) + " KB";
  return n + " B";
}
function hashHue(s) {
  let h = 0;
  for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 360;
}
function gamesUrl(v) { return `${RELEASE}/vol-${v.slug}/Vol_${v.slug}.games.7z`; }
function isoUrl(v) { return `${RELEASE}/vol-${v.slug}/Vol_${v.slug}.iso.7z`; }
function coverUrl(v) { return v.cover ? `${RELEASE}/vol-${v.slug}/Vol_${v.slug}_cover.jpg` : null; }
function dlIcon() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16"/></svg>`;
}

/* ---------- disc visual ---------- */
function discSVG(slug, label, opts = {}) {
  const hue = hashHue(slug);
  const size = opts.size || 150;
  const r = size / 2;
  const hole = r * 0.13;
  const labelR = r * 0.6;
  const iso = opts.iso, damaged = opts.damaged;
  let ring = `hsl(${hue},58%,58%)`;
  if (damaged) ring = `hsl(8,58%,58%)`;
  else if (iso) ring = `hsl(${hue},48%,44%)`;
  const txt = opts.text || label;
  const gid = "dg-" + hashHue(slug) + "-" + size;
  return `<svg class="disc" viewBox="0 0 ${size} ${size}" role="img" aria-label="Disc ${esc(label)}">
    <defs>
      <radialGradient id="${gid}" cx="50%" cy="42%" r="62%">
        <stop offset="0%" stop-color="#fdfcf9"/>
        <stop offset="40%" stop-color="#eceae3"/>
        <stop offset="74%" stop-color="${ring}"/>
        <stop offset="100%" stop-color="hsl(${hue},50%,30%)"/>
      </radialGradient>
    </defs>
    <circle cx="${r}" cy="${r}" r="${r - 2}" fill="url(#${gid})" stroke="rgba(0,0,0,0.28)" stroke-width="2"/>
    <circle cx="${r}" cy="${r}" r="${labelR + r * 0.03}" fill="none" stroke="rgba(255,255,255,0.8)" stroke-width="${r * 0.04}"/>
    <circle cx="${r}" cy="${r}" r="${labelR - r * 0.02}" fill="none" stroke="rgba(0,0,0,0.15)" stroke-width="${r * 0.012}" stroke-dasharray="${r * 0.07} ${r * 0.05}"/>
    <circle cx="${r}" cy="${r}" r="${hole}" fill="#f3f1ea" stroke="rgba(0,0,0,0.45)" stroke-width="2"/>
    <circle cx="${r}" cy="${r}" r="${hole * 0.5}" fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="1.5"/>
    <ellipse cx="${r * 1.12}" cy="${r * 0.62}" rx="${r * 0.42}" ry="${r * 0.82}" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="${r * 0.09}" transform="rotate(-24 ${r * 1.12} ${r * 0.62})"/>
    <text x="${r}" y="${r + r * 0.05}" text-anchor="middle" font-family="Fraunces, Georgia, serif" font-weight="700" font-size="${r * 0.21}" fill="#263440">${esc(txt)}</text>
  </svg>`;
}

function discCell(v, opts = {}) {
  const iso = v.hasIso, damaged = v.damaged;
  const label = String(v.vol).replace(/ \(.*\)$/, "");
  const tags = [];
  if (iso) tags.push(`<span class="tag iso">ISO</span>`);
  else tags.push(`<span class="tag payload">payload</span>`);
  if (damaged) tags.push(`<span class="tag damaged">damaged</span>`);
  if (v.cover) tags.push(`<span class="tag">cover</span>`);
  return `
    <div class="disc-cell" data-vol="${esc(v.slug)}">
      <button class="disc-btn" title="Volume ${esc(v.vol)} — click for options">${discSVG(v.slug, label, { iso, damaged, size: opts.size || 150 })}</button>
      <div class="disc-name">Volume ${esc(v.vol)}</div>
      <div class="disc-tags">${tags.join("")}</div>
    </div>`;
}

/* ---------- game names ---------- */
function cleanName(path) {
  const base = String(path).split("/").pop() || "";
  const noExt = base.replace(/\.[^.]+$/, "");
  return noExt.replace(/[\[\]]/g, "").replace(/[\s_]+/g, " ").trim();
}
function kindOf(path) {
  const base = String(path).split("/").pop() || "";
  const ext = (base.match(/\.[^.]+$/) || [""])[0].toLowerCase();
  if (ext === ".swf") return { k: "Flash game", icon: "🎮", tip: "Runs in Ruffle (free in-browser Flash emulator)." };
  if (ext === ".dcr" || ext === ".dir") return { k: "Shockwave title", icon: "💿", tip: "Shockwave has no maintained emulator yet." };
  if (ext === ".exe") return { k: "Windows program", icon: "🖥️", tip: "Runs natively on Windows, or via Wine on macOS/Linux." };
  if (ext === ".jpg" || ext === ".jpeg" || ext === ".png" || ext === ".gif" || ext === ".bmp") return { k: "Image", icon: "🖼️", tip: "A picture asset from the disc." };
  if (ext === ".mp3" || ext === ".wav" || ext === ".flv" || ext === ".avi") return { k: "Media", icon: "🎵", tip: "Audio/video content from the disc." };
  if (ext === ".pdf") return { k: "Document", icon: "📄", tip: "A PDF document from the disc." };
  return { k: "File", icon: "📁", tip: "A support file from the disc." };
}

/* ---------- modal ---------- */
function openModal(html) {
  const m = $("#modal");
  $("#modal-body").innerHTML = html;
  m.hidden = false;
  document.body.style.overflow = "hidden";
  m.scrollTop = 0;
}
function closeModal() {
  const m = $("#modal");
  m.hidden = true;
  document.body.style.overflow = "";
}
$$("#modal [data-close]").forEach(el => el.addEventListener("click", closeModal));
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

function openGameModal(g) {
  const v = VOLUMES.find(x => x.slug === g.v) || { vol: g.v, slug: g.v, fileCount: 0, rawBytes: 0 };
  const name = cleanName(g.n);
  const kind = kindOf(g.n);
  const cover = coverUrl(v);
  const art = cover
    ? `<img class="game-art-img" src="${cover}" alt="Cover of Volume ${esc(v.vol)}" loading="lazy">`
    : `<div class="game-art-tile">${kind.icon}<span>${esc(name)}</span></div>`;
  const desc = `This ${kind.k.toLowerCase()} is part of <strong>Volume ${esc(v.vol)}</strong> — ${v.fileCount.toLocaleString()} files, ${fmt(v.rawBytes)} raw — from the Champak Jogo Disk cover CD series by Digerati. ${kind.tip}`;
  openModal(`
    <div class="modal-art">${art}</div>
    <div class="modal-info">
      <div class="modal-kicker">${kind.icon} ${esc(kind.k)} · ${fmt(g.s)}</div>
      <h3 class="modal-title">${esc(name)}</h3>
      <p class="modal-desc">${desc}</p>
      <div class="modal-meta">
        <span>Volume ${esc(v.vol)}</span><span>${fmt(g.s)}</span><span class="mono">${esc(g.n.split("/").pop())}</span>
      </div>
      <div class="modal-actions">
        <a class="btn primary" href="${gamesUrl(v)}">${dlIcon()} Download games archive</a>
        <a class="btn" href="${isoUrl(v)}">${dlIcon()} ISO</a>
        <button class="btn ghost" data-goto="volumes" data-vol="${esc(v.slug)}">View disc</button>
      </div>
    </div>`);
  bindModalGoto();
}

function openDiscModal(v) {
  const cover = coverUrl(v);
  const art = cover
    ? `<img class="game-art-img" src="${cover}" alt="Cover of Volume ${esc(v.vol)}" loading="lazy">`
    : discSVG(v.slug, String(v.vol).replace(/ \(.*\)$/, ""), { iso: v.hasIso, damaged: v.damaged, size: 220 });
  const sha = v.isoSha1 ? `<span>ISO SHA-1 <code>${v.isoSha1.slice(0, 14)}…</code></span>` : "";
  const tags = [];
  if (v.hasIso) tags.push(`<span class="tag iso">Real ISO</span>`);
  else tags.push(`<span class="tag payload">Payload only</span>`);
  if (v.damaged) tags.push(`<span class="tag damaged">damaged</span>`);
  if (v.cover) tags.push(`<span class="tag">cover scan</span>`);
  const source = v.source ? `Originally from <code>${esc(v.source.replace("https://archive.org/download/", ""))}</code>` : "";
  openModal(`
    <div class="modal-art">${art}</div>
    <div class="modal-info">
      <div class="modal-kicker">Volume ${esc(v.vol)} · ${v.fileCount.toLocaleString()} files · ${fmt(v.rawBytes)}</div>
      <h3 class="modal-title">Volume ${esc(v.vol)}</h3>
      <p class="modal-desc">${esc(v.damaged ? "This disc is damaged in the original archive — contents may be incomplete." : "A Champak Jogo Disk cover CD by Digerati.")} ${source}</p>
      <div class="tags">${tags.join("")}</div>
      <div class="modal-meta"><span>${v.fileCount.toLocaleString()} files</span><span>${fmt(v.rawBytes)} raw</span>${sha}</div>
      <div class="modal-actions">
        <a class="btn primary" href="${gamesUrl(v)}">${dlIcon()} Games ${fmt(v.games7z)}</a>
        <a class="btn" href="${isoUrl(v)}">${dlIcon()} ISO ${fmt(v.iso7z)}</a>
        <button class="btn ghost" data-goto="games" data-vol="${esc(v.slug)}">Browse games</button>
      </div>
    </div>`);
  bindModalGoto();
}

function bindModalGoto() {
  $$("#modal [data-goto]").forEach(b => b.addEventListener("click", () => {
    const v = b.dataset.vol;
    if (v) { $("#game-vol").value = v; gameState.page = 1; }
    closeModal();
    const t = $$(".tab").find(x => x.dataset.view === b.dataset.goto);
    if (t) t.click();
  }));
}

/* ---------- tabs ---------- */
$$(".tab").forEach(t => t.addEventListener("click", () => {
  closeModal();
  $$(".tab").forEach(x => x.classList.toggle("active", x === t));
  $$(".view").forEach(v => v.classList.toggle("active", v.id === "view-" + t.dataset.view));
  if (t.dataset.view === "volumes") renderVolumes();
  if (t.dataset.view === "games") { gameState.page = 1; renderGames(); }
  if (t.dataset.view === "discs") renderDiscs();
}));
$$("[data-goto]").forEach(b => b.addEventListener("click", () => {
  const t = $$(".tab").find(x => x.dataset.view === b.dataset.goto);
  if (t) t.click();
}));

/* ---------- home ---------- */
function renderHome() {
  const s = $("#hero-stats");
  const items = [
    [META.volumeCount, "Volumes"],
    [META.gameCount.toLocaleString(), "Games & files"],
    [fmt(META.rawBytes), "Raw media"],
    [fmt(META.games7zBytes), "Compressed"],
    [META.isoVolumeCount, "Disc images"],
    [META.coverCount, "Cover scans"],
  ];
  s.innerHTML = items.map(([n, l]) => `<div class="stat"><span class="num">${esc(n)}</span><span class="lbl">${esc(l)}</span></div>`).join("");

  const f = $("#feature-grid");
  const cards = [
    { ico: "💿", h: "Pick a disc", p: "Every surviving Jogo Disk rendered as a disc — click one for download and viewing options.", act: "volumes" },
    { ico: "🎮", h: "Search every game", p: "Just the game names, plain and simple — 38,388 of them across 94 discs.", act: "games" },
    { ico: "🖼️", h: "Disc images & covers", p: "Real ISO disc images for 70 volumes, payload archives for the rest, plus 52 cover scans.", act: "discs" },
    { ico: "🔍", h: "Verified integrity", p: "Every file SHA-1 verified against archive.org metadata. Full manifests in the repo.", act: "about" },
  ];
  f.innerHTML = cards.map(c => `
    <div class="feature" style="cursor:pointer" data-goto="${c.act}">
      <div class="ico">${c.ico}</div><h3>${c.h}</h3><p>${c.p}</p>
    </div>`).join("");
  $$("#feature-grid .feature").forEach(x => x.addEventListener("click", () => {
    const t = $$(".tab").find(tb => tb.dataset.view === x.dataset.goto);
    if (t) t.click();
  }));
}

/* ---------- volumes ---------- */
function renderVolumes() {
  const q = ($("#vol-search").value || "").toLowerCase().trim();
  const f = $("#vol-filter").value;
  let list = VOLUMES.slice();
  if (q) list = list.filter(v => String(v.vol).toLowerCase().includes(q) || v.slug.toLowerCase().includes(q));
  if (f === "numbered") list = list.filter(v => /^\d+$/.test(String(v.vol)));
  if (f === "letter") list = list.filter(v => /^[A-M]$/.test(String(v.vol).split("-")[0]));
  if (f === "iso") list = list.filter(v => v.hasIso);
  if (f === "damaged") list = list.filter(v => v.damaged);
  list.sort((a, b) => {
    const an = parseInt(String(a.vol), 10), bn = parseInt(String(b.vol), 10);
    return (isNaN(an) ? 1e6 : an) - (isNaN(bn) ? 1e6 : bn) || String(a.vol).localeCompare(String(b.vol));
  });
  $("#vol-total").textContent = `(${list.length})`;
  const g = $("#volumes-grid");
  if (!list.length) { g.innerHTML = `<div class="empty">No volumes match.</div>`; return; }
  g.innerHTML = list.map(v => discCell(v)).join("");
  bindDiscClicks();
}
$("#vol-search").addEventListener("input", renderVolumes);
$("#vol-filter").addEventListener("change", renderVolumes);

function bindDiscClicks() {
  $$(".disc-cell").forEach(cell => cell.addEventListener("click", () => {
    const v = VOLUMES.find(x => x.slug === cell.dataset.vol);
    if (v) openDiscModal(v);
  }));
}

/* ---------- games ---------- */
function buildGameVolSelect() {
  const sel = $("#game-vol");
  VOLUMES.slice().sort((a, b) => String(a.vol).localeCompare(String(b.vol), undefined, { numeric: true })).forEach(v => {
    const o = document.createElement("option");
    o.value = v.slug; o.textContent = `Volume ${v.vol}`;
    sel.appendChild(o);
  });
}
function filterGames() {
  const q = gameState.q.toLowerCase();
  let out = GAMES;
  if (gameState.vol) out = out.filter(g => g.v === gameState.vol);
  if (q) out = out.filter(g => cleanName(g.n).toLowerCase().includes(q) || g.n.toLowerCase().includes(q));
  return out;
}
function renderGames() {
  gameState.q = ($("#game-search").value || "").trim();
  gameState.vol = $("#game-vol").value;
  const filtered = filterGames();
  $("#game-total").textContent = `(${filtered.length.toLocaleString()})`;
  const pages = Math.max(1, Math.ceil(filtered.length / gameState.per));
  if (gameState.page > pages) gameState.page = pages;
  const slice = filtered.slice((gameState.page - 1) * gameState.per, gameState.page * gameState.per);
  const list = $("#games-list");
  if (!slice.length) { list.innerHTML = `<div class="empty">No games match.</div>`; }
  else {
    list.innerHTML = slice.map(g => {
      const name = cleanName(g.n);
      const kind = kindOf(g.n);
      return `<button class="game-item" data-g="${esc(g.v)}|${esc(g.n)}">
        <span class="gi-kind" title="${esc(kind.k)}">${kind.icon}</span>
        <span class="gi-name">${esc(name)}</span>
      </button>`;
    }).join("");
    $$("#games-list .game-item").forEach(b => b.addEventListener("click", () => {
      const [v, n] = b.dataset.g.split("|");
      openGameModal({ v, n });
    }));
  }
  const p = $("#games-pager");
  p.innerHTML = "";
  const mk = (label, page, cls = "") => {
    const b = document.createElement("button");
    b.className = "btn sm pg " + cls;
    b.textContent = label;
    if (page < 1 || page > pages) b.disabled = true;
    b.addEventListener("click", () => { gameState.page = page; renderGames(); });
    p.appendChild(b);
  };
  if (pages > 1) {
    mk("‹", gameState.page - 1);
    const from = Math.max(1, gameState.page - 2), to = Math.min(pages, from + 4);
    for (let i = from; i <= to; i++) mk(String(i), i, i === gameState.page ? "primary" : "");
    mk("›", gameState.page + 1);
  }
}
$("#game-search").addEventListener("input", () => { gameState.page = 1; renderGames(); });
$("#game-vol").addEventListener("change", () => { gameState.page = 1; renderGames(); });

/* ---------- discs ---------- */
function renderDiscs() {
  const q = ($("#disc-search").value || "").toLowerCase().trim();
  const f = $("#disc-filter").value;
  let list = VOLUMES.slice();
  if (q) list = list.filter(v => String(v.vol).toLowerCase().includes(q));
  if (f === "real") list = list.filter(v => v.hasIso);
  if (f === "payload") list = list.filter(v => !v.hasIso);
  list.sort((a, b) => String(a.vol).localeCompare(String(b.vol), undefined, { numeric: true }));
  const g = $("#discs-list");
  if (!list.length) { g.innerHTML = `<div class="empty">No discs match.</div>`; return; }
  g.innerHTML = list.map(v => discCell(v, { size: 130 })).join("");
  bindDiscClicks();
}
$("#disc-search").addEventListener("input", renderDiscs);
$("#disc-filter").addEventListener("change", renderDiscs);

/* ---------- boot ---------- */
(async function boot() {
  try {
    const [m, v, g] = await Promise.all([
      fetch(`${BASE}data/meta.json`).then(r => r.json()),
      fetch(`${BASE}data/volumes.json`).then(r => r.json()),
      fetch(`${BASE}data/games.json`).then(r => r.json()),
    ]);
    META = m; VOLUMES = v; GAMES = g;
    buildGameVolSelect();
    renderHome();
    renderVolumes();
    renderDiscs();
  } catch (e) {
    console.error("boot failed", e);
    document.body.insertAdjacentHTML("beforeend", `<div class="empty">Failed to load archive data. If you opened this from a local file, serve it over HTTP (e.g. <code>npx serve docs</code>) or open the GitHub Pages URL.</div>`);
  }
})();
