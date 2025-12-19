# -*- coding: utf-8 -*-
"""
run_experiment.py
执行 NYC Taxi 点云数据的 DBSCAN 聚类演示
----------------------------------------
流程：
1. 加载预处理后的点云数据
2. 设置 eps, min_pts
3. DBSCAN 聚类
4. 打印结果统计
5. 可视化 (不同簇不同颜色，噪声灰色)
"""

import numpy as np
import matplotlib.pyplot as plt
from pathlib import Path

from dbscan import dbscan

# ==============================
# 参数设置
# ==============================
DATA_PATH = Path("../data/processed/pickups_sample.npy")
eps = 300.0    # 半径：300米
min_pts = 20   # 最小核心点数


def main():
    print("📥 正在加载点云数据...")
    X = np.load(DATA_PATH)
    print(f"数据加载成功！形状：{X.shape}")

    print("🚀 DBSCAN 聚类开始...")
    labels = dbscan(X, eps=eps, min_pts=min_pts)
    print("🎯 聚类完成！")

    # 统计结果
    n_points = len(labels)
    n_noise = np.sum(labels == -1)
    cluster_ids = set(labels)
    if -1 in cluster_ids:
        cluster_ids.remove(-1)
    n_clusters = len(cluster_ids)

    print(f"\n====== 聚类结果统计 ======")
    print(f"总点数: {n_points}")
    print(f"簇的数量: {n_clusters}")
    print(f"噪声点: {n_noise} ({n_noise / n_points:.2%})")

    # ==============================
    # 可视化
    # ==============================
    print("\n📊 正在绘制可视化图...")

    plt.figure(figsize=(8, 8))
    unique_labels = sorted(set(labels))

    for cid in unique_labels:
        mask = (labels == cid)
        if cid == -1:
            color = "lightgray"
            plt.scatter(X[mask, 0], X[mask, 1], s=1, c=color, alpha=0.3, label="noise")
        else:
            plt.scatter(X[mask, 0], X[mask, 1], s=2, alpha=0.5, label=f"Cluster {cid}")

    plt.title(f"DBSCAN NYC Taxi Pickups\n(eps={eps}m, min_pts={min_pts})")
    plt.xlabel("X (m)")
    plt.ylabel("Y (m)")
    plt.axis("equal")
    plt.tight_layout()
    plt.show()


if __name__ == "__main__":
    main()
