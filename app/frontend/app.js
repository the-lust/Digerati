// Digerati front-end (Tauri 2 webview)
(() => {
  "use strict";

  const T = window.__TAURI__;
  const IS_TAURI = !!T;

  function makeMock() {
    const DEMO = window.DEMO || null;
    const MOCK = DEMO
      ? DEMO.items.map((x) => ({ v: x.v, n: x.n, nm: x.nm, ex: x.ex, desc: x.desc }))
      : [
      { v: "Vol_103", n: "Games/taz.swf" },
      { v: "Vol_103", n: "Games/snowballs.swf" },
      { v: "Vol_103", n: "Games/starship_seven.swf" },
      { v: "Vol_103", n: "Games/penguin_ski.swf" },
      { v: "Vol_103", n: "Games/pong_champ.swf" },
      { v: "Vol_103", n: "Tools/image_viewer.exe" },
      { v: "Vol_103", n: "Tools/audio_player.exe" },
      { v: "Vol_103", n: "Shockwave/balloon_pop.dcr" },
      { v: "Vol_103", n: "Shockwave/city_builder.dcr" },
      { v: "Vol_103", n: "Audio/theme_song.mp3" },
      { v: "Vol_103", n: "Audio/effects_pack.mp3" },
      { v: "Vol_103", n: "Video/launch_demo.flv" },
      { v: "Vol_103", n: "Wallpapers/forest.jpg" },
      { v: "Vol_103", n: "Wallpapers/space.jpg" },
      { v: "Vol_103", n: "Colouring/dino_colouring.jpg" },
      { v: "Vol_103", n: "Colouring/castle_colouring.jpg" },
      { v: "Vol_103", n: "Docs/readme.txt" },
      { v: "Vol_103", n: "Docs/help_manual.pdf" },
      { v: "Vol_104", n: "Games/raptor_attack.swf" },
      { v: "Vol_104", n: "Games/zoo_maze.swf" },
      { v: "Vol_104", n: "Games/kart_racer.swf" },
      { v: "Vol_104", n: "Tools/paint_tool.exe" },
      { v: "Vol_104", n: "Shockwave/ocean_world.dcr" },
      { v: "Vol_104", n: "Audio/title_track.mp3" },
      { v: "Vol_105", n: "Games/dragon_quest.swf" },
      { v: "Vol_105", n: "Games/candy_jump.swf" },
      { v: "Vol_105", n: "Media/trailer_2003.flv" },
      { v: "Vol_105", n: "Docs/instalacao.html" },
      { v: "Vol_105", n: "Wallpapers/night_city.jpg" },
    ];
    const secOf = (p) => {
      const ext = p.split(".").pop().toLowerCase();
      if (ext === "swf") return "games";
      if (ext === "exe") return "tools";
      if (ext === "dcr" || ext === "dir") return "shockwave";
      if (ext === "mp3" || ext === "wav" || ext === "flv") return "media";
      if (ext === "pdf" || ext === "txt" || ext === "html" || ext === "htm") return "docs";
      if (["jpg", "jpeg", "png", "gif", "bmp"].includes(ext)) {
        const low = p.toLowerCase();
        return low.includes("colour") || low.includes("colorir") ? "colouring" : "wallpapers";
      }
      return "extras";
    };
    const kindOf = (p) => {
      const ext = p.split(".").pop().toLowerCase();
      const map = {
        swf: ["Flash game", "🎮"], exe: ["Windows program", "🖥️"], dcr: ["Shockwave title", "💿"],
        jpg: ["Image", "🖼️"], mp3: ["Audio", "🎵"], flv: ["Video", "🎬"], pdf: ["Document", "📄"],
        txt: ["Document", "📄"], html: ["Document", "📄"],
      };
      return map[ext] || ["File", "📁"];
    };
    const nameOf = (p) => p.split("/").pop().replace(/\.[a-z0-9]+$/i, "");
    const itemOf = (g) => {
      const [kind, icon] = kindOf(g.n);
      return {
        v: g.v, n: g.n, s: g.s ?? 1, name: g.nm || nameOf(g.n),
        ext: g.ex || g.n.split(".").pop().toLowerCase(), kind, icon, section: secOf(g.n), art: null,
        desc: g.desc || "",
      };
    };
    const sections = {};
    MOCK.forEach((g) => {
      const s = secOf(g.n);
      sections[s] = (sections[s] || 0) + 1;
    });
    const volCounts = {};
    MOCK.forEach((m) => { volCounts[m.v] = (volCounts[m.v] || 0) + 1; });
    const fallbackVols = [
      { slug: "Vol_103", code: "103", title: "Champak Jogo Disk nº 103", date: "2003" },
      { slug: "Vol_104", code: "104", title: "Champak Jogo Disk nº 104", date: "2004" },
      { slug: "Vol_105", code: "105", title: "Champak Jogo Disk nº 105", date: "2004" },
    ];
    const vols = (DEMO ? DEMO.volumes : fallbackVols).map((v) => {
      const n = Number(v.total) || volCounts[v.slug] || 10;
      return {
        vol: v.title || v.slug, slug: v.slug, code: v.code || null, title: v.title || null, date: v.date || null,
        damaged: false, has_iso: false, cover: false, fileCount: n,
        rawBytes: n * 1800000, games7z: n * 1500000, iso7z: 0,
      };
    });
    const favs = [];
    const rec = [];
    const mset = { storage_policy: "full", menu_music: true, intro_sounds: true, close_sounds: true };
    const pushRec = (a, kind) => {
      rec.unshift({ slug: a.slug, name: nameOf(a.path), kind, ts: Math.floor(Date.now() / 1000) });
      rec.length = Math.min(rec.length, 12);
    };
    return {
      get_catalog: async () => ({
        meta: {
          volumeCount: vols.length, gameCount: MOCK.length, rawBytes: vols.reduce((a, v) => a + v.rawBytes, 0),
          games7zBytes: vols.reduce((a, v) => a + v.games7z, 0),
          iso7zBytes: 0, isoVolumeCount: 0, coverCount: 0, pagesUrl: "", repoUrl: "",
        },
        volumes: vols,
        sections,
      }),
      volume_states: async () => vols.map((v) => ({
        slug: v.slug, downloaded: false, iso_downloaded: false, extracted: false,
        size_mb: Math.round(v.games7z / 1024 / 1024),
      })),
      settings_get: async () => ({ ...mset, favorites: favs, recent: rec }),
      storage_stats: async () => ({ appdata_path: "C:\\Users\\Mock\\AppData\\Roaming\\Digerati", cache_bytes: 2.1e7, extracted_bytes: 2.28e8, transcode_bytes: 0, appdata_bytes: 4.6e8 }),
      player_port: async () => null,
      search: async (a) => {
        const q = (a.q || "").toLowerCase();
        const inSec = (g) =>
          a.section === "art"
            ? ["wallpapers", "colouring", "paint"].includes(secOf(g.n))
            : secOf(g.n) === a.section;
        const items = MOCK.filter((g) =>
          (!a.vol || g.v === a.vol) &&
          (!a.section || a.section === "all" || inSec(g)) &&
          (!q || nameOf(g.n).toLowerCase().includes(q) || g.n.toLowerCase().includes(q))
        ).map(itemOf);
        return { items, total: items.length, page: a.page || 0 };
      },
      volume_items: async (a) => ({ items: MOCK.filter((g) => g.v === a.volume).map(itemOf) }),
      settings_set: async (a) => { mset[a.key] = a.value; },
      favorites_add: async (a) => {
        const i = favs.indexOf(a.key);
        if (i >= 0) { favs.splice(i, 1); return false; }
        favs.unshift(a.key);
        return true;
      },
      favorites_remove: async (a) => {
        const i = favs.indexOf(a.key);
        if (i >= 0) favs.splice(i, 1);
      },
      play_swf: async (a) => { pushRec(a, "game"); return ""; },
      run_tool: async (a) => { pushRec(a, "tool"); return 0; },
      play_shockwave: async (a) => { pushRec(a, "shockwave"); return 0; },
      open_media: async (a) => { pushRec(a, "media"); return ""; },
    };
  }
  const mock = makeMock();
  const invoke = IS_TAURI
    ? T.core.invoke
    : (cmd, args) => (mock[cmd] ? mock[cmd](args || {}) : Promise.resolve(null));
  const listen = IS_TAURI ? T.event.listen : () => Promise.resolve(() => {});
  const isMock = () => !IS_TAURI;

  const state = {
    cat: { meta: {}, volumes: [], sections: {} },
    volumes: [],
    volStates: [],
    volMap: {},
    settings: null,
    port: null,
    section: "home",
    q: "",
    vol: "",
    page: 0,
    per: 24,
    loading: false,
  };

  const TABS = [
    ["home", "Home", "home"], ["library", "Library", "library"],
    ["games", "Games", "games"], ["tools", "Tools", "tools"],
    ["shockwave", "Shockwave", "shockwave"], ["media", "Media", "media"],
    ["art", "Art", "art"], ["docs", "Docs", "docs"],
    ["volumes", "Volumes", "volumes"], ["settings", "Settings", "settings"],
  ];
  const GROUPS = [
    { name: "Library", keys: ["home", "library"] },
    { name: "Browse", keys: ["games", "tools", "shockwave", "media", "art", "docs"] },
    { name: "Disks", keys: ["volumes"] },
  ];
  const BROWSE = new Set(["games", "tools", "shockwave", "media", "art", "docs"]);

  const root = document.getElementById("view");
  const tabsEl = document.getElementById("nav");
  const toolbar = document.getElementById("toolbar");
  const qEl = document.getElementById("q");
  const volEl = document.getElementById("volFilter");
  const countEl = document.getElementById("count");
  const loadMoreEl = document.getElementById("loadMore");
  const toasts = document.getElementById("toasts");

  // ---------------------------------------------------------------- helpers

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
  const encSeg = (s) => encodeURIComponent(String(s));
  const encPath = (p) => String(p).split("/").map(encSeg).join("/");
  const favKey = (it) => `${it.v}::${it.n}`;

  function debounce(fn, ms) { let t; return () => { clearTimeout(t); t = setTimeout(fn, ms); }; }

  function toast(msg, kind, pct) {
    const el = document.createElement("div");
    el.className = "toast" + (kind ? " " + kind : "");
    el.innerHTML = `<div class="tbar"><span>${msg}</span></div>` +
      (pct != null ? `<div class="pbar"><i style="width:${pct}%"></i></div>` : "");
    toasts.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }

  function fmtSize(b) {
    if (!b) return "—";
    const u = ["B", "KB", "MB", "GB"];
    let i = 0, v = b;
    while (v >= 2048 && i < u.length - 1) { v /= 1024; i++; }
    return v.toFixed(i === 0 ? 0 : 1) + " " + u[i];
  }

  function api(cmd, args) { return invoke(cmd, args || {}).catch((e) => { toast(esc(String(e)), "err"); throw e; }); }

  // ---------------------------------------------------------------- icons

  const ico = (p) => `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const ICONS = {
    games: ico('<path d="M6 12h4"/><path d="M8 10v4"/><path d="M15.2 13.2h.01"/><path d="M18.2 11h.01"/><path d="M17.6 8.2H6.4A4.6 4.6 0 0 0 1.9 13l.8 3.1a2.4 2.4 0 0 0 4 1.2l.9-1.1a2 2 0 0 1 1.5-.7h4.9a2 2 0 0 1 1.5.7l.9 1.1a2.4 2.4 0 0 0 4-1.2l.8-3.1a4.6 4.6 0 0 0-4.6-4.3z"/>'),
    tools: ico('<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>'),
    shockwave: ico('<rect x="2.5" y="3" width="19" height="18" rx="2.5"/><path d="M7 3v18"/><path d="M17 3v18"/><path d="M2.5 9.5h4.5"/><path d="M17 9.5h4.5"/><path d="M2.5 14.5h4.5"/><path d="M17 14.5h4.5"/>'),
    media: ico('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'),
    wallpapers: ico('<rect x="3" y="3" width="18" height="18" rx="2.5"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15.5l-5.2-5.2a1 1 0 0 0-1.4 0L5 19.8"/>'),
    colouring: ico('<path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/>'),
    paint: ico('<path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/>'),
    docs: ico('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H9"/>'),
    extras: ico('<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96 12 12.01l8.73-5.05"/><path d="M12 22.08V12"/>'),
    art: ico('<path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/>'),
    home: ico('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>'),
    library: ico('<path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>'),
    volumes: ico('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/>'),
    settings: ico('<path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M1 14h6"/><path d="M9 8h6"/><path d="M17 16h6"/>'),
  };

  // ---------------------------------------------------------------- boot

  async function boot() {
    try {
      const [cat, settings, states, port] = await Promise.all([
        api("get_catalog"), api("settings_get"), api("volume_states"), api("player_port"),
      ]);
      state.cat = cat || { meta: {}, volumes: [], sections: {} };
      state.volumes = (cat?.volumes || []).map((v) => v.slug);
      state.settings = settings;
      state.volStates = states || [];
      state.volMap = {};
      (states || []).forEach((vs) => { state.volMap[vs.slug] = vs; });
      state.port = port || null;
      buildTabs();
      buildVolFilter();
      render();
      setupMusic(settings);
      const want = new URLSearchParams(location.search).get("tab");
      if (want && TABS.some((t) => t[0] === want)) go(want);
    } catch (e) { /* already toasted */ }
  }

  const musicEl = new Audio();
  musicEl.loop = true;
  musicEl.volume = 0.55;
  async function setupMusic(settings) {
    try {
      if (isMock()) {
        musicEl.src = "trilha.mp3";
        window.addEventListener("pointerdown", function start() {
          if (settings && settings.menu_music === false) return;
          musicEl.play().catch(() => {});
          window.removeEventListener("pointerdown", start);
        });
      } else {
        const b64 = await api("music_b64");
        if (b64) {
          musicEl.src = "data:audio/mpeg;base64," + b64;
          if (settings && settings.menu_music !== false) musicEl.play().catch(() => {});
        }
      }
    } catch (e) { /* silent */ }
  }

  function buildTabs() {
    tabsEl.innerHTML = "";
    const main = document.createElement("div");
    main.className = "ng";
    const foot = document.createElement("div");
    foot.className = "nf";
    const addGroup = (parent, name, keys) => {
      if (name) {
        const h = document.createElement("div");
        h.className = "gh";
        h.textContent = name;
        parent.appendChild(h);
      }
      for (const key of keys) {
        const def = TABS.find((t) => t[0] === key);
        const b = document.createElement("button");
        b.className = "ni" + (key === state.section ? " on" : "");
        b.innerHTML = `${ICONS[def[2]] || ""}<span>${def[1]}</span>`;
        b.onclick = () => go(key);
        parent.appendChild(b);
      }
    };
    for (const g of GROUPS) addGroup(main, g.name, g.keys);
    addGroup(foot, null, ["settings"]);
    tabsEl.appendChild(main);
    tabsEl.appendChild(foot);
  }

  function buildVolFilter() {
    volEl.innerHTML = '<option value="">All volumes</option>';
    for (const slug of state.volumes) {
      const o = document.createElement("option");
      o.value = slug;
      o.textContent = slug;
      volEl.appendChild(o);
    }
  }

  async function go(section) {
    state.section = section;
    state.page = 0;
    root.scrollTop = 0;
    buildTabs();
    render();
  }

  function isBrowse() { return BROWSE.has(state.section); }

  async function render() {
    try {
      if (state.section === "home") return renderHome();
      if (state.section === "volumes") return renderVolumes();
      if (state.section === "library") return renderLibrary();
      if (state.section === "settings") return renderSettings();
      return renderBrowse(false);
    } catch (e) { /* errors already toasted by api() */ }
  }

  // ---------------------------------------------------------------- browse

  async function renderBrowse(append) {
    toolbar.hidden = false;
    if (state.loading) return;
    state.loading = true;
    try {
      const r = await api("search", {
        section: state.section, q: state.q, vol: state.vol,
        page: append ? state.page : 0, per: state.per,
      });
      state.page = (r.page ?? 0) + 1;
      countEl.textContent = `${r.total} ${r.total === 1 ? "file" : "files"}`;
      if (!append) root.innerHTML = "";
      const grid = root.querySelector(".grid") || (() => {
        const g = document.createElement("div");
        g.className = "grid";
        root.appendChild(g);
        return g;
      })();
      for (const it of r.items) grid.insertAdjacentHTML("beforeend", cardHTML(it));
      if (!r.items.length && !append) {
        root.innerHTML = '<div class="empty"><b>No files</b><br>Try a different search or volume.</div>';
      }
      loadMoreEl.hidden = state.page * state.per >= r.total;
    } catch (e) { /* toasted by api */ } finally {
      state.loading = false;
    }
  }

  function cardHTML(it) {
    const vs = state.volMap ? state.volMap[it.v] : null;
    const ready = !!(vs && vs.extracted);
    const art = ready && state.port && it.art
      ? `<img loading="lazy" src="http://127.0.0.1:${state.port}/vols/${encPath(it.v)}/${encPath(it.art)}" onerror="this.remove()">`
      : `<div class="cap"><div class="giant">${esc((it.name || "?").slice(0, 1).toUpperCase())}</div>
          <div class="ck">${esc(it.kind || it.ext)}</div>
          <div class="ct">${esc(it.name)}</div></div>`;
    const starOn = state.settings && state.settings.favorites.includes(favKey(it));
    const act = ready
      ? `<button class="play">Play</button>`
      : `<button class="inst">Install & play</button>`;
    return `<div class="card" data-v="${esc(it.v)}" data-n="${esc(it.n)}" data-s="${esc(it.section)}">
      <div class="art ${esc(it.section)}">${art}<span class="badge">${esc(it.ext)}</span></div>
      <button class="star ${starOn ? "on" : ""}" title="Favorite">${starOn ? "★" : "☆"}</button>
      <div class="info"><b class="cut" title="${esc(it.desc || it.name)}">${esc(it.name)}</b>
        <span>${esc(it.v)} · ${esc(it.kind)}</span></div>
      <div class="act">${act}</div>
    </div>`;
  }

  root.addEventListener("click", async (e) => {
    const star = e.target.closest(".star");
    if (star) {
      const c = star.closest(".card");
      const on = await api("favorites_add", { key: favKey({ v: c.dataset.v, n: c.dataset.n }) });
      star.textContent = on ? "★" : "☆";
      star.classList.toggle("on", on);
      toast(on ? "Added to favorites" : "Removed from favorites");
      return;
    }
    const play = e.target.closest(".play, .inst");
    if (play) {
      const c = play.closest(".card");
      play.disabled = true;
      try {
        await api("extract_volume", { slug: c.dataset.v });
        const it = { v: c.dataset.v, n: c.dataset.n, section: c.dataset.s };
        await launch(it);
        toast("Launched: " + it.n, "ok");
      } catch (e) { /* toasted */ }
      play.disabled = false;
      refreshStates();
      return;
    }
    const card = e.target.closest(".card");
    if (card) openDetail({ v: card.dataset.v, n: card.dataset.n, s: card.dataset.s });
  });

  async function launch(it) {
    if (it.section === "games") return api("play_swf", { slug: it.v, path: it.n });
    if (it.section === "tools") return api("run_tool", { slug: it.v, path: it.n });
    if (it.section === "shockwave") return api("play_shockwave", { slug: it.v, path: it.n });
    return api("open_media", { slug: it.v, path: it.n });
  }

  qEl.addEventListener("input", debounce(() => {
    state.q = qEl.value;
    state.page = 0;
    root.innerHTML = "";
    renderBrowse(false);
  }, 250));

  volEl.addEventListener("change", () => {
    state.vol = volEl.value;
    state.page = 0;
    root.innerHTML = "";
    renderBrowse(false);
  });

  loadMoreEl.onclick = () => renderBrowse(true);

  root.addEventListener("scroll", () => {
    if (!isBrowse()) return;
    if (root.scrollHeight - root.scrollTop - root.clientHeight < 800) renderBrowse(true);
  }, { passive: true });

  function openDetail(it) {
    const vs = state.volMap[it.v];
    const wrap = document.createElement("div");
    wrap.style.cssText = "position:fixed;inset:0;display:grid;place-items:center;background:rgba(0,0,0,.65);z-index:40;padding:24px";
    wrap.onclick = (e) => { if (e.target === wrap) wrap.remove(); };
    wrap.innerHTML = `<div class="panel" style="max-width:520px;width:100%">
      <h2 style="margin-top:0">${esc(it.n)}</h2>
      <div class="row">
        <span class="kbd">${esc(it.s)}</span>
        <span class="kbd">${esc(it.v)}</span>
        ${vs ? `<span class="kbd">${fmtSize(vs.size_mb * 1024 * 1024)}</span>` : ""}
      </div>
      ${it.desc ? `<p style="color:var(--dim)">${esc(it.desc)}</p>` : ""}
      <p style="color:var(--dim)">${esc(howTo(it.s))}</p>
      <div class="row"><button class="btn acc" id="dplay" style="width:auto">Play</button>
        <button class="btn" id="dfav">Favorite</button></div>
    </div>`;
    wrap.querySelector("#dplay").onclick = async () => {
      wrap.remove();
      try { await api("extract_volume", { slug: it.v }); await launch(it); toast("Launched: " + it.n, "ok"); }
      catch (e) { /* toasted */ }
    };
    wrap.querySelector("#dfav").onclick = async () => {
      await api("favorites_add", { key: favKey(it) });
      wrap.remove();
      toast("Favorite toggled");
    };
    document.body.appendChild(wrap);
  }

  function howTo(kind) {
    return {
      games: "Runs in an embedded Flash player (Ruffle). The game starts when its timeline loads — click or press a key to begin.",
      tools: "Opens as a native Windows program in its own window. Close it to get back here.",
      shockwave: "Plays through a bundled Adobe Director projector in a separate window.",
      media: "Plays the audio or video with the built-in player.",
      wallpapers: "Opens the image in the viewer.",
      colouring: "Opens the colouring sheet in the viewer.",
      art: "Opens the image in the viewer.",
      docs: "Opens the document in the built-in viewer.",
      extras: "Opens the file with the system default handler.",
    }[kind] || "Opens with the built-in viewer.";
  }

  // ---------------------------------------------------------------- home

  function renderHome() {
    toolbar.hidden = true;
    const m = state.cat.meta || {};
    const sec = state.cat.sections || {};
    const extCount = state.volStates.filter((v) => v.extracted).length;
    const downCount = state.volStates.filter((v) => v.downloaded).length;
    const totalVol = m.volumeCount || state.volumes.length;
    const totalGames = m.gameCount || 0;
    const stat = (label, v) => `<div class="stat"><span class="v">${v}</span><span class="l">${label}</span></div>`;
    const rows = [
      ["games", "Games"], ["tools", "Tools"], ["shockwave", "Shockwave"],
      ["media", "Media"], ["art", "Art"], ["docs", "Docs"],
    ];
    const artN = (sec.wallpapers || 0) + (sec.colouring || 0) + (sec.paint || 0);
    root.innerHTML = `
      <div class="hero">
        <img class="dragon" src="logo.png" alt="" draggable="false">
        <div class="htext">
          <p class="kicker">Champak Jogo Disk archive</p>
          <h1>Digerati</h1>
          <p>${totalVol} volumes, ${totalGames.toLocaleString()} listed files. Browse the disks, download the ones you want and play everything from this window.</p>
          <div class="row">
            <button class="btn acc big" id="goVol">Browse volumes</button>
            <button class="btn" id="goLib">Library</button>
            <button class="btn" id="goSet">Settings</button>
          </div>
        </div>
      </div>
      <div class="statgrid">
        ${stat("Volumes", totalVol)}
        ${stat("Files", totalGames.toLocaleString())}
        ${stat("Extracted", extCount)}
        ${stat("Downloaded", downCount)}
      </div>
      <div class="panel"><h2>Collections</h2><div class="seclist">
        ${rows.map(([k, label]) =>
          `<div class="sec" data-sec="${k}">${ICONS[k] || ""}<b>${label}</b><span class="n">${k === "art" ? artN : sec[k] || 0}</span></div>`
        ).join("")}
      </div></div>`;
    document.getElementById("goVol").onclick = () => go("volumes");
    document.getElementById("goLib").onclick = () => go("library");
    document.getElementById("goSet").onclick = () => go("settings");
    root.querySelectorAll(".seclist .sec").forEach((s) => {
      s.onclick = () => go(s.dataset.sec || "games");
    });
  }

  async function installAll() {
    const todo = state.volStates.filter((v) => !v.extracted);
    if (!todo.length) { toast("Everything is already installed", "ok"); return; }
    toast(`Installing ${todo.length} volumes…`);
    for (const vs of todo) {
      try { await api("extract_volume", { slug: vs.slug }); }
      catch (e) { toast("Failed " + vs.slug + ": " + esc(String(e)), "err"); }
    }
    await refreshStates();
    toast("Install batch finished", "ok");
  }

  // ---------------------------------------------------------------- volumes

  function renderVolumes() {
    toolbar.hidden = true;
    root.innerHTML = '<div class="vlist"></div>';
    const vl = root.querySelector(".vlist");
    for (const vs of state.volStates) {
      const cv = (state.cat.volumes || []).find((v) => v.slug === vs.slug) || {};
      const label = cv.title || vs.slug;
      const sub = [cv.code, cv.date, cv.fileCount ? `${cv.fileCount} files` : "", vs.extracted ? "ready" : vs.downloaded ? "downloaded" : "not downloaded"]
        .filter(Boolean).join(" · ");
      const row = document.createElement("div");
      row.className = "volrow" + (vs.extracted ? " live" : "");
      const pct = vs.extracted ? 100 : vs.downloaded ? 5 : 0;
      row.innerHTML = `
        <div class="disc">${esc(cv.code || vs.slug)}</div>
        <div class="vmeta"><b>${esc(label)}</b>
          <small>${esc(sub)}</small></div>
        <div class="vbar"><i style="width:${pct}%"></i></div>
        <div class="vbtns">
          <button class="playb" id="b${esc(vs.slug)}">${vs.extracted ? "Open" : vs.downloaded ? "Extract" : "Download & play"}</button>
          <button id="d${esc(vs.slug)}">Del</button>
        </div>`;
      row.querySelector(".playb").onclick = async (e) => {
        const b = e.target;
        b.disabled = true;
        try {
          await api("extract_volume", { slug: vs.slug });
          if (!vs.extracted) { await refreshStates(); return renderVolumes(); }
          state.vol = vs.slug;
          state.section = "games";
          state.page = 0;
          buildTabs();
          render();
        } catch (e2) { /* toasted */ }
        b.disabled = false;
      };
      row.querySelector("button[id^=d]").onclick = async () => {
        await api("delete_volume", { slug: vs.slug });
        toast(vs.slug + " deleted", "ok");
        refreshStates();
      };
      vl.appendChild(row);
    }
  }

  // ---------------------------------------------------------------- library

  async function renderLibrary() {
    toolbar.hidden = true;
    const st = await api("settings_get");    const favs = st.favorites || [], rec = st.recent || [];
    root.innerHTML = `
      <div class="panel"><h2>Favorites (${favs.length})</h2><div class="list" id="flist"></div></div>
      <div class="panel"><h2>Recently played</h2><div class="list" id="rlist"></div></div>`;
    const f = document.getElementById("flist");
    if (!favs.length) f.innerHTML = '<div class="empty">No favorites yet — click ☆ on any card.</div>';
    for (const k of favs) {
      const i = k.indexOf("::");
      const [v, n] = [k.slice(0, i), k.slice(i + 2)];
      const d = document.createElement("div");
      d.className = "li";
      d.innerHTML = `<b>${esc(n)}</b><small>${esc(v)}</small>`;
      const del = document.createElement("button");
      del.textContent = "✕";
      del.onclick = async () => { await api("favorites_remove", { key: k }); renderLibrary(); };
      d.appendChild(del);
      f.appendChild(d);
    }
    const r = document.getElementById("rlist");
    if (!rec.length) r.innerHTML = '<div class="empty">Nothing played yet.</div>';
    for (const e of rec) {
      const d = document.createElement("div");
      d.className = "li";
      d.innerHTML = `<b>${esc(e.name)}</b><small>${esc(e.kind)} ・ ${esc(e.slug)}</small>`;
      r.appendChild(d);
    }
  }

  // ---------------------------------------------------------------- settings

  async function renderSettings() {
    toolbar.hidden = true;
    const st = await api("settings_get");
    const stats = await api("storage_stats").catch(() => ({}));
    const ext = state.volStates.filter((v) => v.extracted).length;
    const dn = state.volStates.filter((v) => v.downloaded).length;
    const setRow = (key, label, hint, on) => `
      <div class="setrow"><div class="lab"><b>${label}</b><small>${hint}</small></div>
        <label class="switch"><input type="checkbox" data-k="${key}" ${on ? "checked" : ""}><i></i></label></div>`;
    root.innerHTML = `
      <div class="phead"><h1>Settings</h1><p>Playback, storage and the disks on this machine.</p></div>
      <div class="panel"><h2>Playback</h2>
        ${setRow("menu_music", "Menu music", "Play the original autorun soundtrack (trilha.mp3) in the background.", st.menu_music)}
        ${setRow("intro_sounds", "Intro sounds", "Digerati CD boot chimes when the app opens.", st.intro_sounds)}
        ${setRow("close_sounds", "Close sounds", "Disc-eject sound when closing a volume.", st.close_sounds)}
      </div>
      <div class="panel"><h2>Storage</h2>
        <div class="setrow"><div class="lab"><b>Storage policy</b><small>What happens when you play a file.</small></div>
          <select id="sp">
            <option value="full" ${st.storage_policy === "full" ? "selected" : ""}>Keep whole volume</option>
            <option value="file" ${st.storage_policy === "file" ? "selected" : ""}>Only requested files</option>
          </select></div>
        <dl class="kv">
          <dt>Library path</dt><dd>${esc(stats.appdata_path || "%APPDATA%\\Digerati")}</dd>
          <dt>Archives downloaded</dt><dd>${dn} &middot; ${fmtSize(stats.cache_bytes || 0)}</dd>
          <dt>Volumes extracted</dt><dd>${ext} &middot; ${fmtSize(stats.extracted_bytes || 0)}</dd>
          <dt>Transcodes</dt><dd>${fmtSize(stats.transcode_bytes || 0)}</dd>
          <dt>App data used</dt><dd>${fmtSize(stats.appdata_bytes || 0)}</dd>
        </dl>
        <div class="row">
          <button class="btn acc big" id="installAll">Install all volumes</button>
          <button class="btn warn" id="delAll">Delete all downloads</button>
        </div>
      </div>`;
    root.querySelectorAll('input[type=checkbox]').forEach((c) => c.onchange = () => {
      api("settings_set", { key: c.dataset.k, value: c.checked });
      if (c.dataset.k === "menu_music") {
        if (c.checked && !musicEl.src) setupMusic(state.settings);
        c.checked ? musicEl.play().catch(() => {}) : musicEl.pause();
      }
    });
    root.querySelector("#sp").onchange = (e) => api("settings_set", { key: "storage_policy", value: e.target.value });
    document.getElementById("installAll").onclick = () => installAll();
    document.getElementById("delAll").onclick = async () => {
      if (confirm("Delete every downloaded archive and extracted volume? This frees disk space.")) {
        await api("delete_all");
        toast("Everything deleted", "ok");
        refreshStates();
      }
    };
  }

  // ---------------------------------------------------------------- state

  async function refreshStates() {
    try {
      const states = await api("volume_states");
      state.volStates = states;
      state.volMap = {};
      states.forEach((vs) => { state.volMap[vs.slug] = vs; });
    } catch (e) { /* toasted */ }
  }

  // ---------------------------------------------------------------- events

  const dlToasts = {};

  listen("dl-progress", (e) => {
    const d = e.payload;
    const key = `${d.slug}:${d.kind || "games"}`;
    if (d.state === "done" || d.state === "cancelled") {
      const el = dlToasts[key];
      if (el) { el.remove(); delete dlToasts[key]; }
      if (d.state === "done") { toast(`${d.slug} downloaded`, "ok"); refreshStates().catch(() => {}); }
      else toast(`${d.slug} cancelled`);
      return;
    }
    if (!dlToasts[key]) {
      const el = document.createElement("div");
      el.className = "toast";
      el.innerHTML = `<div class="tbar"><span>${esc(d.slug)}</span></div><div class="pbar"><i></i></div>`;
      toasts.appendChild(el);
      dlToasts[key] = el;
    }
    const el = dlToasts[key];
    el.querySelector("i").style.width = (d.pct ?? 0) + "%";
  }).catch(() => {});
  listen("extract-progress", (e) => {
    const d = e.payload;
    if (d.state === "done") { toast(`${d.slug} ready`, "ok"); refreshStates().catch(() => {}); }
  }).catch(() => {});

  boot();
})();