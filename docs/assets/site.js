"use strict";

const BASE = "";
const RELEASE = "https://github.com/the-lust/Digerati/releases/download";

let META = null, VOLUMES = [], GAMES = [];
let gameState = { q: "", vol: "", page: 1, per: 50, filtered: [] };

function $(s, r = document) { return r.querySelector(s); }
function $$(s, r = document) { return [...r.querySelectorAll(s)]; }
function fmt(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + " GB";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + " MB";
  if (n >= 1e3) return (n / 1e3).toFixed(0) + " KB";
  return n + " B";
}
function coverUrl(v) {
  return v.cover
    ? `${RELEASE}/vol-${v.slug}/Vol_${v.slug}_cover.jpg`
    : null;
}
function gamesUrl(v) { return `${RELEASE}/vol-${v.slug}/Vol_${v.slug}.games.7z`; }
function isoUrl(v) { return `${RELEASE}/vol-${v.slug}/Vol_${v.slug}.iso.7z`; }
function dlIcon() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16"/></svg>`;
}
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

/* ---------- tabs ---------- */
$$(".tab").forEach(t => t.addEventListener("click", () => {
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
    { ico: "💿", h: "Browse by volume", p: "Every surviving Jogo Disk — numbered 11–149 plus the letter series — with cover art, file counts and direct downloads.", act: "volumes" },
    { ico: "🎮", h: "Search every game", p: "A complete index of 38,388 games and files across 94 volumes, searchable and filterable by volume.", act: "games" },
    { ico: "🖼️", h: "Disc images & covers", p: "Real ISO disc images for 70 volumes, payload archives for the rest, plus 52 disc cover scans.", act: "discs" },
    { ico: "🔍", h: "Verified integrity", p: "Every file SHA-1 verified against archive.org metadata. Full manifests and hashes in the repo.", act: "about" },
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
  const g = $("#volumes-grid");
  if (!list.length) { g.innerHTML = `<div class="empty">No volumes match.</div>`; return; }
  g.innerHTML = list.map(v => {
    const cover = coverUrl(v);
    const tags = [];
    if (v.hasIso) tags.push(`<span class="tag iso">ISO</span>`);
    if (!v.hasIso) tags.push(`<span class="tag payload">payload</span>`);
    if (v.damaged) tags.push(`<span class="tag damaged">damaged</span>`);
    if (v.cover) tags.push(`<span class="tag">cover</span>`);
    return `
    <div class="card">
      <div class="card thumb">${cover ? `<img src="${cover}" alt="Cover of Volume ${esc(v.vol)}" loading="lazy" onerror="this.outerHTML='<span class=\'ph\'>Vol ${esc(v.vol)}</span>'">` : `<span class="ph">Vol ${esc(v.vol)}</span>`}</div>
      <div class="card body">
        <h3>Volume ${esc(v.vol)}${v.damaged ? " <span style='color:var(--coral)'>(damaged)</span>" : ""}</h3>
        <div class="sub">${v.fileCount.toLocaleString()} files · ${fmt(v.rawBytes)} raw</div>
        <div class="tags">${tags.join("")}</div>
        <div class="row">
          <a class="btn sm primary" href="${gamesUrl(v)}">Games ${fmt(v.games7z)}</a>
          <a class="btn sm" href="${isoUrl(v)}">ISO ${fmt(v.iso7z)}</a>
        </div>
      </div>
    </div>`;
  }).join("");
}
$("#vol-search").addEventListener("input", renderVolumes);
$("#vol-filter").addEventListener("change", renderVolumes);

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
  if (q) out = out.filter(g => g.n.toLowerCase().includes(q));
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
  const volName = slug => { const v = VOLUMES.find(x => x.slug === slug); return v ? v.vol : slug; };
  const body = $("#games-body");
  if (!slice.length) { body.innerHTML = `<tr><td colspan="4" class="empty">No games match.</td></tr>`; }
  else {
    body.innerHTML = slice.map(g => `
      <tr>
        <td class="gname" title="${esc(g.n)}">${esc(g.n)}</td>
        <td><a class="vlink" href="#view-volumes" data-sv="${esc(g.v)}">Vol ${esc(volName(g.v))}</a></td>
        <td class="sz">${fmt(g.s)}</td>
        <td class="dl"><a class="btn sm" href="${gamesUrl(VOLUMES.find(v => v.slug === g.v) || { slug: g.v })}" title="Download volume archive (contains this game)">${dlIcon()}</a></td>
      </tr>`).join("");
    $$("#games-body .vlink").forEach(a => a.addEventListener("click", () => {
      const v = VOLUMES.find(x => x.slug === a.dataset.sv);
      if (v) { $("#vol-search").value = String(v.vol); $("#vol-filter").value = "all"; }
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
  g.innerHTML = list.map(v => `
    <div class="card">
      <div class="card body">
        <h3>Volume ${esc(v.vol)}</h3>
        <div class="sub">${v.hasIso ? `Real ISO · SHA-1 <code style="font-size:0.72em">${v.isoSha1.slice(0, 12)}…</code>` : "No surviving ISO — payload archive instead"}</div>
        <div class="tags">${v.hasIso ? `<span class="tag iso">ISO</span>` : `<span class="tag payload">payload</span>`}${v.damaged ? `<span class="tag damaged">damaged</span>` : ""}</div>
        <div class="row"><a class="btn sm primary" href="${isoUrl(v)}">ISO ${fmt(v.iso7z)}</a></div>
      </div>
    </div>`).join("");
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
