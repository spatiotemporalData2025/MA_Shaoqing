# -*- coding: utf-8 -*-
import numpy as np
import matplotlib.pyplot as plt
from pathlib import Path

from dbscan import dbscan

DATA_XY = Path("../data/processed/pickups_sample.npy")

eps = 300
min_pts = 20

def main():
    print("📥 Loading data...")
    X = np.load(DATA_XY)

    print("🚀 Running DBSCAN clustering...")
    labels = dbscan(X, eps, min_pts)

    print("🎨 Plotting scatter result...")
    plt.figure(figsize=(8, 10))

    # 噪声点
    noise = (labels == -1)
    plt.scatter(X[noise, 0], X[noise, 1], s=3, c="gray", alpha=0.3, label="Noise")

    # 各簇
    unique_labels = sorted(set(labels))
    for lbl in unique_labels:
        if lbl == -1:
            continue
        cluster = (labels == lbl)
        plt.scatter(X[cluster, 0], X[cluster, 1], s=5, alpha=0.8, label=f"Cluster {lbl}")

    plt.title(f"DBSCAN Clustering Result\n(eps={eps}, minPts={min_pts})")
    plt.xlabel("X (meters)")
    plt.ylabel("Y (meters)")
    plt.legend(loc="upper right", markerscale=3, fontsize=8, bbox_to_anchor=(1.25, 1))
    plt.tight_layout()

    out_path = "../output/dbscan_scatter.png"
    plt.savefig(out_path, dpi=200)
    print(f"🎯 Saved scatter figure to: {out_path}")

    plt.show()

if __name__ == "__main__":
    main()
