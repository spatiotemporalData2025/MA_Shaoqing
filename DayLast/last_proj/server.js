// server.js
const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");

const { buildCategoryIndexes, nearestFromIndexes } = require("./algorithms/rtree");
const { topKByMisraGries } = require("./algorithms/misra_gries");
const { dbscan } = require("./algorithms/dbscan");

const app = express();
app.use(cors());
app.use(express.json());

const DATA_DIR = path.join(__dirname, "data");
const AREAS_PATH = path.join(DATA_DIR, "areas.json");
const PROCESSED_DIR = path.join(DATA_DIR, "processed");

app.use(express.static(path.join(__dirname, "public")));

function loadAreas() {
  const text = fs.readFileSync(AREAS_PATH, "utf-8");
  return JSON.parse(text);
}

const areaCache = new Map();

function loadAreaBundle(areaId) {
  if (areaCache.has(areaId)) return areaCache.get(areaId);

  const areas = loadAreas();
  const info = areas[areaId];
  if (!info) return null;

  const filePath = path.join(PROCESSED_DIR, info.file);
  if (!fs.existsSync(filePath)) return null;

  const geo = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const features = Array.isArray(geo.features) ? geo.features : [];

  const byCat = buildCategoryIndexes(features);

  const bundle = { geo, byCat };
  areaCache.set(areaId, bundle);
  return bundle;
}

// =========================
// Utils
// =========================
function normCat(cat) {
  const s = String(cat || "").trim().toLowerCase();
  if (!s) return "";

  if (s === "aed") return "aed";

  if (s === "shelter" || s === "emergency_shelter" || s === "amenity_shelter") return "shelter";

  if (s === "fire" || s === "fire_station" || s === "amenity_fire_station") return "fire_station";

  if (s === "police") return "police";
  if (s === "hospital") return "hospital";

  return s;
}

function parseCategoriesParam(raw) {
  const categoriesRaw = String(raw || "");
  return categoriesRaw
    .split(",")
    .map((s) => normCat(s))
    .filter((s) => s.length > 0);
}

