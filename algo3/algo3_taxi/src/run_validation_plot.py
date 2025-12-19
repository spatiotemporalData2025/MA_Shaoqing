# -*- coding: utf-8 -*-
"""
Heatmap(背景) + DBSCAN クラスタ(前景)
→ 明確に差が見える最終版
"""

import numpy as np
import matplotlib.pyplot as plt
from dbscan import dbscan
from pathlib import Path
import matplotlib.cm as cm

DATA_LL = Path("../data/processed/pickups_lonlat.npy")
DATA_XY = Path("../data/processed/pickups_sample.npy")

eps = 300
min_pts = 20

def main():
    print("📥 Loading data...")
    LL = np.load(DATA_LL)  # lon, lat
    X = np.load(DATA_XY)

    print("🚀 Running DBSCAN...")
    labels = dbscan(X, eps, min_pts)

    print("🔥 Creating 2D Heatmap grid...")
    bins = 300  # 提高分辨率
    heat, xedges, yedges = np.histogram2d(
        LL[:, 0], LL[:, 1],
        bins=bins
    )
    heat = heat.T

    # --- 🔥增强对比度：剪裁低值 ---
    vmax = np.percentile(heat, 99)  # 99百分位作为上限
    heat = np.clip(heat, 0, vmax)

    plt.figure(figsize=(10, 12))
    plt.imshow(
        heat,
        extent=[xedges[0], xedges[-1], yedges[0], yedges[-1]],
        origin="lower",
        cmap="hot",
        alpha=0.7
    )

    # --- 绘制 DBSCAN 结果 ---
    unique_labels = set(labels)
    cmap = cm.get_cmap("tab20", len(unique_labels))

    for c in unique_labels:
        mask = (labels == c)
        if c == -1:
            plt.scatter(LL[mask, 0], LL[mask, 1],
                        c="gray", s=3, alpha=0.4, label="Noise")
        else:
            r, g, b, _ = cmap(c)
            plt.scatter(LL[mask, 0], LL[mask, 1],
                        c=[(r, g, b)], s=6, alpha=1.0, label=f"Cluster {c}")

    plt.title("Heatmap Background + DBSCAN Clusters (Validation View)")
    plt.xlabel("Longitude")
    plt.ylabel("Latitude")
    plt.legend(markerscale=2, fontsize=7)
    plt.tight_layout()

    out = "../output/dbscan_validation_plot_final.png"
    plt.savefig(out, dpi=300)
    print(f"🎯 Saved image: {out}")

    plt.show()


if __name__ == "__main__":
    main()
