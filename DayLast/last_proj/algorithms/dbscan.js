// algorithms/dbscan.js
// DBSCAN clustering on lat/lon points
// points: [{ lat, lon, feature }]
// eps_m: neighborhood radius in meters
// minPts: minimum points to form a core point
//
// 修复点：把 “未访问” 与 “噪声” 分开，否则容易出现只生成一个簇的异常行为。

const { haversineMeters } = require("./geo");

const UNVISITED = -1; // 还没处理过
const NOISE = -2;     // 处理过但密度不足

function rangeQuery(points, i, eps_m) {
  const out = [];
  const pi = points[i];

  for (let j = 0; j < points.length; j++) {
    const pj = points[j];
    const d = haversineMeters(pi.lat, pi.lon, pj.lat, pj.lon);
    if (d <= eps_m) out.push(j);
  }
  return out; // 注意：包含自己 i
}

function dbscan(points, eps_m, minPts) {
  const eps = Number(eps_m);
  const minP = Number(minPts);

  if (!Number.isFinite(eps) || eps <= 0) throw new Error("invalid eps_m");
  if (!Number.isFinite(minP) || minP < 1) throw new Error("invalid minPts");

  const n = points.length;

  // labels:
  //  UNVISITED(-1) 还没处理
  //  NOISE(-2)     处理过但不属于任何簇
  //  >=0           cluster id
  const labels = new Array(n).fill(UNVISITED);

  let clusterId = 0;

  for (let i = 0; i < n; i++) {
    // 只从“未访问点”尝试开新簇
    if (labels[i] !== UNVISITED) continue;

    const neighbors = rangeQuery(points, i, eps);

    if (neighbors.length < minP) {
      // 密度不足：标噪声（但以后仍可能被别的簇吸收）
      labels[i] = NOISE;
      continue;
    }

    // ✅ 开新簇
    const cid = clusterId;
    clusterId++;

    // 先把核心点放入簇
    labels[i] = cid;

    // BFS/Queue 扩展
    const queue = neighbors.slice();
    let qi = 0;

    while (qi < queue.length) {
      const j = queue[qi++];

      // 如果 j 之前被标成噪声，DBSCAN 允许它被吸收到簇里
      if (labels[j] === NOISE) {
        labels[j] = cid;
      }

      // 如果 j 还没访问过，才做邻域查询与扩展
      if (labels[j] === UNVISITED) {
        labels[j] = cid;

        const neighbors2 = rangeQuery(points, j, eps);
        if (neighbors2.length >= minP) {
          // 把 neighbors2 合并进 queue（去重）
          for (const t of neighbors2) {
            if (!queue.includes(t)) queue.push(t);
          }
        }
      }
      // 如果 labels[j] 已经是某个簇(>=0)，就不用动它
    }
  }

  return { labels, clusterCount: clusterId };
}

module.exports = { dbscan };
