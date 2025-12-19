# -*- coding: utf-8 -*-
"""
param_sweep.py
参数敏感性分析：
测试多组 eps、minPts 并输出簇数量与噪声比例
"""

import numpy as np
import matplotlib.pyplot as plt
from pathlib import Path

from dbscan import dbscan
from utils import timer

DATA_PATH = Path("../data/processed/pickups_sample.npy")

eps_list = [200, 300, 400, 500]   # 可自由扩展
min_pts = 20                      # 固定一个即可对比 eps


@timer
def run():
    X = np.load(DATA_PATH)

    cluster_counts = []
    noise_ratios = []

    for eps in eps_list:
        print(f"\n🚀 运行 eps={eps}")
        labels = dbscan(X, eps=eps, min_pts=min_pts)

        n_noise = np.sum(labels == -1)
        n_clusters = len(set(labels)) - (1 if -1 in labels else 0)

        cluster_counts.append(n_clusters)
        noise_ratios.append(n_noise / len(labels))

        print(f"簇数: {n_clusters}, 噪声比例: {noise_ratios[-1]:.2%}")

    # 可视化
    fig, ax1 = plt.subplots()
    ax2 = ax1.twinx()

    ax1.plot(eps_list, cluster_counts, marker='o', label="Cluster Count")
    ax2.plot(eps_list, noise_ratios, marker='s', color='r', label="Noise Ratio")

    ax1.set_xlabel("eps (meters)")
    ax1.set_ylabel("簇数量")
    ax2.set_ylabel("噪声比例")

    plt.title("DBSCAN 参数敏感性分析")
    fig.tight_layout()
    plt.show()


if __name__ == "__main__":
    run()
