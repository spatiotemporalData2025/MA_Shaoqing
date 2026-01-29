/// public/main.js
// 目标：三个功能都稳定可用
// 1) 勾选类别 -> 地图点位刷新（前端过滤）
// 2) 点击地图 -> R-tree 最近K + 列表 + 高亮
// 3) Misra Top-K（Run Misra）
// 4) DBSCAN：显示簇中心 + “范围(hull polygon)” + 列表

let map;
let geoLayer;       // base points (filtered by selected categories)
let clickLayer;     // clicked point
let nearestLayer;   // nearest K markers
let clusterLayer;   // dbscan hull + centers

const ONLY_SHOW_NEAREST = true; // 点击后只显示最近 K 个

function getCss(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

const CATEGORY_STYLE = {
  aed: { radius: 6, color: getCss("--aed") },
  shelter: { radius: 6, color: getCss("--shelter") },
  assembly_point: { radius: 6, color: getCss("--assembly") },
  fire_station: { radius: 6, color: getCss("--fire") },
  police: { radius: 6, color: getCss("--police") },
  hospital: { radius: 6, color: getCss("--hospital") },
};

function normCat(x) {
  return String(x || "").trim().toLowerCase();
}

// --------------------
// UI helpers
// --------------------
function setStatus(text) {
  const el = document.getElementById("statusText");
  if (el) el.textContent = text;
}

function setCount(n) {
  const el = document.getElementById("countText");
  if (el) el.textContent = String(n);
}

function showLoading(on) {
  const el = document.getElementById("loading");
  if (!el) return;
  el.classList.toggle("loading--show", !!on);
}

function showToast(title, msg) {
  const toast = document.getElementById("toast");
  const t = document.getElementById("toastTitle");
  const m = document.getElementById("toastMsg");
  if (!toast || !t || !m) return;

  t.textContent = title || "";
  m.textContent = msg || "";
  toast.classList.add("toast--show");
}

function hideToast() {
  const toast = document.getElementById("toast");
  if (toast) toast.classList.remove("toast--show");
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} for ${url}${t ? `: ${t}` : ""}`);
  }
  return await res.json();
}

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// --------------------
// Category filters
// --------------------
function getSelectedCategories() {
  const wrap = document.getElementById("categoryChecks");
  if (!wrap) return [];

  // ✅ 关键：不要写成 [wrap.querySelectorAll(...)] 这种会炸
  const inputs = Array.from(wrap.querySelectorAll('input[type="checkbox"]'));

  return inputs
    .filter((x) => x.checked)
    .map((x) => normCat(x.value))
    .filter((x) => x.length > 0);
}

function filterByCategories(geo, cats) {
  const features = Array.isArray(geo && geo.features) ? geo.features : [];
  if (!cats || cats.length === 0) return { type: "FeatureCollection", features: [] };

  const set = new Set(cats.map(normCat));
  const kept = features.filter((f) => {
    const c = normCat(f && f.properties ? f.properties.category : "");
    return set.has(c);
  });

  return { type: "FeatureCollection", features: kept };
}

// --------------------
// Map styles
// --------------------
function pointMarkerStyle(feature) {
  const p = feature && feature.properties ? feature.properties : {};
  const cat = normCat(p.category);
  const s = CATEGORY_STYLE[cat] || { radius: 6, color: "#0ea5e9" };

  return {
    radius: s.radius,
    weight: 2,
    color: s.color,
    fillColor: s.color,
    fillOpacity: 0.35,
  };
}

function bindPopupForFeature(layer, feature) {
  const p = feature && feature.properties ? feature.properties : {};
  const name = p.name ? p.name : "(no name)";
  const cat = p.category ? p.category : "";
  const id = p.id ? p.id : "";
  const dist = p.distance_m != null ? `${p.distance_m} m` : "";

  const sub = [cat, id ? `• ${id}` : "", dist ? `• ${dist}` : ""].filter((x) => x).join(" ");

  layer.bindPopup(
    `<div style="font-weight:800;margin-bottom:4px">${escapeHtml(name)}</div>
     <div style="font-size:12px;opacity:0.85">${escapeHtml(sub)}</div>`
  );
}

// --------------------
// Map init
// --------------------
function initMap() {
  map = L.map("map", { zoomControl: true, preferCanvas: true });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  geoLayer = L.geoJSON([], {
    pointToLayer: (feature, latlng) => L.circleMarker(latlng, pointMarkerStyle(feature)),
    onEachFeature: (feature, layer) => bindPopupForFeature(layer, feature),
  }).addTo(map);

  clickLayer = L.layerGroup().addTo(map);
  nearestLayer = L.layerGroup().addTo(map);

  // DBSCAN：画 hull(Polygon) + center(Point)
  // server.js 已经返回 geo.features 包含 kind=hull / kind=center :contentReference[oaicite:2]{index=2}
  clusterLayer = L.geoJSON([], {
    style: (feature) => {
      const p = (feature && feature.properties) || {};
      if (p.kind === "hull") {
        return {
          weight: 2,
          color: "#111827",
          fillOpacity: 0.12,
        };
      }
      return { weight: 2, color: "#111827" };
    },
    pointToLayer: (feature, latlng) => {
      const p = (feature && feature.properties) || {};
      if (p.kind === "center") {
        return L.circleMarker(latlng, {
          radius: 9,
          weight: 2,
          color: "#111827",
          fillColor: "#111827",
          fillOpacity: 0.85,
        });
      }
      return L.circleMarker(latlng, { radius: 6 });
    },
    onEachFeature: (feature, layer) => {
      const p = (feature && feature.properties) || {};
      if (!p.kind) return;
      const cid = p.cluster_id != null ? String(p.cluster_id) : "";
      const cnt = p.count != null ? String(p.count) : "";
      layer.bindPopup(
        `<div style="font-weight:900">${escapeHtml(p.kind)} cluster ${escapeHtml(cid)}</div>
         <div style="font-size:12px;opacity:0.85">points: ${escapeHtml(cnt)}</div>`
      );
    },
  }).addTo(map);

  map.setView([35.6762, 139.6503], 11);

  // 点击地图 -> 最近K
  map.on("click", (e) => {
    if (!e || !e.latlng) return;
    runNearest(e.latlng.lat, e.latlng.lng);
  });
}

function ensureBaseLayerVisible() {
  if (!ONLY_SHOW_NEAREST) return;
  if (!map.hasLayer(geoLayer)) geoLayer.addTo(map);
}

function hideBaseLayer() {
  if (!ONLY_SHOW_NEAREST) return;
  if (map.hasLayer(geoLayer)) map.removeLayer(geoLayer);
}

// --------------------
// Load areas & base points
// --------------------
async function loadAreas() {
  const areas = await fetchJSON("/api/areas");
  const select = document.getElementById("areaSelect");
  if (!select) return "";

  select.innerHTML = "";

  const ids = Object.keys(areas || {}).sort();
  for (const id of ids) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = areas[id] && areas[id].name ? areas[id].name : id;
    select.appendChild(opt);
  }
  return ids.length ? ids[0] : "";
}

// /api/points 只支持 area(+可选 category 单个)，
// 我们稳定做法：拿全量 -> 前端按勾选过滤。:contentReference[oaicite:3]{index=3}
async function loadAndRenderBasePoints({ fit = false } = {}) {
  hideToast();
  showLoading(true);

  try {
    const sel = document.getElementById("areaSelect");
    const area = sel ? sel.value : "";
    const cats = getSelectedCategories();

    if (!area) {
      geoLayer.clearLayers();
      setCount(0);
      setStatus("no area");
      return;
    }

    setStatus("loading...");
    const geoAll = await fetchJSON(`/api/points?area=${encodeURIComponent(area)}`);
    const geo = filterByCategories(geoAll, cats);

    geoLayer.clearLayers();
    geoLayer.addData(geo);

    const n = Array.isArray(geo && geo.features) ? geo.features.length : 0;
    setCount(n);
    setStatus("ok");

    if (fit) {
      const b = geoLayer.getBounds();
      if (b && b.isValid() && n > 0) map.fitBounds(b.pad(0.15));
    }
  } catch (e) {
    setStatus("error");
    showToast("Load failed", e.message);
  } finally {
    showLoading(false);
  }
}

// --------------------
// Nearest (R-tree)
// --------------------
function setNearestList(features) {
  const list = document.getElementById("nearestList");
  if (!list) return;

  const feats = Array.isArray(features) ? features : [];
  if (feats.length === 0) {
    list.innerHTML = `<div style="font-size:12px;color:rgba(15,23,42,0.7)">No results</div>`;
    return;
  }

  list.innerHTML = "";
  for (const f of feats) {
    const p = f && f.properties ? f.properties : {};
    const name = p.name ? p.name : "(no name)";
    const cat = p.category ? p.category : "";
    const dist = p.distance_m != null ? `${p.distance_m} m` : "-";

    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `
      <div class="item__top">
        <div class="item__name">${escapeHtml(name)}</div>
        <div class="item__dist">${escapeHtml(dist)}</div>
      </div>
      <div class="item__sub">${escapeHtml(cat)}</div>
    `;
    list.appendChild(el);
  }
}

function drawClickPoint(lat, lon) {
  clickLayer.clearLayers();
  L.circleMarker([lat, lon], {
    radius: 7,
    weight: 2,
    color: "#111827",
    fillColor: "#111827",
    fillOpacity: 0.25,
  }).addTo(clickLayer);
}

function drawNearestMarkers(geo) {
  nearestLayer.clearLayers();
  const feats = Array.isArray(geo && geo.features) ? geo.features : [];

  for (const f of feats) {
    const coords = f && f.geometry ? f.geometry.coordinates : null;
    if (!Array.isArray(coords) || coords.length < 2) continue;

    const p = f && f.properties ? f.properties : {};
    const cat = normCat(p.category);
    const s = CATEGORY_STYLE[cat] || { radius: 7, color: "#0ea5e9" };

    const m = L.circleMarker([coords[1], coords[0]], {
      radius: s.radius + 5,
      weight: 3,
      color: "#111827",
      fillColor: s.color,
      fillOpacity: 0.9,
    }).addTo(nearestLayer);

    bindPopupForFeature(m, f);
  }
}

async function runNearest(lat, lon) {
  hideToast();

  const sel = document.getElementById("areaSelect");
  const area = sel ? sel.value : "";
  const cats = getSelectedCategories();

  const kEl = document.getElementById("nearestK");
  const kInput = Number(kEl ? kEl.value : 10);
  const k = Number.isFinite(kInput) ? Math.max(1, Math.min(50, kInput)) : 10;

  drawClickPoint(lat, lon);

  if (!area || cats.length === 0) {
    setNearestList([]);
    nearestLayer.clearLayers();
    ensureBaseLayerVisible();
    return;
  }

  try {
    const url =
      `/api/rtree/nearest?area=${encodeURIComponent(area)}` +
      `&lat=${encodeURIComponent(lat)}` +
      `&lon=${encodeURIComponent(lon)}` +
      `&k=${encodeURIComponent(k)}` +
      `&categories=${encodeURIComponent(cats.join(","))}`;

    const geo = await fetchJSON(url);
    setNearestList(geo.features || []);
    drawNearestMarkers(geo);

    hideBaseLayer();
  } catch (e) {
    showToast("Nearest failed", e.message);
    setNearestList([]);
    nearestLayer.clearLayers();
    ensureBaseLayerVisible();
  }
}

function clearNearest() {
  setNearestList([]);
  clickLayer.clearLayers();
  nearestLayer.clearLayers();
  ensureBaseLayerVisible();
}

// --------------------
// Misra Top-K
// server: /api/misra/topk -> { items:[{key,count}], ... } :contentReference[oaicite:4]{index=4}
// --------------------
function setMisraList(items) {
  const list = document.getElementById("misraList");
  if (!list) return;

  const xs = Array.isArray(items) ? items : [];
  if (xs.length === 0) {
    list.innerHTML = `<div style="font-size:12px;color:rgba(15,23,42,0.7)">No results</div>`;
    return;
  }

  list.innerHTML = "";
  for (const it of xs) {
    const key = it && it.key ? String(it.key) : "";
    const count = it && it.count != null ? String(it.count) : "0";

    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `
      <div class="item__top">
        <div class="item__name">${escapeHtml(key)}</div>
        <div class="item__dist">${escapeHtml(count)}</div>
      </div>
      <div class="item__sub">count</div>
    `;
    list.appendChild(el);
  }
}

async function runMisra() {
  hideToast();
  showLoading(true);

  try {
    const sel = document.getElementById("areaSelect");
    const area = sel ? sel.value : "";
    const cats = getSelectedCategories();

    const kEl = document.getElementById("misraK");
    const kInput = Number(kEl ? kEl.value : 5);
    const k = Number.isFinite(kInput) ? Math.max(1, Math.min(50, kInput)) : 5;

    if (!area || cats.length === 0) {
      setMisraList([]);
      return;
    }

    const url =
      `/api/misra/topk?area=${encodeURIComponent(area)}` +
      `&k=${encodeURIComponent(k)}` +
      `&categories=${encodeURIComponent(cats.join(","))}`;

    const data = await fetchJSON(url);
    setMisraList(data.items || []);
  } catch (e) {
    showToast("Misra failed", e.message);
    setMisraList([]);
  } finally {
    showLoading(false);
  }
}

function clearMisra() {
  setMisraList([]);
}

// --------------------
// DBSCAN
// server: /api/dbscan -> { clusters:[...], noise:int, geo:FeatureCollection } :contentReference[oaicite:5]{index=5}
// --------------------
function setDbList(clusters, noise) {
  const list = document.getElementById("dbList");
  if (!list) return;

  const xs = Array.isArray(clusters) ? clusters : [];
  if (xs.length === 0) {
    list.innerHTML = `<div style="font-size:12px;color:rgba(15,23,42,0.7)">No clusters (noise: ${escapeHtml(
      String(noise || 0)
    )})</div>`;
    return;
  }

  list.innerHTML = "";
  for (const c of xs) {
    const id = c && c.id != null ? String(c.id) : "";
    const count = c && c.count != null ? String(c.count) : "0";

    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `
      <div class="item__top">
        <div class="item__name">cluster ${escapeHtml(id)}</div>
        <div class="item__dist">${escapeHtml(count)}</div>
      </div>
      <div class="item__sub">points</div>
    `;
    list.appendChild(el);
  }
}

async function runDbscan() {
  hideToast();
  showLoading(true);

  try {
    const sel = document.getElementById("areaSelect");
    const area = sel ? sel.value : "";
    const cats = getSelectedCategories();

    const epsEl = document.getElementById("dbEps");
    const minEl = document.getElementById("dbMinPts");
    const eps = Number(epsEl ? epsEl.value : 200);
    const minPts = Number(minEl ? minEl.value : 6);

    if (!area || cats.length === 0) {
      clusterLayer.clearLayers();
      setDbList([], 0);
      return;
    }

    const url =
      `/api/dbscan?area=${encodeURIComponent(area)}` +
      `&eps_m=${encodeURIComponent(eps)}` +
      `&minPts=${encodeURIComponent(minPts)}` +
      `&categories=${encodeURIComponent(cats.join(","))}`;

    const data = await fetchJSON(url);

    // 画范围（hull）+ 中心（center）
    clusterLayer.clearLayers();
    if (data.geo) clusterLayer.addData(data.geo);

    setDbList(data.clusters || [], data.noise || 0);

    // DBSCAN 是“整体分析”，不要隐藏 base layer
    ensureBaseLayerVisible();
  } catch (e) {
    showToast("DBSCAN failed", e.message);
    clusterLayer.clearLayers();
    setDbList([], 0);
  } finally {
    showLoading(false);
  }
}

function clearDbscan() {
  clusterLayer.clearLayers();
  setDbList([], 0);
}

// --------------------
// Global clear when switching filters
// --------------------
function clearAnalyticsPanels() {
  clearNearest();
  clearMisra();
  clearDbscan();
}

// --------------------
// Bind UI
// --------------------
function bindUI() {
  const toastClose = document.getElementById("toastClose");
  if (toastClose) toastClose.addEventListener("click", () => hideToast());

  const areaSelect = document.getElementById("areaSelect");
  if (areaSelect) {
    areaSelect.addEventListener("change", async () => {
      clearAnalyticsPanels();
      await loadAndRenderBasePoints({ fit: true });
    });
  }

  const checks = document.getElementById("categoryChecks");
  if (checks) {
    checks.addEventListener("change", async () => {
      clearAnalyticsPanels();
      await loadAndRenderBasePoints();
    });
  }

  const fitBtn = document.getElementById("fitBtn");
  if (fitBtn) {
    fitBtn.addEventListener("click", () => {
      ensureBaseLayerVisible();
      const b = geoLayer.getBounds();
      if (b && b.isValid()) map.fitBounds(b.pad(0.15));
    });
  }

  const reloadBtn = document.getElementById("reloadBtn");
  if (reloadBtn) reloadBtn.addEventListener("click", () => loadAndRenderBasePoints({ fit: false }));

  // Misra buttons
  const misraRunBtn = document.getElementById("misraRunBtn");
  if (misraRunBtn) misraRunBtn.addEventListener("click", () => runMisra());

  const misraClearBtn = document.getElementById("misraClearBtn");
  if (misraClearBtn) misraClearBtn.addEventListener("click", () => clearMisra());

  // DBSCAN buttons
  const dbRunBtn = document.getElementById("dbRunBtn");
  if (dbRunBtn) dbRunBtn.addEventListener("click", () => runDbscan());

  const dbClearBtn = document.getElementById("dbClearBtn");
  if (dbClearBtn) dbClearBtn.addEventListener("click", () => clearDbscan());
}

// --------------------
// Boot
// --------------------
(async function main() {
  initMap();
  await loadAreas();
  await loadAndRenderBasePoints({ fit: true });
  bindUI();
})();
