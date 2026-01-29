// algorithms/misra_gries.js
// Misra–Gries heavy hitters
// - 第一遍：维护最多 k 个候选（修复：不会总少 1）
// - 第二遍：对候选做精确计数 → 输出 Top-K

function misraCandidates(keys, k) {
  const K = Number(k);
  if (!Number.isFinite(K) || K <= 0) return new Map();

  const counters = new Map(); // key -> count (approx)

  for (const keyRaw of keys) {
    const key = String(keyRaw || "").trim();
    if (!key) continue;

    if (counters.has(key)) {
      counters.set(key, counters.get(key) + 1);
      continue;
    }

    // ✅ 关键修复：最多保留 K 个候选（不是 K-1）
    if (counters.size < K) {
      counters.set(key, 1);
      continue;
    }

    // full: decrement all
    for (const [kk, vv] of counters.entries()) {
      const nv = vv - 1;
      if (nv <= 0) counters.delete(kk);
      else counters.set(kk, nv);
    }
  }

  return counters;
}

function topKByMisraGries(keys, k) {
  const K = Number(k);
  if (!Number.isFinite(K) || K <= 0) return [];

  // 1) 候选
  const cand = misraCandidates(keys, K);
  const candKeys = [...cand.keys()];
  if (candKeys.length === 0) return [];

  // 2) 二次精确计数
  const exact = new Map();
  for (const ck of candKeys) exact.set(ck, 0);

  for (const keyRaw of keys) {
    const key = String(keyRaw || "").trim();
    if (!key) continue;
    if (!exact.has(key)) continue;
    exact.set(key, exact.get(key) + 1);
  }

  // 3) 排序取 Top-K
  return [...exact.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, K);
}

module.exports = { misraCandidates, topKByMisraGries };
