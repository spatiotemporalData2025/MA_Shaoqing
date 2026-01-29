const RBushMod = require("rbush");
const RBush = require("rbush").default;
const knnMod = require("rbush-knn");
const knn = knnMod.default || knnMod;

const { haversineMeters } = require("./geo");

function normCat(cat) {
  const s = String(cat || "").trim().toLowerCase();
  if (!s) return "";

  if (s === "aed") return "aed";

  if (s === "shelter" || s === "emergency_shelter" || s === "amenity_shelter") {
    return "shelter";
  }

  if (s === "fire" || s === "fire_station" || s === "amenity_fire_station") {
    return "fire_station";
  }

  if (s === "police") return "police";

  if (s === "hospital") return "hospital";

  return s;
}

function buildCategoryIndexes(features) {
  const byCat = new Map();

  const fs = Array.isArray(features) ? features : [];
  for (const f of fs) {
    const p = f && f.properties ? f.properties : {};
    const cat = normCat(p.category);
    if (!cat) continue;

    const g = f && f.geometry ? f.geometry : null;
    if (!g || g.type !== "Point") continue;

    const coords = Array.isArray(g.coordinates) ? g.coordinates : null;
    if (!coords || coords.length < 2) continue;

    const lon = Number(coords[0]);
    const lat = Number(coords[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    if (!byCat.has(cat)) byCat.set(cat, new RBush());

    const item = {
      minX: lon,
      minY: lat,
      maxX: lon,
      maxY: lat,
      lon,
      lat,
      feature: f,
    };

    byCat.get(cat).insert(item);
  }

  return byCat;
}

function nearestFromIndexes(byCat, queryLat, queryLon, k, categories) {
  const out = [];

  const kk = Number(k);
  const K = Number.isFinite(kk) ? Math.max(1, Math.min(50, kk)) : 10;

  const catsRaw = Array.isArray(categories) ? categories : [];
  const cats = catsRaw.map(normCat).filter((x) => x.length > 0);

  if (cats.length === 0) {
    return { type: "FeatureCollection", features: [] };
  }

  for (const cat of cats) {
    const tree = byCat.get(cat);
    if (!tree) continue;

    const items = knn(tree, queryLon, queryLat, K);

    for (const it of items) {
      const d = haversineMeters(queryLat, queryLon, it.lat, it.lon);

      out.push({
        distance_m: d,
        feature: it.feature,
        cat,
      });
    }
  }

  out.sort((a, b) => a.distance_m - b.distance_m);

  const sliced = out.slice(0, K);

  return {
    type: "FeatureCollection",
    features: sliced.map((x) => {
      const f = x.feature;
      const p = f && f.properties ? f.properties : {};

      return {
        ...f,
        properties: {
          ...p,
          category: normCat(p.category),
          distance_m: Math.round(x.distance_m * 10) / 10,
        },
      };
    }),
  };
}

module.exports = { buildCategoryIndexes, nearestFromIndexes };
