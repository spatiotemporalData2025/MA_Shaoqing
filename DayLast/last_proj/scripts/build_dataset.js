// scripts/build_dataset.js
// 作用：
// data/raw/<ward>.geojson
//   → data/processed/<ward>_points.geojson
// 每个区一个文件，输出是点数据，统一字段，并加上 ward 和 category

const fs = require("fs");
const path = require("path");

const RAW_DIR = path.join(__dirname, "..", "data", "raw");
const OUT_DIR = path.join(__dirname, "..", "data", "processed");

const CATEGORIES = {
  AED: "aed",
  SHELTER: "shelter",
  ASSEMBLY: "assembly_point",
  FIRE: "fire_station",
  POLICE: "police",
  HOSPITAL: "hospital",
};

// ========================
// IO
// ========================
function readJson(filePath) {
  const text = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(text);
}

function writeJson(filePath, obj) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), "utf-8");
}

// ========================
// Utils
// ========================
function normalizeStr(x) {
  if (x == null) return "";
  return String(x).trim();
}

function baseNameNoExt(filename) {
  return filename.replace(/\.geojson$/i, "");
}

// Overpass Turbo 的 GeoJSON：
// tags 可能在 properties.tags 里，也可能直接平铺在 properties 里
function getTags(feature) {
  const p = feature && feature.properties ? feature.properties : {};
  if (p.tags && typeof p.tags === "object") {
    return { ...p.tags, ...p };
  }
  return { ...p };
}

function pickId(tags) {
  if (typeof tags["@id"] === "string" && tags["@id"].length > 0) return tags["@id"];
  if (typeof tags.id === "number" || typeof tags.id === "string") return String(tags.id);
  if (typeof tags.osm_id === "number" || typeof tags.osm_id === "string") return String(tags.osm_id);
  return "";
}

// ========================
// 分类规则
// ========================
function classify(tags) {
  const amenity = normalizeStr(tags.amenity);
  const emergency = normalizeStr(tags.emergency);

  // AED
  if (emergency === "defibrillator" || emergency === "aed") return CATEGORIES.AED;

  // Shelter
  if (amenity === "shelter" || emergency === "shelter") return CATEGORIES.SHELTER;

  // Assembly Point
  if (emergency === "assembly_point") return CATEGORIES.ASSEMBLY;

  // Fire Station
  if (amenity === "fire_station") return CATEGORIES.FIRE;

  // Police
  if (amenity === "police") return CATEGORIES.POLICE;

  // Hospital
  if (amenity === "hospital") return CATEGORIES.HOSPITAL;

  return "";
}

// ========================
// GeoJSON 构造
// ========================
function toPointFeature(lon, lat, props) {
  return {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [lon, lat],
    },
    properties: props,
  };
}

// ========================
// 核心处理：一个区一个文件
// ========================
function buildOneWardFile(inPath, outPath, wardName) {
  const geo = readJson(inPath);

  if (!geo || geo.type !== "FeatureCollection" || !Array.isArray(geo.features)) {
    throw new Error(`Not a FeatureCollection: ${inPath}`);
  }

  const out = [];
  const seen = new Set(); // 去重：id+category 或 (lat,lon)+category

  for (const f of geo.features) {
    if (!f || f.type !== "Feature") continue;
    if (!f.geometry || f.geometry.type !== "Point") continue;

    const coords = f.geometry.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;

    const lon = Number(coords[0]);
    const lat = Number(coords[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const tags = getTags(f);
    const category = classify(tags);
    if (!category) continue;

    const id = pickId(tags);
    const name = typeof tags.name === "string" ? tags.name : "";

    const keyBase = id ? id : `${lat},${lon}`;
    const key = `${keyBase}_${category}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // 你 App 里要查设备信息，就必须把 tags 保留下来
    out.push(
      toPointFeature(lon, lat, {
        id,
        ward: wardName,
        category,
        name,
        tags: tags,   // ★ 关键：完整设备信息都在这里
      })
    );
  }

  const outGeo = {
    type: "FeatureCollection",
    features: out,
  };

  writeJson(outPath, outGeo);
  return out.length;
}

// ========================
// Main
// ========================
function main() {
  if (!fs.existsSync(RAW_DIR)) {
    console.error(`Missing dir: ${RAW_DIR}`);
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const files = fs
    .readdirSync(RAW_DIR)
    .filter((n) => n.toLowerCase().endsWith(".geojson"));

  if (files.length === 0) {
    console.error(`No .geojson files in ${RAW_DIR}`);
    process.exit(1);
  }

  if (files.length !== 23) {
    console.warn(`[WARN] expected 23 ward files, but got ${files.length}`);
  }

  for (const filename of files) {
    const inPath = path.join(RAW_DIR, filename);
    const ward = baseNameNoExt(filename);        // 例如 chiyoda
    const outName = `${ward}_points.geojson`;   // ★ 末尾加 _points
    const outPath = path.join(OUT_DIR, outName);

    const n = buildOneWardFile(inPath, outPath, ward);
    console.log(`${filename} -> ${outName} : ${n} points`);
  }

  console.log("done.");
}

main();