function extractPointsFromGeo(geo, categories) {
  const set = new Set((categories || []).map(normCat));
  const feats = Array.isArray(geo && geo.features) ? geo.features : [];
  const out = [];

  for (const f of feats) {
    const p = f && f.properties ? f.properties : {};
    const cat = normCat(p.category);
    if (set.size > 0 && !set.has(cat)) continue;

    const g = f && f.geometry ? f.geometry : null;
    if (!g || g.type !== "Point") continue;

    const coords = Array.isArray(g.coordinates) ? g.coordinates : null;
    if (!coords || coords.length < 2) continue;

    const lon = Number(coords[0]);
    const lat = Number(coords[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    out.push({ lat, lon, feature: f, category: cat });
  }

  return out;
}

// Convex Hull (Monotonic Chain) for lon/lat
function convexHullLonLat(points) {
  // points: [{lon,lat}, ...]  -> return hull vertices [{lon,lat}, ...]
  if (!Array.isArray(points) || points.length < 3) return points || [];

  const pts = points
    .map((p) => ({ lon: Number(p.lon), lat: Number(p.lat) }))
    .filter((p) => Number.isFinite(p.lon) && Number.isFinite(p.lat))
    .sort((a, b) => (a.lon !== b.lon ? a.lon - b.lon : a.lat - b.lat));

  if (pts.length < 3) return pts;

  function cross(o, a, b) {
    return (a.lon - o.lon) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lon - o.lon);
  }

  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

// centroid (simple average) for lon/lat
function centroidLonLat(points) {
  let sx = 0;
  let sy = 0;
  let n = 0;

  for (const p of points) {
    const lon = Number(p.lon);
    const lat = Number(p.lat);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    sx += lon;
    sy += lat;
    n++;
  }

  if (n === 0) return { lon: 0, lat: 0 };
  return { lon: sx / n, lat: sy / n };
}

// =========================
// APIs
// =========================
app.get("/api/areas", (req, res) => {
  try {
    res.json(loadAreas());
  } catch (e) {
    res.status(500).json({ error: "failed to load areas.json" });
  }
});

app.get("/api/points", (req, res) => {
  const area = String(req.query.area || "");
  const category = req.query.category ? String(req.query.category) : "";

  if (!area) return res.status(400).json({ error: "missing area" });

  const bundle = loadAreaBundle(area);
  if (!bundle) return res.status(404).json({ error: "area not found or geojson missing" });

  const geo = bundle.geo;

  if (!category) return res.json(geo);

  const filtered = {
    type: "FeatureCollection",
    features: (geo.features || []).filter((f) => (f.properties || {}).category === category),
  };
  res.json(filtered);
});

app.get("/api/rtree/nearest", (req, res) => {
  const area = String(req.query.area || "");
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  const k = Math.max(1, Math.min(50, Number(req.query.k || 10)));

  const categories = parseCategoriesParam(req.query.categories || "");

  if (!area) return res.status(400).json({ error: "missing area" });
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return res.status(400).json({ error: "invalid lat/lon" });
  if (categories.length === 0) return res.json({ type: "FeatureCollection", features: [] });

  const bundle = loadAreaBundle(area);
  if (!bundle) return res.status(404).json({ error: "area not found or geojson missing" });

  const result = nearestFromIndexes(bundle.byCat, lat, lon, k, categories);
  res.json(result);
});

// =========================
// Misra–Gries Top-K (by category counts)
// GET /api/misra/topk?area=xxx&k=5&categories=aed,shelter,...
// =========================
app.get("/api/misra/topk", (req, res) => {
  try {
    const area = String(req.query.area || "");
    const k = Number(req.query.k || 5);
    const categories = parseCategoriesParam(req.query.categories || "");

    if (!area) return res.status(400).json({ error: "missing area" });
    if (!Number.isFinite(k) || k <= 0) return res.status(400).json({ error: "invalid k" });

    const bundle = loadAreaBundle(area);
    if (!bundle) return res.status(404).json({ error: "area not found or geojson missing" });

    // 统计 key = category（只在选中的 categories 内）
    const pts = extractPointsFromGeo(bundle.geo, categories);
    const keys = pts.map((x) => x.category);

    const items = topKByMisraGries(keys, k); // [{key,count}]
    res.json({
      area,
      k,
      categories,
      total_points: pts.length,
      items,
    });
  } catch (e) {
    res.status(500).json({ error: e.message || "misra failed" });
  }
});

// =========================
// DBSCAN with hull range
// GET /api/dbscan?area=xxx&eps_m=250&minPts=6&categories=...
// returns geo: Polygon(hull) + Point(center) per cluster
// =========================
app.get("/api/dbscan", (req, res) => {
  try {
    const area = String(req.query.area || "");
    const eps_m = Number(req.query.eps_m || 250);
    const minPts = Number(req.query.minPts || 6);
    const categories = parseCategoriesParam(req.query.categories || "");

    if (!area) return res.status(400).json({ error: "missing area" });
    if (!Number.isFinite(eps_m) || eps_m <= 0) return res.status(400).json({ error: "invalid eps_m" });
    if (!Number.isFinite(minPts) || minPts < 2) return res.status(400).json({ error: "invalid minPts" });
    if (categories.length === 0) return res.json({ area, eps_m, minPts, categories, points: 0, clusters: [], noise: 0, geo: { type: "FeatureCollection", features: [] } });

    const bundle = loadAreaBundle(area);
    if (!bundle) return res.status(404).json({ error: "area not found or geojson missing" });

    const pts = extractPointsFromGeo(bundle.geo, categories);
    if (pts.length === 0) {
      return res.json({
        area,
        eps_m,
        minPts,
        categories,
        points: 0,
        clusters: [],
        noise: 0,
        geo: { type: "FeatureCollection", features: [] },
      });
    }

    // dbscan expects [{lat, lon, feature}]
    const points = pts.map((x) => ({ lat: x.lat, lon: x.lon, feature: x.feature }));
    const result = dbscan(points, eps_m, minPts); // {labels, clusterCount}

    // cluster -> members indices
    const members = new Map(); // cid -> [idx...]
    let noise = 0;
    for (let i = 0; i < result.labels.length; i++) {
      const cid = result.labels[i];
      if (cid < 0) {
        noise++;
        continue;
      }
      if (!members.has(cid)) members.set(cid, []);
      members.get(cid).push(i);
    }

    // cluster summaries
    const outClusters = [];
    for (let cid = 0; cid < result.clusterCount; cid++) {
      const idxs = members.get(cid) || [];
      if (idxs.length === 0) continue;

      const lonLat = idxs.map((i) => ({ lon: points[i].lon, lat: points[i].lat }));
      const center = centroidLonLat(lonLat);

      outClusters.push({
        id: cid,
        count: idxs.length,
        center,
      });
    }

    // ✅ GeoJSON: hull polygons + centers
    const outFeatures = [];

    for (const c of outClusters) {
      const idxs = members.get(c.id) || [];
      const lonLat = idxs.map((i) => ({ lon: points[i].lon, lat: points[i].lat }));

      const hull = convexHullLonLat(lonLat);
      if (hull.length >= 3) {
        const ring = hull.map((p) => [p.lon, p.lat]);
        ring.push([hull[0].lon, hull[0].lat]); // close polygon

        outFeatures.push({
          type: "Feature",
          geometry: { type: "Polygon", coordinates: [ring] },
          properties: {
            kind: "hull",
            cluster_id: c.id,
            count: c.count,
          },
        });
      }

      outFeatures.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [c.center.lon, c.center.lat] },
        properties: {
          kind: "center",
          cluster_id: c.id,
          count: c.count,
        },
      });
    }

    const geoOut = { type: "FeatureCollection", features: outFeatures };

    res.json({
      area,
      eps_m,
      minPts,
      categories,
      points: points.length,
      clusters: outClusters,
      noise,
      geo: geoOut,
    });
  } catch (e) {
    res.status(500).json({ error: e.message || "dbscan failed" });
  }
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(PORT, () => {
  console.log(`server running: http://localhost:${PORT}`);
});
